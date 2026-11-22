import assert from 'node:assert/strict';
import test from 'node:test';
import { jevGate, docsRepoPath, serveJevDocs, privateGate, isPrivatePath } from './jev-view.js';

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

const owner = { ...env, JEV_PRIVATE_PASSWORD: 'owner-pass' };

test('owner-only paths: /jev-private, /jev/rehearse and the session-prep docs, not the one-pager', () => {
	for (const p of ['/jev-private', '/jev-private/', '/jev/rehearse/', '/jev/docs/takehome/tuesday', '/jev/docs/takehome/tuesday/', '/jev/docs/takehome/tuesday/README.md', '/jev/docs/takehome/tuesday/hard-questions.md', '/jev/docs/takehome/tuesday/how-it-was-built.md']) assert.equal(isPrivatePath(p), true, p);
	for (const p of ['/jev', '/jev/', '/jev/talks/tuesday/', '/jev/docs/takehome/tuesday/one-pager.md', '/jev/docs/takehome/tuesday/one-pager.pdf', '/jev/docs/takehome/', '/jev-privateer']) assert.equal(isPrivatePath(p), false, p);
});

test('private gate fails closed without its secret, and only the owner gets through', () => {
	assert.equal(privateGate(req('/jev-private/', basic('rhys', 'owner-pass')), env).status, 503);
	for (const headers of [{}, basic('jev', 'test-password'), basic('rhys', 'test-password'), basic('jev', 'owner-pass')]) assert.equal(privateGate(req('/jev-private/', headers), owner).status, 401);
	assert.equal(privateGate(req('/jev-private/', basic('Rhys', ' owner-pass ')), owner), null);
	assert.equal(privateGate(new Request('http://localhost:8788/jev-private/'), { ...owner, JEV_LOCAL_DEV: '1' }), null);
});

test('the owner login also opens the shared pages; the shared login stays as it was', () => {
	assert.equal(jevGate(req('/jev', basic('rhys', 'owner-pass')), owner), null);
	assert.equal(jevGate(req('/jev', basic('jev', 'test-password')), owner), null);
	assert.equal(jevGate(req('/jev', basic('rhys', 'owner-pass')), env).status, 401);
});

test('listings hide owner-only files from everyone else', async () => {
	const listing = [{ type: 'file', name: 'README.md' }, { type: 'file', name: 'hard-questions.md' }, { type: 'file', name: 'one-pager.md' }];
	const fetchImpl = async url => /README\.md/.test(url) ? Response.json({ type: 'file', name: 'README.md', content: btoa('# x') }) : Response.json(listing);
	const shared = await (await serveJevDocs(req('/jev/docs/takehome/x/'), owner, fetchImpl)).text();
	assert.match(shared, /hard-questions\.md/); // only the tuesday folder is private
	const parent = [{ type: 'dir', name: 'tuesday' }, { type: 'dir', name: 'demos' }];
	const asShared = await (await serveJevDocs(req('/jev/docs/takehome/', basic('jev', 'test-password')), owner, async () => Response.json(parent))).text();
	assert.doesNotMatch(asShared, /tuesday/);
	assert.match(asShared, /demos/);
	const asOwner = await (await serveJevDocs(req('/jev/docs/takehome/', basic('rhys', 'owner-pass')), owner, async () => Response.json(parent))).text();
	assert.match(asOwner, /tuesday/);
});
