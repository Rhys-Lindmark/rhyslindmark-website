// GET /jev/made-with-jev/x?ids=1,2,3: what an X card needs for up to 8 posts (name, avatar,
// photos, video poster, link card, likes), so /jev/made-with-jev/ can draw real X cards.
// The /jev login in _middleware.js runs before this.
//
// Data comes from X's embed endpoint, cdn.syndication.twimg.com/tweet-result: the one its own
// embedded-post widget uses (and Vercel's react-tweet). It needs no key. Each post is kept in
// this data center's cache for a day, so a page of cards is mostly cache hits. At most 8 ids per
// call keeps a call under Workers' 50-subrequest cap (a cache read, a fetch and a cache write
// per post).

const MAX_IDS = 8;
const DAY = 86400;
const cacheKey = id => new Request(`https://jev-made-with-x.internal/v1/${id}`);

// The token X's widget sends with each id.
export const tokenFor = id => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');

const slice = (s, a, b) => Array.from(s || '').slice(a, b).join(''); // ranges count code points

// Keep only what the card draws.
export function compact(t) {
	const user = t.user || {};
	const ents = t.entities || {};
	const [a, b] = t.display_text_range || [0, Array.from(t.text || '').length];
	let text = slice(t.text, a, b);
	for (const m of ents.media || []) text = text.split(m.url).join('');
	const links = Object.fromEntries((ents.urls || []).map(u => [u.url, { display: u.display_url, href: u.expanded_url }]));
	const media = (t.mediaDetails || []).slice(0, 4).map(m => ({
		type: m.type, // photo | video | animated_gif
		src: m.media_url_https,
		w: m.original_info?.width || null, h: m.original_info?.height || null,
	}));
	const v = t.card?.binding_values || {};
	const str = k => v[k]?.string_value || '';
	const img = ['summary_photo_image_large', 'thumbnail_image_large', 'photo_image_full_size_large', 'player_image_large']
		.map(k => v[k]?.image_value).find(Boolean);
	const card = t.card && (str('title') || img) ? {
		title: str('title'), domain: str('vanity_url') || str('domain'), href: t.card.url || '',
		image: img?.url || null, w: img?.width || null, h: img?.height || null,
	} : null;
	const q = t.quoted_tweet;
	return {
		id: t.id_str, name: user.name || '', handle: user.screen_name || '',
		avatar: (user.profile_image_url_https || '').replace('_normal.', '_bigger.'),
		verified: !!(user.is_blue_verified || user.verified),
		text: text.trim(), links, media, card,
		likes: t.favorite_count ?? null, replies: t.conversation_count ?? null,
		quote: q ? { name: q.user?.name || '', handle: q.user?.screen_name || '', text: slice(q.text, ...(q.display_text_range || [0, 280])).trim() } : null,
	};
}

async function one(id, ctx) {
	const cache = typeof caches !== 'undefined' ? caches.default : null;
	if (cache) {
		const hit = await cache.match(cacheKey(id));
		if (hit) return hit.json();
	}
	let data = null, ttl = DAY;
	try {
		const res = await fetch(`https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${tokenFor(id)}`, {
			headers: { 'User-Agent': 'Mozilla/5.0 (compatible; jev-made-with)' },
			signal: AbortSignal.timeout(5000),
		});
		if (res.ok) {
			const t = await res.json();
			data = t.__typename === 'Tweet' || t.id_str ? compact(t) : { id, missing: true };
		} else if (res.status === 404) {
			data = { id, missing: true }; // deleted, or the account went private
		} else {
			return null; // rate limit or an outage: don't cache, try again next time
		}
	} catch {
		return null;
	}
	if (data.missing) ttl = DAY / 4;
	if (cache) {
		const put = cache.put(cacheKey(id), new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${ttl}` } }));
		if (ctx?.waitUntil) ctx.waitUntil(put); else await put;
	}
	return data;
}

export async function onRequestGet(context) {
	const ids = [...new Set((new URL(context.request.url).searchParams.get('ids') || '').split(','))]
		.filter(id => /^\d{1,20}$/.test(id)).slice(0, MAX_IDS);
	const ctx = { waitUntil: p => context.waitUntil(p) };
	const found = await Promise.all(ids.map(id => one(id, ctx)));
	return new Response(JSON.stringify({ posts: Object.fromEntries(ids.map((id, i) => [id, found[i]])) }), {
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': 'private, max-age=3600',
			'X-Robots-Tag': 'noindex',
			'X-Content-Type-Options': 'nosniff',
		},
	});
}
