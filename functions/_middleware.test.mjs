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
