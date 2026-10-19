import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUpstreamRequest, buildUpstreamURL } from './_middleware.js';

const origin = 'https://visualizing-reality.rhyslindmark.chatgpt.site';
const prefix = '/domestication';

test('network-path input remains a path on the allowlisted origin', () => {
	const incoming = new URL('https://ai.rhyslindmark.com/domestication//example.com/private?q=1');
	const upstream = buildUpstreamURL(incoming, prefix, origin);

	assert.equal(upstream.origin, origin);
	assert.equal(upstream.pathname, '//example.com/private');
	assert.equal(upstream.search, '?q=1');
});

test('upstream requests drop credentials and client-address headers', () => {
	const incomingURL = new URL('https://ai.rhyslindmark.com/domestication/page');
	const incomingRequest = new Request(incomingURL, {
		headers: {
			authorization: 'Bearer test-value',
			cookie: 'session=test-value',
			'cf-connecting-ip': '192.0.2.1',
			'x-forwarded-for': '192.0.2.1',
			'x-nextjs-data': '1',
		},
	});
	const upstream = buildUpstreamRequest(incomingRequest, incomingURL, prefix, origin);

	assert.ok(upstream);
	assert.equal(upstream.headers.has('authorization'), false);
	assert.equal(upstream.headers.has('cookie'), false);
	assert.equal(upstream.headers.has('cf-connecting-ip'), false);
	assert.equal(upstream.headers.has('x-forwarded-for'), false);
	assert.equal(upstream.headers.get('x-nextjs-data'), '1');
});

test('proxy request construction rejects state-changing methods', () => {
	const incomingURL = new URL('https://ai.rhyslindmark.com/domestication/page');
	const incomingRequest = new Request(incomingURL, { method: 'POST' });

	assert.equal(buildUpstreamRequest(incomingRequest, incomingURL, prefix, origin), null);
});

test('proxy forwards only the Claims request API write and strips credentials', async () => {
	const claimsOrigin = 'https://ai-claims-accelerator.rhyslindmark.chatgpt.site';
	const incomingURL = new URL('https://ai.rhyslindmark.com/claims/api/v1/analysis-requests');
	const incomingRequest = new Request(incomingURL, {
		method: 'POST',
		headers: { authorization: 'Bearer secret', cookie: 'session=secret', 'content-type': 'application/json' },
		body: '{"entity_key":"web:example.invalid"}',
	});
	const upstream = buildUpstreamRequest(incomingRequest, incomingURL, '/claims', claimsOrigin);

	assert.ok(upstream);
	assert.equal(upstream.url, `${claimsOrigin}/api/v1/analysis-requests`);
	assert.equal(upstream.method, 'POST');
	assert.equal(upstream.headers.has('authorization'), false);
	assert.equal(upstream.headers.has('cookie'), false);
	assert.equal(upstream.headers.get('content-type'), 'application/json');
	assert.equal(await upstream.text(), '{"entity_key":"web:example.invalid"}');
});

test('proxy permits Claims request preflight and rejects every broader write', () => {
	const claimsOrigin = 'https://ai-claims-accelerator.rhyslindmark.chatgpt.site';
	const collectionURL = new URL('https://ai.rhyslindmark.com/claims/api/v1/analysis-requests');
	const statusURL = new URL(`https://ai.rhyslindmark.com/claims/api/v1/analysis-requests/req_${'a'.repeat(64)}`);
	const otherURL = new URL('https://ai.rhyslindmark.com/claims/api/v1/extension-releases');

	assert.ok(buildUpstreamRequest(new Request(collectionURL, { method: 'OPTIONS' }), collectionURL, '/claims', claimsOrigin));
	assert.ok(buildUpstreamRequest(new Request(statusURL, { method: 'OPTIONS' }), statusURL, '/claims', claimsOrigin));
	assert.equal(buildUpstreamRequest(new Request(statusURL, { method: 'POST' }), statusURL, '/claims', claimsOrigin), null);
	assert.equal(buildUpstreamRequest(new Request(otherURL, { method: 'POST' }), otherURL, '/claims', claimsOrigin), null);
	assert.equal(buildUpstreamRequest(new Request(collectionURL, { method: 'PUT' }), collectionURL, '/claims', claimsOrigin), null);
});

test('proxy forwards only the BYOW builder POST beneath the BYOW route', async () => {
	const byowOrigin = 'https://byow.rhyslindmark.chatgpt.site';
	const buildURL = new URL('https://ai.rhyslindmark.com/byow/api/build');
	const pageURL = new URL('https://ai.rhyslindmark.com/byow/anything');
	const request = new Request(buildURL, {
		method: 'POST',
		headers: { authorization: 'Bearer secret', cookie: 'session=secret', 'content-type': 'application/json' },
		body: '{"prompt":"make it blue"}',
	});
	const upstream = buildUpstreamRequest(request, buildURL, '/byow', byowOrigin);

	assert.ok(upstream);
	assert.equal(upstream.url, `${byowOrigin}/api/build`);
	assert.equal(upstream.headers.has('authorization'), false);
	assert.equal(upstream.headers.has('cookie'), false);
	assert.equal(await upstream.text(), '{"prompt":"make it blue"}');
	assert.equal(buildUpstreamRequest(new Request(buildURL, { method: 'PUT' }), buildURL, '/byow', byowOrigin), null);
	assert.equal(buildUpstreamRequest(new Request(pageURL, { method: 'POST' }), pageURL, '/byow', byowOrigin), null);
});

test('proxy forwards only the GiveBetter MCP POST and preflight beneath the GiveBetter route', async () => {
	const gbOrigin = 'https://givebetter.rhyslindmark.workers.dev';
	const mcpURL = new URL('https://ai.rhyslindmark.com/givebetter/api/mcp');
	const otherURL = new URL('https://ai.rhyslindmark.com/givebetter/api/open-botec');
	const nestedURL = new URL('https://ai.rhyslindmark.com/givebetter/api/mcp/extra');
	const request = new Request(mcpURL, {
		method: 'POST',
		headers: { authorization: 'Bearer secret', cookie: 'session=secret', 'content-type': 'application/json' },
		body: '{"jsonrpc":"2.0","id":1,"method":"tools/list"}',
	});
	const upstream = buildUpstreamRequest(request, mcpURL, '/givebetter', gbOrigin);

	assert.ok(upstream);
	assert.equal(upstream.url, `${gbOrigin}/api/mcp`);
	assert.equal(upstream.headers.has('authorization'), false);
	assert.equal(upstream.headers.has('cookie'), false);
	assert.equal(await upstream.text(), '{"jsonrpc":"2.0","id":1,"method":"tools/list"}');
	assert.ok(buildUpstreamRequest(new Request(mcpURL, { method: 'OPTIONS' }), mcpURL, '/givebetter', gbOrigin));
	assert.equal(buildUpstreamRequest(new Request(mcpURL, { method: 'PUT' }), mcpURL, '/givebetter', gbOrigin), null);
	assert.equal(buildUpstreamRequest(new Request(mcpURL, { method: 'DELETE' }), mcpURL, '/givebetter', gbOrigin), null);
	assert.equal(buildUpstreamRequest(new Request(otherURL, { method: 'POST' }), otherURL, '/givebetter', gbOrigin), null);
	assert.equal(buildUpstreamRequest(new Request(nestedURL, { method: 'POST' }), nestedURL, '/givebetter', gbOrigin), null);
	const byowURL = new URL('https://ai.rhyslindmark.com/byow/api/mcp');
	assert.equal(buildUpstreamRequest(new Request(byowURL, { method: 'POST' }), byowURL, '/byow', 'https://byow.rhyslindmark.chatgpt.site'), null);
});

test('accelerator routes preserve an upstream base path when one is configured', () => {
	const acceleratorOrigin = 'https://example.com/base';
	const incoming = new URL('https://ai.rhyslindmark.com/games/_next/static/example.js?v=1');
	const upstream = buildUpstreamURL(incoming, '/games', acceleratorOrigin);

	assert.equal(upstream.origin, 'https://example.com');
	assert.equal(upstream.pathname, '/base/_next/static/example.js');
	assert.equal(upstream.search, '?v=1');
});

const { articleSlide, withSlideMetadata, onRequest } = await import('./_middleware.js');
const articlePath = '/posts/ai2026-pt1/';
const slideURL = value => new URL(`https://www.rhyslindmark.com${articlePath}?slide=${value}`);
const slideHTML = '<html><head><meta property="og:title" content="old"><meta name="twitter:image" content="old"><meta name="description" content="Keep"><title>Keep title</title></head><body><h2 data-passage="22">Epoch <a href="/source">estimates</a> $100B &amp; &quot;risk&quot; $&amp;.</h2><div data-passage="37"><h2>Chinese chips</h2><p>Do not use this body.</p></div></body></html>';

test('article slide query validates route and available slide numbers', () => {
 for (const value of ['1','01','22','47']) assert.equal(articleSlide(slideURL(value)), Number(value));
 for (const value of ['0','24','48','-1','1.5','NaN','1x','<script>','001']) assert.equal(articleSlide(slideURL(value)), null);
 assert.equal(articleSlide(new URL('https://www.rhyslindmark.com/elsewhere?slide=22')), null);
 assert.equal(articleSlide(new URL('https://www.rhyslindmark.com/posts/ai2026-pt1/?anything=22')), null);
});

test('slide metadata replaces prior social tags without duplicates and escapes text', () => {
 const html = withSlideMetadata(slideHTML, 22);
 assert.equal((html.match(/property="og:title"/g) || []).length, 1);
 assert.equal((html.match(/name="twitter:image"/g) || []).length, 1);
 assert(html.includes('Epoch estimates $100B &amp; &quot;risk&quot; $&amp;.'));
 assert(html.includes('share/22.jpg'));
 assert(html.includes('content="https://www.rhyslindmark.com/posts/ai2026-pt1/?slide=22"'));
 assert(html.includes('<title>Keep title</title>'));
 assert(html.includes('name="description" content="Keep"'));
 assert.equal(withSlideMetadata(html, 22), html);
 assert.equal(withSlideMetadata(slideHTML, 24), slideHTML);
 assert.equal(withSlideMetadata(slideHTML, 23), slideHTML);
 const container = withSlideMetadata(slideHTML, 37);
 assert(container.includes('property="og:description" content="Chinese chips"'));
});

test('slide metadata safely reduces overlapping markup to escaped plain text', () => {
 const html = '<html><head></head><body><h2 data-passage="22">Safe <<script>script>alert(1)</script> &amp; sound</h2></body></html>';
 const result = withSlideMetadata(html, 22);
 assert(result.includes('content="Safe script&gt;alert(1) &amp; sound"'));
 assert.equal(result.includes('content="Safe <script'), false);
});

test('article middleware changes only successful HTML GET requests and preserves fallback', async () => {
 const run = async (path, response, method='GET') => onRequest({request:new Request(`https://www.rhyslindmark.com${path}`,{method}),next:async()=>response});
 const response=await run(`${articlePath}?slide=22`,new Response(slideHTML,{headers:{'content-type':'text/html','etag':'stale','content-length':'12'}}));
 assert((await response.text()).includes('share/22.jpg'));assert.equal(response.headers.get('etag'),null);assert.equal(response.headers.get('content-length'),null);
 const invalid=await run(`${articlePath}?slide=24`,new Response(slideHTML,{headers:{'content-type':'text/html'}}));assert.equal(await invalid.text(),slideHTML);
 const asset=await run(`${articlePath}charts.json?slide=22`,new Response('{"ok":true}',{headers:{'content-type':'application/json'}}));assert.equal(await asset.text(),'{"ok":true}');
 const fallback=await run('/missing-post',new Response('missing',{status:404}));assert.equal(fallback.status,301);assert.equal(fallback.headers.get('location'),'https://rhyslindmark.substack.com/p/missing-post');
});

test('bubble proxy keeps dashboard, appendix, client APIs and preloads under its prefix', async () => {
 const oldFetch = globalThis.fetch;
 const seen=[];
 globalThis.fetch=async request=>{
  seen.push(request.url);
  return new Response('<a href="/appendix">Evidence</a><script src="/_next/static/app.js"></script>fetch("/api/dashboard");read(\'/api/market\');',{headers:{'content-type':'text/html','link':'</_next/static/app.js>; rel=preload','set-cookie':'private=value'}});
 };
 try {
  const result=await onRequest({request:new Request('https://ai.rhyslindmark.com/bubble?x=1'),next:()=>{throw new Error('should proxy')}});
  assert.equal(seen[0],'https://ai-bubble-observatory.rhyslindmark.chatgpt.site/?x=1');
  const body=await result.text();
  assert(body.includes('href="/bubble/appendix"'));
  assert(body.includes('src="/bubble/_next/static/app.js"'));
  assert(body.includes('fetch("/bubble/api/dashboard")'));
  assert(body.includes("read('/bubble/api/market')"));
  assert.equal(result.headers.get('link'),'</bubble/_next/static/app.js>; rel=preload');
  assert.equal(result.headers.get('set-cookie'),null);
  await onRequest({request:new Request('https://ai.rhyslindmark.com/bubble/api/dashboard'),next:()=>{throw new Error('should proxy')}});
  assert.equal(seen[1],'https://ai-bubble-observatory.rhyslindmark.chatgpt.site/api/dashboard');
  const denied=await onRequest({request:new Request('https://ai.rhyslindmark.com/bubble/api/dashboard',{method:'POST'}),next:()=>{throw new Error('should reject')}});
  assert.equal(denied.status,405);
 } finally {globalThis.fetch=oldFetch;}
});


test('bubble rewrites hydrated links and CSS font paths as well as refresh calls', async () => {
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async()=>new Response('const href="/appendix#sources";fetch(\'/api/context\');url(/_next/static/font.woff2);read(`/api/dashboard`);const deps=["_next/static/chunks/view.js"]',{headers:{'content-type':'application/javascript'}});
 try {
  const result=await onRequest({request:new Request('https://ai.rhyslindmark.com/bubble/_next/static/app.js'),next:()=>{throw new Error('should proxy')}});
  const body=await result.text();
  assert(body.includes('href="/bubble/appendix#sources"'));
  assert(body.includes("fetch('/bubble/api/context')"));
  assert(body.includes('url(/bubble/_next/static/font.woff2)'));
  assert(body.includes('read(`/bubble/api/dashboard`)'));
  assert(body.includes('"bubble/_next/static/chunks/view.js"'));
 } finally {globalThis.fetch=oldFetch;}
});


test('SF Hosting redirects both old hosts and slash variants while preserving venue links', async () => {
 for (const host of ['www.rhyslindmark.com', 'rhyslindmark.com']) {
  for (const path of ['/tools/sf-hosting', '/tools/sf-hosting/']) {
   for (const method of ['GET', 'HEAD']) {
    const response = await onRequest({
     request: new Request(`https://${host}${path}?venue=test-venue`, {method}),
     next: () => {throw new Error('old hosting URL must redirect');},
    });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), `https://ai.rhyslindmark.com${path}?venue=test-venue`);
   }
  }
 }
});

test('SF Hosting on AI and shared assets continue to the static site', async () => {
 for (const host of ['ai.rhyslindmark.com', 'www.rhyslindmark.com']) {
  const paths = ['/tools/sf-hosting.js', '/tools/sf-hosting.css', '/data/sf-hosting.json', '/vendor/leaflet/leaflet.js'];
  if (host === 'ai.rhyslindmark.com') paths.push('/tools/sf-hosting', '/tools/sf-hosting/');
  for (const path of paths) {
   const response = await onRequest({
    request: new Request(`https://${host}${path}`),
    next: async () => new Response('static content'),
   });
   assert.equal(response.status, 200);
   assert.equal(await response.text(), 'static content');
  }
 }
});

test('Lean Coffee forwards bounded meeting API writes and host credentials', async () => {
 const origin='https://lean-coffee-together.rhyslindmark.chatgpt.site';
 const url=new URL('https://ai.rhyslindmark.com/tools/lean-coffee/api/rooms');
 const req=new Request(url,{method:'POST',headers:{Origin:url.origin,'X-Host':'facilitator-token','X-Participant':'participant','Content-Type':'application/json'},body:JSON.stringify({title:'Coffee'})});
 const proxied=buildUpstreamRequest(req,url,'/tools/lean-coffee',origin);
 assert.equal(proxied.url,origin+'/api/rooms');
 assert.equal(proxied.headers.get('origin'),origin);
 assert.equal(proxied.headers.get('X-Host'),'facilitator-token');
 assert.deepEqual(await proxied.json(),{title:'Coffee'});
 const bad=new Request(url,{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'});
 assert.equal(buildUpstreamRequest(bad,url,'/tools/lean-coffee',origin),null);
 const unrelated=new URL('https://ai.rhyslindmark.com/tools/lean-coffee/other');
 assert.equal(buildUpstreamRequest(new Request(unrelated,{method:'POST'}),unrelated,'/tools/lean-coffee',origin),null);
});

test('Lean Coffee rewrites client paths while preserving participant JSON text', async () => {
 const {onRequest}=await import('./_middleware.js');const saved=globalThis.fetch;
 try{
 globalThis.fetch=async()=>new Response("<script>request('/api/rooms');location.origin+'/?room=';location.href='/'</script>",{headers:{'Content-Type':'text/html'}});
 let response=await onRequest({request:new Request('https://ai.rhyslindmark.com/tools/lean-coffee'),next:()=>{throw new Error('should proxy')}});
 const html=await response.text();assert.ok(html.includes("request('/tools/lean-coffee/api/rooms')"));assert.ok(html.includes("location.origin+'/tools/lean-coffee?room='"));assert.ok(html.includes("location.href='/tools/lean-coffee'"));
 const notes={notes:"'/api/rooms and https://lean-coffee-together.rhyslindmark.chatgpt.site stay literal"};
 globalThis.fetch=async()=>Response.json(notes);
 response=await onRequest({request:new Request('https://ai.rhyslindmark.com/tools/lean-coffee/api/rooms/aaaaaaaaaaaaaaaa'),next:()=>{throw new Error('should proxy')}});assert.deepEqual(await response.json(),notes);
 }finally{globalThis.fetch=saved}
});
