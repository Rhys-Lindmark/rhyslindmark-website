// Ghost -> Substack migration fallback.
// Cloudflare Pages redirects always take precedence over static assets, so a
// static wildcard rule (e.g. /:slug -> substack) would swallow every new page
// added to this site, requiring a manual opt-out per page. Instead: try to
// serve the request normally first, and only fall back to Substack if the
// path genuinely doesn't exist here.

const AI_SITES = {
	'/domestication': 'https://visualizing-reality.rhyslindmark.chatgpt.site',
	'/donate': 'https://market-for-impact.rhyslindmark.chatgpt.site',
	'/songs-for-self': 'https://songs-for-self.rhyslindmark.chatgpt.site',
};

async function proxyAISite(request, url, prefix, origin) {
	const upstreamPath = url.pathname.slice(prefix.length) || '/';
	const upstreamURL = new URL(upstreamPath + url.search, origin);
	const upstreamRequest = new Request(upstreamURL, request);
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

export async function onRequest(context) {
	const url = new URL(context.request.url);

	if (url.hostname === 'ai.rhyslindmark.com') {
		const path = url.pathname.replace(/\/$/, '') || '/';

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

	if (response.status === 404) {
		const slug = new URL(context.request.url).pathname.replace(/^\/|\/$/g, '');
		if (slug && !slug.includes('/')) {
			return Response.redirect(`https://rhyslindmark.substack.com/p/${slug}`, 301);
		}
	}

	return response;
}
