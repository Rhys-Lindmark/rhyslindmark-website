import assert from 'node:assert/strict';
import test from 'node:test';
import { jevGate, docsRepoPath, serveJevDocs } from './jev-view.js';

const env = { JEV_VIEW_PASSWORD: 'test-password', JEV_GITHUB_TOKEN: 'test-token' };
const basic = (user, pass) => ({ authorization: `Basic ${btoa(`${user}:${pass}`)}` });
const req = (path, headers = {}) => new Request(`https://ai.rhyslindmark.com${path}`, { headers });

test('gate is off when no password is configured', () => {
	assert.equal(jevGate(req('/jev'), {}), null);
});

test('gate asks for a login without credentials or with wrong ones', () => {
	for (const headers of [{}, basic('jev', 'nope'), basic('other', 'test-password'), { authorization: 'Bearer x' }]) {
		const res = jevGate(req('/jev', headers), env);
		assert.equal(res.status, 401);
		assert.match(res.headers.get('www-authenticate'), /^Basic realm="Jev"/);
	}
});

test('local dev skips the gate only on localhost', () => {
	const dev = { ...env, JEV_LOCAL_DEV: '1' };
	assert.equal(jevGate(new Request('http://localhost:8788/jev'), dev), null);
	assert.equal(jevGate(req('/jev'), dev).status, 401);
});

test('gate lets the shared login through', () => {
	assert.equal(jevGate(req('/jev', basic('jev', 'test-password')), env), null);
});

test('gate forgives capitals and stray spaces on either side', () => {
	assert.equal(jevGate(req('/jev', basic('Jev ', ' Test-Password')), env), null);
	assert.equal(jevGate(req('/jev', basic('jev', 'test-password')), { JEV_VIEW_PASSWORD: 'Test-Password\n' }), null);
});

test('docs paths map to repo paths and reject traversal and dotfiles', () => {
	assert.equal(docsRepoPath('/jev/docs'), '');
	assert.equal(docsRepoPath('/jev/docs/'), '');
	assert.equal(docsRepoPath('/jev/docs/research/customer-analysis.md'), 'research/customer-analysis.md');
	assert.equal(docsRepoPath('/jev/docs/../secrets'), null);
	assert.equal(docsRepoPath('/jev/docs/%2e%2e/x'), null);
	assert.equal(docsRepoPath('/jev/docs/feedback/config/.env'), null);
	assert.equal(docsRepoPath('/jev/docsx'), null);
});

const b64 = s => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

test('markdown files render through the GitHub contents API with the token', async () => {
	let seen;
	const fetchImpl = async (url, init) => {
		seen = { url, auth: init.headers.Authorization };
		return Response.json({ type: 'file', name: 'a.md', size: 10, content: b64('# Hello “Jev”') });
	};
	const res = await serveJevDocs(req('/jev/docs/research/a.md'), env, fetchImpl);
	assert.equal(res.status, 200);
	assert.equal(seen.url, 'https://api.github.com/repos/Rhys-Lindmark/jev/contents/research/a.md?ref=main');
	assert.equal(seen.auth, 'Bearer test-token');
	const html = await res.text();
	assert.match(html, /<h1[^>]*>Hello “Jev”<\/h1>/);
	assert.match(res.headers.get('content-security-policy'), /default-src 'none'/);
});

test('directories redirect to a trailing slash, then list entries', async () => {
	const listing = [{ type: 'file', name: 'b.py' }, { type: 'dir', name: 'sub' }, { type: 'file', name: '.gitignore' }];
	const fetchImpl = async () => Response.json(listing);
	const redirect = await serveJevDocs(req('/jev/docs/feedback'), env, fetchImpl);
	assert.equal(redirect.status, 308);
	assert.equal(redirect.headers.get('location'), 'https://ai.rhyslindmark.com/jev/docs/feedback/');
	const res = await serveJevDocs(req('/jev/docs/feedback/'), env, fetchImpl);
	const html = await res.text();
	assert.match(html, /href="sub\/">sub\/<\/a>.*href="b\.py">b\.py<\/a>/s);
	assert.doesNotMatch(html, /gitignore/);
});

test('code files are escaped, not executed', async () => {
	const fetchImpl = async () => Response.json({ type: 'file', name: 'x.py', size: 20, content: b64('print("<script>")') });
	const html = await (await serveJevDocs(req('/jev/docs/x.py'), env, fetchImpl)).text();
	assert.match(html, /&lt;script&gt;/);
});

test('docs are off until both secrets exist', async () => {
	const res = await serveJevDocs(req('/jev/docs/'), { JEV_VIEW_PASSWORD: 'x' }, async () => { throw new Error('should not fetch'); });
	assert.equal(res.status, 503);
});
