// Ghost -> Substack migration fallback.
// Cloudflare Pages redirects always take precedence over static assets, so a
// static wildcard rule (e.g. /:slug -> substack) would swallow every new page
// added to this site, requiring a manual opt-out per page. Instead: try to
// serve the request normally first, and only fall back to Substack if the
// path genuinely doesn't exist here.

const AI_SITES = {
	'/byow': 'https://byow.rhyslindmark.chatgpt.site',
	'/domestication': 'https://visualizing-reality.rhyslindmark.chatgpt.site',
	'/givebetter': 'https://market-for-impact.rhyslindmark.chatgpt.site',
	'/music': 'https://songs-for-self.rhyslindmark.chatgpt.site',
	'/games': 'https://ai-games-accelerator.rhyslindmark.chatgpt.site',
	'/claims': 'https://ai-claims-accelerator.rhyslindmark.chatgpt.site',
};

const SENSITIVE_UPSTREAM_HEADERS = [
	'authorization',
	'cookie',
	'proxy-authorization',
	'cf-connecting-ip',
	'x-forwarded-for',
	'x-real-ip',
];

function isClaimsRequestAPI(url, prefix) {
	if (prefix !== '/claims') return false;
	const upstreamPath = url.pathname.slice(prefix.length) || '/';
	return upstreamPath === '/api/v1/analysis-requests' || /^\/api\/v1\/analysis-requests\/req_[0-9a-f]{64}$/.test(upstreamPath);
}

function isBYOWBuildAPI(url, prefix) {
	return prefix === '/byow' && url.pathname === '/byow/api/build';
}

function proxyMethodAllowed(request, url, prefix) {
	if (request.method === 'GET' || request.method === 'HEAD') return true;
	if (isBYOWBuildAPI(url, prefix)) return request.method === 'POST';
	if (!isClaimsRequestAPI(url, prefix)) return false;
	if (request.method === 'OPTIONS') return true;
	return request.method === 'POST' && url.pathname === `${prefix}/api/v1/analysis-requests`;
}

export function buildUpstreamURL(url, prefix, origin) {
	const upstreamPath = url.pathname.slice(prefix.length) || '/';
	const upstreamURL = new URL(origin);
	const upstreamOrigin = upstreamURL.origin;
	const upstreamBasePath = upstreamURL.pathname.replace(/\/$/, '');
	upstreamURL.pathname = `${upstreamBasePath}${upstreamPath}` || '/';
	upstreamURL.search = url.search;
	if (upstreamURL.origin !== upstreamOrigin) throw new Error('invalid upstream origin');
	return upstreamURL;
}

export function buildUpstreamRequest(request, url, prefix, origin) {
	if (!proxyMethodAllowed(request, url, prefix)) return null;
	const headers = new Headers(request.headers);
	for (const name of SENSITIVE_UPSTREAM_HEADERS) headers.delete(name);
	const init = {
		method: request.method,
		headers,
		redirect: 'manual',
	};
	if (!['GET', 'HEAD'].includes(request.method)) {
		init.body = request.body;
		init.duplex = 'half';
	}
	return new Request(buildUpstreamURL(url, prefix, origin), init);
}

async function proxyAISite(request, url, prefix, origin) {
	const upstreamRequest = buildUpstreamRequest(request, url, prefix, origin);
	if (!upstreamRequest) {
		return new Response('Method not allowed', {
			status: 405,
			headers: { allow: isClaimsRequestAPI(url, prefix) ? 'GET, HEAD, POST, OPTIONS' : isBYOWBuildAPI(url, prefix) ? 'GET, HEAD, POST' : 'GET, HEAD' },
		});
	}
	const response = await fetch(upstreamRequest);
	const headers = new Headers(response.headers);

	headers.delete('set-cookie');

	const location = headers.get('location');
	if (location) {
		const resolved = new URL(location, origin);
		if (resolved.origin === origin) {
			headers.set(
				'location',
				`https://ai.rhyslindmark.com${prefix}${resolved.pathname}${resolved.search}${resolved.hash}`,
			);
		}
	}

	const contentType = headers.get('content-type') || '';
	const isText =
		contentType.startsWith('text/') ||
		contentType.includes('javascript') ||
		contentType.includes('json');

	if (!isText) {
		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	}

	let body = await response.text();
	body = body
		.replaceAll(origin, `https://ai.rhyslindmark.com${prefix}`)
		.replaceAll('href="/', `href="${prefix}/`)
		.replaceAll('src="/_next/', `src="${prefix}/_next/`)
		.replaceAll('"/_next/', `"${prefix}/_next/`)
		.replaceAll('"/data/', `"${prefix}/data/`);

	headers.delete('content-length');
	headers.delete('content-encoding');

	return new Response(body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

const ARTICLE_PATH = '/posts/ai2026-pt1/';
const ARTICLE_ORIGIN = 'https://www.rhyslindmark.com';

export function articleSlide(url) {
	if (url.pathname !== ARTICLE_PATH && url.pathname !== ARTICLE_PATH.slice(0, -1)) return null;
	const value = url.searchParams.get('slide');
	if (!/^\d{1,2}$/.test(value || '')) return null;
	const number = Number(value);
	return number >= 1 && number <= 47 && number !== 24 ? number : null;
}

function htmlText(value) {
	return value.replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (entity, code) => {
		if (code[0] === '#') {
			const number = code[1].toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
			return number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
		}
		return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[code.toLowerCase()];
	}).replace(/\s+/g, ' ').trim();
}
function escapeAttribute(value) {
	return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

export function withSlideMetadata(html, slide) {
	if (!Number.isInteger(slide) || slide < 1 || slide > 47 || slide === 24) return html;
	const passage = html.match(new RegExp(`<([a-z][a-z0-9]*)\\b[^>]*\\bdata-passage=["']${slide}["'][^>]*>([\\s\\S]*?)<\\/\\1>`, 'i'));
	if (!passage) return html;
	// Reading sections may put data-passage on a container: use its heading only.
	const content = passage[2].match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || passage[2];
	const description = htmlText(content).slice(0, 350);
	const title = `AI 2026 · Slide ${slide} — Rhys Lindmark`;
	const url = `${ARTICLE_ORIGIN}${ARTICLE_PATH}?slide=${slide}`;
	const image = `${ARTICLE_ORIGIN}${ARTICLE_PATH}share/${String(slide).padStart(2, '0')}.jpg`;
	const fields = {
		'og:type': 'article', 'og:site_name': 'Rhys Lindmark', 'og:title': title,
		'og:description': description, 'og:url': url, 'og:image': image,
		'og:image:alt': description, 'twitter:card': 'summary_large_image',
		'twitter:title': title, 'twitter:description': description, 'twitter:image': image,
		'twitter:image:alt': description,
	};
	const tags = Object.entries(fields).map(([name, value]) => `<meta ${name.startsWith('og:') ? 'property' : 'name'}="${name}" content="${escapeAttribute(value)}">`).join('');
	return html.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, head => {
		const cleaned = head.replace(/<meta\b[^>]*>/gi, tag => /\b(?:name|property)\s*=\s*["'](?:og:|twitter:)[^"']*["']/i.test(tag) ? '' : tag);
		return cleaned.replace(/<\/head>/i, () => `${tags}</head>`);
	});
}

export async function onRequest(context) {
	const url = new URL(context.request.url);

	if (url.hostname === 'ai.rhyslindmark.com') {
		const path = url.pathname.replace(/\/$/, '') || '/';

		if (path === '/donate' || path.startsWith('/donate/')) {
			url.pathname = `/givebetter${url.pathname.slice('/donate'.length)}`;
			return Response.redirect(url.toString(), 308);
		}

		for (const [prefix, origin] of Object.entries(AI_SITES)) {
			if (path === prefix || path.startsWith(`${prefix}/`)) {
				return proxyAISite(context.request, url, prefix, origin);
			}
		}

		if (path === '/') {
			url.pathname = '/ai/';
			return context.env.ASSETS.fetch(url);
		}
	}

	const response = await context.next();
	const slide = articleSlide(url);
	if (slide && context.request.method === 'GET' && response.status === 200 && (response.headers.get('content-type') || '').includes('text/html')) {
		const html = await response.text();
		const headers = new Headers(response.headers);
		for (const name of ['content-length', 'content-encoding', 'etag']) headers.delete(name);
		return new Response(withSlideMetadata(html, slide), { status: response.status, statusText: response.statusText, headers });
	}

	if (response.status === 404) {
		const slug = new URL(context.request.url).pathname.replace(/^\/|\/$/g, '');
		if (slug && !slug.includes('/')) {
			return Response.redirect(`https://rhyslindmark.substack.com/p/${slug}`, 301);
		}
	}

	return response;
}
