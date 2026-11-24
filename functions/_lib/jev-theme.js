// The /jev theme switch (System / Light / Dark): public/jev/theme.css and theme.js.
// Docs and login pages put JEV_THEME_TAGS in their own <head>; the middleware adds
// them to static /jev pages (withJevTheme), including pages generated from the jev repo.

export const JEV_THEME_VERSION = 'jev-theme-2';
export const JEV_THEME_TAGS = `<link rel="stylesheet" href="/jev/theme.css?v=${JEV_THEME_VERSION}"><script src="/jev/theme.js?v=${JEV_THEME_VERSION}"></script>`;

// Pages with their own fixed palette, where a light/dark switch would do nothing useful.
const SKIP = [/^\/jev\/game(\/|$)/, /^\/jev\/made-with-jev(\/|$)/,/^\/jev\/talks\/trust-meter\/(banking77|irony)(\.html)?$/];

export function isJevThemePath(pathname) {
	const inJev = pathname === '/jev' || pathname.startsWith('/jev/') || pathname === '/jev-private' || pathname.startsWith('/jev-private/');
	return inJev && !pathname.startsWith('/jev/docs') && !SKIP.some(re => re.test(pathname));
}

export function addJevTheme(html) {
	if (html.includes('/jev/theme.js')) return html;
	const i = html.search(/<\/head>/i);
	return i === -1 ? html : html.slice(0, i) + JEV_THEME_TAGS + html.slice(i);
}

export async function withJevTheme(response, request, pathname) {
	if (request.method !== 'GET' || response.status !== 200 || !isJevThemePath(pathname)) return response;
	if (!(response.headers.get('content-type') || '').includes('text/html')) return response;
	const html = await response.text();
	const headers = new Headers(response.headers);
	for (const name of ['content-length', 'content-encoding', 'etag']) headers.delete(name);
	return new Response(addJevTheme(html), { status: response.status, statusText: response.statusText, headers });
}
