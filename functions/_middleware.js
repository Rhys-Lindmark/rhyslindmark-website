// Ghost -> Substack migration fallback.
// Cloudflare Pages redirects always take precedence over static assets, so a
// static wildcard rule (e.g. /:slug -> substack) would swallow every new page
// added to this site, requiring a manual opt-out per page. Instead: try to
// serve the request normally first, and only fall back to Substack if the
// path genuinely doesn't exist here.
export async function onRequest(context) {
	const response = await context.next();

	if (response.status === 404) {
		const slug = new URL(context.request.url).pathname.replace(/^\/|\/$/g, '');
		if (slug && !slug.includes('/')) {
			return Response.redirect(`https://rhyslindmark.substack.com/p/${slug}`, 301);
		}
	}

	return response;
}
