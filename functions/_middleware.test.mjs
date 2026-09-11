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
