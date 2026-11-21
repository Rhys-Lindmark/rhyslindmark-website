// GET /jev/feedback/search: full-text search over the Jev feedback corpus (D1 + FTS5).
// The /jev login in _middleware.js runs before this, so only logged-in viewers get here.
// The page that calls it is public/jev/feedback/. The corpus is filled by
// feedback/upload_d1.py in the private jev repo; schema in migrations/jev-feedback/.
//
// Query: q, kind ("github/pr" or "github" for every GitHub kind), from, to (YYYY-MM-DD),
//   about=1 (Jev says the item is about Jev), segment, label (a Jev label column),
//   sort (relevance | newest | oldest | label | sentiment | -sentiment), offset.
// ?meta=1 returns the filter choices and when the corpus was last uploaded.

export const LABELS = [
	'author_builds_with_jev', 'in_production',
	'use_classify', 'use_route', 'use_rank_score', 'use_eval_judge', 'use_agent_control',
	'love_typed', 'love_speed', 'love_price',
	'pain_wrong_answers', 'pain_question_design', 'pain_trust', 'pain_unclear_use',
	'pain_closed_hosted', 'pain_sdk_api', 'pain_limits',
];
export const SEGMENTS = ['agent_or_coding_tool_builder', 'production_pipeline_team', 'framework_or_platform_integrator', 'eval_or_research', 'maker_or_hobbyist'];
const YES = 0.7; // TypeSafe's suggested reading of a Noul, as in labeling/questions.py
const PAGE = 20;
const HL_OPEN = '\u0002', HL_CLOSE = '\u0003';

function json(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'private, no-store',
			'X-Robots-Tag': 'noindex',
			'X-Content-Type-Options': 'nosniff',
		},
	});
}

// Turn what a person types into a safe FTS5 query. Words are ANDed, "quoted text" is a
// phrase, word* is a prefix, -word excludes, OR between two terms means either.
export function ftsQuery(input) {
	const pos = [], neg = [];
	let pendingOr = false;
	for (const m of String(input || '').slice(0, 300).matchAll(/(-?)"([^"]*)"|(\S+)/g)) {
		let neg_ = m[1] === '-', raw = m[2], prefix = false;
		if (raw === undefined) {
			raw = m[3];
			if (raw === 'OR') { pendingOr = pos.length > 0; continue; }
			if (raw.startsWith('-') && raw.length > 1) { neg_ = true; raw = raw.slice(1); }
			prefix = raw.endsWith('*');
		}
		const words = raw.normalize('NFKC').match(/[\p{L}\p{N}_]+/gu);
		if (!words) continue;
		const term = `"${words.join(' ')}"${prefix && words.length === 1 ? '*' : ''}`;
		if (neg_) neg.push(term);
		else if (pendingOr && pos.length) { pos[pos.length - 1] = `(${pos[pos.length - 1]} OR ${term})`; pendingOr = false; }
		else pos.push(term);
	}
	if (!pos.length) return '';
	return pos.join(' AND ') + neg.map(t => ` NOT ${t}`).join('');
}

// question engineering -> the FTS5 phrase "question engineering"; "" when the query uses
// quotes, operators or a single word.
export function plainPhrase(input) {
	const raw = String(input || '').trim();
	if (/["*()]|(^|\s)-|\bOR\b/.test(raw)) return '';
	const words = raw.normalize('NFKC').match(/[\p{L}\p{N}_]+/gu) || [];
	return words.length >= 2 && words.length <= 8 ? `"${words.join(' ')}"` : '';
}

const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(s || '');

export async function search(db, params) {
	const q = ftsQuery(params.get('q'));
	const where = [], binds = [];
	const kind = params.get('kind') || '';
	if (/^[a-z]+\/[a-z-]+$/.test(kind)) { where.push('i.source = ? AND i.kind = ?'); binds.push(...kind.split('/')); }
	else if (/^[a-z]+$/.test(kind)) { where.push('i.source = ?'); binds.push(kind); }
	if (isDate(params.get('from'))) { where.push('i.created_at >= ?'); binds.push(params.get('from')); }
	if (isDate(params.get('to'))) { where.push('i.created_at < ?'); binds.push(nextDay(params.get('to'))); }
	if (params.get('about') === '1') where.push(`i.about_jev >= ${YES}`);
	const segment = params.get('segment');
	if (SEGMENTS.includes(segment)) { where.push('i.segment = ?'); binds.push(segment); }
	const label = LABELS.includes(params.get('label')) ? params.get('label') : '';
	if (label) where.push(`i.${label} >= ${YES}`);

	let sort = params.get('sort') || (q ? 'relevance' : label ? 'label' : 'newest');
	const orders = {
		newest: 'i.created_at DESC', oldest: 'i.created_at ASC',
		sentiment: 'i.sentiment IS NULL, i.sentiment DESC', '-sentiment': 'i.sentiment IS NULL, i.sentiment ASC',
		label: label ? `i.${label} DESC` : 'i.created_at DESC',
		relevance: q ? 'bm25(items_fts, 4.0, 1.0, 2.0)' : 'i.created_at DESC',
	};
	// Stemming lets "engineering" match "engine", so when several plain words are typed,
	// items that contain them as an exact phrase come first.
	const phrase = q ? plainPhrase(params.get('q')) : '';
	const orderBinds = [];
	if (phrase && sort === 'relevance') {
		orders.relevance = `(i.rid IN (SELECT rowid FROM items_fts WHERE items_fts MATCH ?)) DESC, ${orders.relevance}`;
		orderBinds.push(phrase);
	}
	if (!orders[sort]) sort = 'newest';
	const offset = Math.min(Math.max(parseInt(params.get('offset'), 10) || 0, 0), 2000);

	const cols = `i.id, i.source, i.kind, i.url, i.title, i.author, i.created_at, i.about_jev, i.segment, i.sentiment, ${LABELS.map(l => `i.${l}`).join(', ')}`;
	let from = 'items i', snippet = 'substr(i.text, 1, 320)';
	if (q) {
		from = 'items_fts JOIN items i ON i.rid = items_fts.rowid';
		where.unshift('items_fts MATCH ?');
		binds.unshift(q);
		snippet = `snippet(items_fts, -1, '${HL_OPEN}', '${HL_CLOSE}', '…', 40)`;
	}
	const whereSQL = where.length ? `WHERE ${where.join(' AND ')}` : '';
	const [rows, count] = await db.batch([
		db.prepare(`SELECT ${cols}, ${snippet} AS snippet FROM ${from} ${whereSQL} ORDER BY ${orders[sort]} LIMIT ${PAGE + 1} OFFSET ${offset}`).bind(...binds, ...orderBinds),
		db.prepare(`SELECT count(*) AS n FROM ${from} ${whereSQL}`).bind(...binds),
	]);
	const results = rows.results.slice(0, PAGE).map(r => ({
		id: r.id, source: r.source, kind: r.kind, url: r.url, title: r.title, author: r.author,
		created_at: r.created_at, snippet: r.snippet || '',
		about_jev: r.about_jev, segment: r.segment, sentiment: r.sentiment,
		labels: Object.fromEntries(LABELS.filter(l => r[l] >= YES).map(l => [l, r[l]])),
	}));
	return { query: q, sort, offset, total: count.results[0].n, more: rows.results.length > PAGE, results };
}

function nextDay(d) {
	const t = new Date(`${d}T00:00:00Z`);
	t.setUTCDate(t.getUTCDate() + 1);
	return t.toISOString().slice(0, 10);
}

export async function onRequestGet({ request, env }) {
	const db = env.JEV_FEEDBACK_DB;
	if (!db) return json({ error: 'The corpus database is not connected.' }, 503);
	const params = new URL(request.url).searchParams;
	try {
		if (params.get('meta') === '1') {
			const rows = (await db.prepare('SELECT k, v FROM meta').all()).results;
			const meta = Object.fromEntries(rows.map(r => [r.k, r.v]));
			return json({
				uploaded_at: meta.uploaded_at || null,
				total: Number(meta.total) || 0,
				labeled: Number(meta.labeled) || 0,
				kinds: meta.kinds ? JSON.parse(meta.kinds) : {},
				labels: LABELS, segments: SEGMENTS,
			});
		}
		return json(await search(db, params));
	} catch (err) {
		const msg = String(err?.message || err);
		if (/fts5|syntax/i.test(msg)) return json({ error: 'Couldn’t read that search. Try plain words.' }, 400);
		console.error('feedback search', msg);
		return json({ error: 'Search failed.' }, 500);
	}
}
