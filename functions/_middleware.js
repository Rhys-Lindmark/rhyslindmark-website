// Ghost -> Substack migration fallback.
// Cloudflare Pages redirects always take precedence over static assets, so a
// static wildcard rule (e.g. /:slug -> substack) would swallow every new page
// added to this site, requiring a manual opt-out per page. Instead: try to
// serve the request normally first, and only fall back to Substack if the
// path genuinely doesn't exist here.

const VISUALIZING_REALITY_ORIGIN = 'https://visualizing-reality.rhyslindmark.chatgpt.site';
const DOMESTICATION_PREFIX = '/domestication';

async function proxyDomestication(request, url) {
	const upstreamPath = url.pathname.slice(DOMESTICATION_PREFIX.length) || '/';
	const upstreamURL = new URL(upstreamPath + url.search, VISUALIZING_REALITY_ORIGIN);
	const upstreamRequest = new Request(upstreamURL, request);
	const response = await fetch(upstreamRequest);
	const headers = new Headers(response.headers);

	headers.delete('set-cookie');

	const location = headers.get('location');
	if (location) {
		const resolved = new URL(location, VISUALIZING_REALITY_ORIGIN);
		if (resolved.origin === VISUALIZING_REALITY_ORIGIN) {
			headers.set(
				'location',
				`https://ai.rhyslindmark.com${DOMESTICATION_PREFIX}${resolved.pathname}${resolved.search}${resolved.hash}`,
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
		.replaceAll(VISUALIZING_REALITY_ORIGIN, 'https://ai.rhyslindmark.com/domestication')
		.replaceAll('href="/', 'href="/domestication/')
		.replaceAll('src="/_next/', 'src="/domestication/_next/')
		.replaceAll('"/_next/', '"/domestication/_next/')
		.replaceAll('"/data/', '"/domestication/data/');

	headers.delete('content-length');
	headers.delete('content-encoding');

	return new Response(body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

export async function onRequest(context) {
	const url = new URL(context.request.url);

	if (url.hostname === 'ai.rhyslindmark.com') {
		const path = url.pathname.replace(/\/$/, '') || '/';

		if (path === DOMESTICATION_PREFIX || path.startsWith(`${DOMESTICATION_PREFIX}/`)) {
			return proxyDomestication(context.request, url);
		}

		if (path === '/donate') {
			return Response.redirect('https://market-for-impact.rhyslindmark.chatgpt.site', 302);
		}

		if (path === '/') {
			url.pathname = '/ai/';
			return context.env.ASSETS.fetch(url);
		}
	}

	const response = await context.next();

	if (response.status === 404) {
		const slug = new URL(context.request.url).pathname.replace(/^\/|\/$/g, '');
		if (slug && !slug.includes('/')) {
			return Response.redirect(`https://rhyslindmark.substack.com/p/${slug}`, 301);
		}
	}

	return response;
}
