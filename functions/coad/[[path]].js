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

// Only these public shells/assets may be shared. APIs (including health/session)
// and arbitrary paths always bypass the cache, regardless of their extension.
const PUBLIC_PATHS = new Set(['','/','/index.html','/view','/view/','/view.html',
  '/app.mjs','/view-host.mjs','/view.mjs','/theme.js','/style.css','/view.css',
  '/toad.svg','/workbench.html','/workbench.mjs','/workbench.css']);

export async function onRequest(context, {fetcher = fetch, cache = globalThis.caches?.default} = {}) {
  const request = upstreamRequest(context.request);
  if (!request) return new Response('Request not allowed',{status:403});
  const cacheable = ['GET','HEAD'].includes(request.method) && PUBLIC_PATHS.has(new URL(context.request.url).pathname.slice(5));
  const key = cacheable ? new Request(context.request.url,{method:'GET'}) : null;
  const reply = (response,state) => {
    const headers = new Headers(response.headers);
    headers.set('X-Coad-Cache',state);
    const etag = headers.get('etag');
    const unchanged = etag && (context.request.headers.get('if-none-match') ?? '').split(',').some(value => value.trim() === etag || value.trim() === '*');
    return new Response(unchanged || request.method === 'HEAD' ? null : response.body,
      {status:unchanged ? 304 : response.status,statusText:unchanged ? undefined : response.statusText,headers});
  };
  if (key && cache) {
    try { const cached = await cache.match(key); if(cached) return reply(cached,'HIT'); } catch { /* Cache failure must not break the app. */ }
  }
  let response;
  // Shared resources are fetched anonymously with canonical headers; neither an
  // owner cookie nor client conditional headers can personalize a cache entry.
  try { response = await fetcher(cacheable ? new Request(request.url,{method:'GET',headers:{'Accept-Encoding':'identity'},redirect:'manual'}) : request); }
  catch { return new Response('Coad is temporarily unavailable.',{status:502}); }
  const headers = new Headers(response.headers);
  const variesPublicly = (headers.get('vary') ?? '').split(',').every(value => ['', 'accept-encoding'].includes(value.trim().toLowerCase()));
  const shareable = cacheable && response.status === 200 && !headers.has('set-cookie') && variesPublicly;
  headers.set('Cache-Control',shareable ? 'public, max-age=0, s-maxage=60, must-revalidate' : 'no-store');
  const cookie = headers.get('set-cookie');
  if (cookie && !cookie.startsWith('coad_owner=')) headers.delete('set-cookie');
  const location = headers.get('location');
  if (location) {
    const resolved = new URL(location,UPSTREAM_ORIGIN);
    if (resolved.origin === UPSTREAM_ORIGIN) headers.set('location',`/coad${resolved.pathname}${resolved.search}${resolved.hash}`);
  }
  const output = new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  if(shareable && cache) {
    const write = cache.put(key,output.clone()).catch(() => {});
    if(context.waitUntil)context.waitUntil(write); else await write;
  }
  return shareable ? reply(output,'MISS') : request.method === 'HEAD' ? new Response(null,{status:output.status,headers:output.headers}) : output;
}
