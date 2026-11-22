import test from 'node:test';
import assert from 'node:assert/strict';
import { addJevTheme, isJevThemePath, withJevTheme } from './jev-theme.js';

test('adds the theme tags once, before </head>', () => {
	const out = addJevTheme('<html><head><title>x</title></head><body></body></html>');
	assert.match(out, /<link rel="stylesheet" href="\/jev\/theme\.css\?v=[^"]+"><script src="\/jev\/theme\.js\?v=[^"]+"><\/script><\/head>/);
	assert.equal(addJevTheme(out), out);
	assert.equal(addJevTheme('<p>no head</p>'), '<p>no head</p>');
});

test('themes /jev pages, not docs or pages with their own palette', () => {
	for (const p of ['/jev', '/jev/', '/jev/lint/', '/jev/talks/trust-meter/', '/jev-private']) assert.ok(isJevThemePath(p), p);
	for (const p of ['/jevx', '/jev/docs/x.md', '/jev/game/', '/jev/talks/trust-meter/banking77.html', '/ai/']) assert.ok(!isJevThemePath(p), p);
});

test('only rewrites 200 HTML GETs', async () => {
	const get = new Request('https://ai.rhyslindmark.com/jev/lint/');
	const html = () => new Response('<head></head>', { headers: { 'content-type': 'text/html', etag: 'x' } });
	const res = await withJevTheme(html(), get, '/jev/lint/');
	assert.match(await res.text(), /theme\.js/);
	assert.equal(res.headers.get('etag'), null);
	const css = new Response('a{}', { headers: { 'content-type': 'text/css' } });
	assert.equal(await withJevTheme(css, get, '/jev/minimal.css'), css);
	const head = html();
	assert.equal(await withJevTheme(head, new Request(get, { method: 'HEAD' }), '/jev/lint/'), head);
});
