// Install at functions/coad/[[path]].js in rhyslindmark-website after backend verification.
export const UPSTREAM_ORIGIN = 'https://rhys-lindmark--coad-web.us-east.modal.run';

export function upstreamRequest(request, origin = UPSTREAM_ORIGIN) {
  const url = new URL(request.url);
  if (url.pathname !== '/coad' && !url.pathname.startsWith('/coad/')) return null;
  if (!['GET','HEAD','POST'].includes(request.method)) return null;
  if (request.headers.has('origin') && request.headers.get('origin') !== url.origin) return null;
  const target = new URL(origin);
  target.pathname = url.pathname.slice('/coad'.length) || '/';
  target.search = url.search;
  const headers = new Headers(request.headers);
  for (const name of ['authorization','proxy-authorization','cf-connecting-ip','x-forwarded-for','x-real-ip','host']) headers.delete(name);
  const ownerCookie = (headers.get('cookie') ?? '').split(';').map(part => part.trim()).find(part => part.startsWith('coad_owner='));
  if (ownerCookie) headers.set('cookie',ownerCookie); else headers.delete('cookie');
  return new Request(target,{method:request.method,headers,redirect:'manual',
    ...(['GET','HEAD'].includes(request.method) ? {} : {body:request.body,duplex:'half'})});
}

export async function onRequest(context) {
  const request = upstreamRequest(context.request);
  if (!request) return new Response('Request not allowed',{status:403});
  let response;
  try { response = await fetch(request); }
  catch { return new Response('Coad is temporarily unavailable.',{status:502}); }
  const headers = new Headers(response.headers);
  headers.set('Cache-Control','no-store');
  const cookie = headers.get('set-cookie');
  if (cookie && !cookie.startsWith('coad_owner=')) headers.delete('set-cookie');
  const location = headers.get('location');
  if (location) {
    const resolved = new URL(location,UPSTREAM_ORIGIN);
    if (resolved.origin === UPSTREAM_ORIGIN) headers.set('location',`/coad${resolved.pathname}${resolved.search}${resolved.hash}`);
  }
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
