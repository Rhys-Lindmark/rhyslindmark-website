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
