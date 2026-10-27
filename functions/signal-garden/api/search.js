export function onRequest({request}) { const url = new URL(request.url); url.pathname = url.pathname.replace(/^\/signal-garden(?=\/|$)/, '/exa'); return Response.redirect(url.toString(), 308); }
