// GET /jev/made-with-jev/posts: what people say they built with Jev on X, newest first.
// The page that calls it is /jev/made-with-jev/. It reads the same D1 corpus as the feedback
// search (functions/jev/feedback/search.js), so other people's posts never sit in this repo.
// The /jev login in _middleware.js runs before this.
//
// A post counts as a build when Jev 1.14 answers yes (>= 0.70) to both "is this about Jev?"
// and "does the author build with Jev?" (labeling/questions.py in the private jev repo).
//
// Query: use (classify | route | rank_score | eval_judge | agent_control | production),
//   segment (who Jev says the author is), author (one X handle: every post of theirs),
//   all=1 (every post, not one per builder), offset. ?meta=1 adds the totals, the counts
//   per use and per segment, and when the corpus was uploaded.

const YES = 0.7;
const PAGE = 30;
const BOTS = ['grok']; // an LLM that answers questions about Jev, not a builder
const USES = {
	classify: 'use_classify', route: 'use_route', rank_score: 'use_rank_score',
	eval_judge: 'use_eval_judge', agent_control: 'use_agent_control', production: 'in_production',
};
const SEGMENTS = ['agent_or_coding_tool_builder', 'production_pipeline_team', 'framework_or_platform_integrator', 'eval_or_research', 'maker_or_hobbyist'];
const BASE = `source = 'x' AND about_jev >= ${YES} AND author_builds_with_jev >= ${YES} AND lower(author) NOT IN (${BOTS.map(b => `'${b}'`).join(', ')})`;

function json(body, status = 200, extra = {}) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'private, no-store',
			'X-Robots-Tag': 'noindex',
			'X-Content-Type-Options': 'nosniff',
			...extra,
		},
	});
}

// The corpus changes at most once a day, so answers are kept in this data center's cache for
// 10 minutes, as the feedback search does. Only this function reads it, after the login.
const CACHE_SECONDS = 600;
const cacheKey = url => new Request(`https://jev-made-with-cache.internal${url.pathname}${url.search}`);
async function cached(url, ctx, compute) {
	const cache = typeof caches !== 'undefined' ? caches.default : null;
	if (cache) {
		const hit = await cache.match(cacheKey(url));
		if (hit) return json(await hit.json(), 200, { 'Server-Timing': 'cache;desc=hit' });
	}
	const body = await compute();
	if (cache) {
		const copy = new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${CACHE_SECONDS}` } });
		const put = cache.put(cacheKey(url), copy);
		if (ctx?.waitUntil) ctx.waitUntil(put); else await put;
	}
	return json(body);
}

export async function posts(db, params) {
	const where = [BASE], binds = [];
	const use = USES[params.get('use')] ? params.get('use') : '';
	if (use) where.push(`${USES[use]} >= ${YES}`);
	const segment = SEGMENTS.includes(params.get('segment')) ? params.get('segment') : '';
	if (segment) { where.push('segment = ?'); binds.push(segment); }
	const author = (params.get('author') || '').replace(/^@/, '');
	if (author && /^\w{1,30}$/.test(author)) { where.push('lower(author) = lower(?)'); binds.push(author); }
	const every = params.get('all') === '1' || !!author;
	const offset = Math.min(Math.max(parseInt(params.get('offset'), 10) || 0, 0), 3000);
	const filter = where.join(' AND ');
	const cols = `id, url, author, created_at, substr(text, 1, 1400) AS text, segment, ${Object.values(USES).join(', ')}`;

	const list = every
		? `SELECT ${cols}, 1 AS n FROM items WHERE ${filter} ORDER BY created_at DESC LIMIT ${PAGE + 1} OFFSET ${offset}`
		// One card per builder: their newest post, and how many they made.
		: `SELECT ${cols}, n FROM (SELECT *, row_number() OVER (PARTITION BY lower(author) ORDER BY created_at DESC) AS rn,
			count(*) OVER (PARTITION BY lower(author)) AS n FROM items WHERE ${filter})
			WHERE rn = 1 ORDER BY created_at DESC LIMIT ${PAGE + 1} OFFSET ${offset}`;
	const total = `SELECT count(*) AS posts, count(DISTINCT lower(author)) AS builders FROM items WHERE ${filter}`;

	const queries = [db.prepare(list).bind(...binds), db.prepare(total).bind(...binds)];
	const wantMeta = params.get('meta') === '1';
	if (wantMeta) {
		queries.push(
			db.prepare(`SELECT segment, count(*) AS n FROM items WHERE ${BASE} GROUP BY segment`),
			db.prepare(`SELECT ${Object.entries(USES).map(([k, c]) => `sum(${c} >= ${YES}) AS ${k}`).join(', ')} FROM items WHERE ${BASE}`),
			db.prepare('SELECT k, v FROM meta'),
			db.prepare(`SELECT count(*) AS posts, count(DISTINCT lower(author)) AS builders, max(created_at) AS newest FROM items WHERE ${BASE}`),
		);
	}
	const [rows, count, segs, uses, meta, all] = await db.batch(queries);
	const body = {
		use, segment, author: author || null, every, offset,
		posts: count.results[0].posts, builders: count.results[0].builders,
		more: rows.results.length > PAGE,
		results: rows.results.slice(0, PAGE).map(r => ({
			id: r.id, url: r.url, author: r.author, created_at: r.created_at, text: r.text || '', n: r.n,
			segment: r.segment,
			uses: Object.keys(USES).filter(k => r[USES[k]] >= YES),
		})),
	};
	if (wantMeta) {
		const m = Object.fromEntries(meta.results.map(r => [r.k, r.v]));
		body.meta = {
			uploaded_at: m.uploaded_at || null, uses: uses.results[0],
			segments: Object.fromEntries(segs.results.filter(r => SEGMENTS.includes(r.segment)).map(r => [r.segment, r.n])),
			posts: all.results[0].posts, builders: all.results[0].builders,
			newest: all.results[0].newest,
		};
	}
	return body;
}

export async function onRequestGet(context) {
	const db = context.env.JEV_FEEDBACK_DB;
	if (!db) return json({ error: 'The corpus database is not connected.' }, 503);
	const url = new URL(context.request.url);
	try {
		return await cached(url, { waitUntil: p => context.waitUntil(p) }, () => posts(db, url.searchParams));
	} catch (err) {
		console.error('made-with-jev', String(err?.message || err));
		return json({ error: 'Couldn’t load the posts.' }, 500);
	}
}
