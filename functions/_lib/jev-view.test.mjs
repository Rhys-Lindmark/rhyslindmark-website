import assert from 'node:assert/strict';
import test from 'node:test';
import { jevGate, docsRepoPath, serveJevDocs, privateGate, isPrivatePath, handleJevLogin, sessionUser } from './jev-view.js';

const env = { JEV_VIEW_PASSWORD: 'test-password', JEV_GITHUB_TOKEN: 'test-token' };
const basic = (user, pass) => ({ authorization: `Basic ${btoa(`${user}:${pass}`)}` });
const req = (path, headers = {}) => new Request(`https://ai.rhyslindmark.com${path}`, { headers });

test('gate is off when no password is configured', async () => {
	assert.equal(await jevGate(req('/jev'), {}), null);
});

test('gate asks for a login without credentials or with wrong ones', async () => {
	for (const headers of [{}, basic('jev', 'nope'), basic('other', 'test-password'), { authorization: 'Bearer x' }]) {
		const res = await jevGate(req('/jev', headers), env);
		assert.equal(res.status, 401);
		assert.match(res.headers.get('www-authenticate'), /^Basic realm="Jev"/);
	}
});

test('local dev skips the gate only on localhost', async () => {
	const dev = { ...env, JEV_LOCAL_DEV: '1' };
	assert.equal(await jevGate(new Request('http://localhost:8788/jev'), dev), null);
	assert.equal((await jevGate(req('/jev'), dev)).status, 401);
});

test('gate lets the shared login through', async () => {
	assert.equal(await jevGate(req('/jev', basic('jev', 'test-password')), env), null);
});

test('gate forgives capitals and stray spaces on either side', async () => {
	assert.equal(await jevGate(req('/jev', basic('Jev ', ' Test-Password')), env), null);
	assert.equal(await jevGate(req('/jev', basic('jev', 'test-password')), { JEV_VIEW_PASSWORD: 'Test-Password\n' }), null);
});

test('docs paths map to repo paths and reject traversal and dotfiles', async () => {
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
	const redirect = await serveJevDocs(req('/jev/docs/research'), env, fetchImpl);
	assert.equal(redirect.status, 308);
	assert.equal(redirect.headers.get('location'), 'https://ai.rhyslindmark.com/jev/docs/research/');
	const res = await serveJevDocs(req('/jev/docs/research/'), env, fetchImpl);
	const html = await res.text();
	assert.match(html, /href="sub\/">sub\/<\/a>.*href="b\.py">b\.py<\/a>/s);
	assert.doesNotMatch(html, /gitignore/);
	// Only the same-origin theme switch script may run; no fetches, nothing inline.
	assert.match(res.headers.get('content-security-policy'), /script-src 'self';/);
	assert.doesNotMatch(res.headers.get('content-security-policy'), /connect-src|unsafe-inline/);
	assert.match(html, /\/jev\/theme\.js/);
});

test('the feedback folder is its numbers, then the search, and no README or file list', async () => {
	const listing = [{ type: 'file', name: 'README.md' }, { type: 'file', name: 'run.py' }, { type: 'dir', name: 'data' }];
	const fetchImpl = async url => (String(url).includes('README.md') ? Response.json({ content: b64('# Feedback corpus\n\nSome prose.') }) : String(url).includes('stats.json') ? Response.json({ content: b64(JSON.stringify({ total: 3, by_source_kind: { 'hn/story': 3 } })) }) : Response.json(listing));
	const res = await serveJevDocs(req('/jev/docs/feedback/'), env, fetchImpl);
	const html = await res.text();
	assert.match(html, /class="fs-lede">3 posts.*href="\/jev\/docs\/newsletter\/".*id="search".*class="fs-graph".*class="corpus".*\/jev\/feedback\/search\.js/s);
	assert.doesNotMatch(html, /Some prose|run\.py|class="listing"/);
	assert.match(res.headers.get('content-security-policy'), /script-src 'self'; connect-src 'self'/);
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

test('owner-only paths: /jev-private, /jev/rehearse and the session-prep docs, not the one-pager', async () => {
	for (const p of ['/jev-private', '/jev-private/', '/jev/rehearse/', '/jev/docs/takehome/tuesday', '/jev/docs/takehome/tuesday/', '/jev/docs/takehome/tuesday/README.md', '/jev/docs/takehome/tuesday/hard-questions.md', '/jev/docs/takehome/tuesday/how-it-was-built.md']) assert.equal(isPrivatePath(p), true, p);
	for (const p of ['/jev', '/jev/', '/jev/talks/tuesday/', '/jev/docs/takehome/tuesday/one-pager.md', '/jev/docs/takehome/tuesday/one-pager.pdf', '/jev/docs/takehome/', '/jev-privateer']) assert.equal(isPrivatePath(p), false, p);
});

test('private gate fails closed without its secret, and only the owner gets through', async () => {
	assert.equal((await privateGate(req('/jev-private/', basic('rhys', 'owner-pass')), env)).status, 503);
	for (const headers of [{}, basic('jev', 'test-password'), basic('rhys', 'test-password'), basic('jev', 'owner-pass')]) assert.equal((await privateGate(req('/jev-private/', headers), owner)).status, 401);
	assert.equal(await privateGate(req('/jev-private/', basic('Rhys', ' owner-pass ')), owner), null);
	assert.equal(await privateGate(new Request('http://localhost:8788/jev-private/'), { ...owner, JEV_LOCAL_DEV: '1' }), null);
});

test('the owner login also opens the shared pages; the shared login stays as it was', async () => {
	assert.equal(await jevGate(req('/jev', basic('rhys', 'owner-pass')), owner), null);
	assert.equal(await jevGate(req('/jev', basic('jev', 'test-password')), owner), null);
	assert.equal((await jevGate(req('/jev', basic('rhys', 'owner-pass')), env)).status, 401);
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

// Cookie login: /jev/login takes the same passwords and sets a signed jev_session cookie.
const logIn = (user, password, next = '/jev/docs/feedback/', e = owner, now) => handleJevLogin(new Request('https://ai.rhyslindmark.com/jev/login', {
	method: 'POST', body: new URLSearchParams({ user, password, next }),
}), e, now);
const cookieFrom = res => res.headers.get('set-cookie').split(';')[0];

test('the 401 is the login form, and still offers the Basic prompt', async () => {
	const res = await jevGate(req('/jev/docs/feedback/?x=1'), env);
	assert.equal(res.status, 401);
	assert.match(res.headers.get('www-authenticate'), /^Basic realm="Jev"/);
	const html = await res.text();
	assert.match(html, /<form method="post" action="\/jev\/login">/);
	assert.match(html, /name="next" value="\/jev\/docs\/feedback\/\?x=1"/);
	assert.match(res.headers.get('content-security-policy'), /form-action 'self'/);
});

test('logging in sets a cookie the gate accepts; the shared one does not open owner pages', async () => {
	const res = await logIn('Jev', ' Test-Password ');
	assert.equal(res.status, 303);
	assert.equal(res.headers.get('location'), '/jev/docs/feedback/');
	assert.match(res.headers.get('set-cookie'), /^jev_session=jev\.\d+\.[\w-]{43}; Path=\/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax$/);
	const cookie = { cookie: `other=1; ${cookieFrom(res)}` };
	assert.equal(await jevGate(req('/jev', cookie), owner), null);
	assert.equal((await privateGate(req('/jev-private/', cookie), owner)).status, 401);
});

test('the owner cookie opens owner pages and the shared ones', async () => {
	const cookie = { cookie: cookieFrom(await logIn('rhys', 'owner-pass')) };
	assert.equal(await privateGate(req('/jev-private/', cookie), owner), null);
	assert.equal(await jevGate(req('/jev', cookie), owner), null);
});

test('a wrong password gets the form back with no cookie', async () => {
	const res = await logIn('jev', 'nope');
	assert.equal(res.status, 401);
	assert.equal(res.headers.get('set-cookie'), null);
	assert.equal(res.headers.get('www-authenticate'), null);
	assert.match(await res.text(), /don’t match/);
});

test('forged, tampered, expired or re-keyed cookies are refused', async () => {
	const value = cookieFrom(await logIn('jev', 'test-password')).split('=')[1];
	const [, expires, mac] = value.split('.');
	const as = v => req('/jev', { cookie: `jev_session=${v}` });
	assert.equal(await sessionUser(as(value), env), 'jev');
	assert.equal(await sessionUser(as(`rhys.${expires}.${mac}`), owner), null);
	assert.equal(await sessionUser(as(`jev.${+expires + 1}.${mac}`), env), null);
	assert.equal(await sessionUser(as(`jev.${expires}.${'A'.repeat(43)}`), env), null);
	assert.equal(await sessionUser(as(value), env, (+expires + 1) * 1000), null);
	assert.equal(await sessionUser(as(value), { JEV_VIEW_PASSWORD: 'a-new-password' }), null);
	assert.equal((await jevGate(as(value), { JEV_VIEW_PASSWORD: 'a-new-password' })).status, 401);
});

test('login only redirects to /jev pages on this site', async () => {
	for (const [next, to] of [['/jev-private/', '/jev-private/'], ['https://evil.example/jev', '/jev'], ['//evil.example/jev', '/jev'], ['/admin', '/jev'], ['/jev/login', '/jev'], ['', '/jev']]) {
		assert.equal((await logIn('jev', 'test-password', next)).headers.get('location'), to, next);
	}
});

test('the login page and its stylesheets load without a login; logout clears the cookie', async () => {
	const page = await handleJevLogin(req('/jev/login?next=/jev/talks/'), env);
	assert.equal(page.status, 200);
	assert.match(await page.text(), /value="\/jev\/talks\/"/);
	for (const p of ['/jev/minimal.css', '/jev/login.css', '/jev/style/tokens.css']) assert.equal(await jevGate(req(p), env), null, p);
	assert.equal((await jevGate(req('/jev/docs.css'), env)).status, 401);
	const out = await handleJevLogin(req('/jev/logout'), env);
	assert.equal(out.status, 303);
	assert.match(out.headers.get('set-cookie'), /^jev_session=; Path=\/; Max-Age=0/);
});

test('layout: docs folders get the left-aligned docs header and no file list', async () => {
	const listing = [{ type: 'file', name: 'README.md' }, { type: 'dir', name: '01-a' }];
	const readme = '---\nlayout: docs\neyebrow: Developer education\n---\n# Cookbooks\n\n> Recipes on *real* data.\n> Second line.\n\nBody text.\n\n| Cookbook | Level |\n| - | - |\n| [A](01-a/) | Beginner |\n';
	const fetchImpl = async url => (String(url).includes('README.md') ? Response.json({ content: b64(readme) }) : Response.json(listing));
	const html = await (await serveJevDocs(req('/jev/docs/takehome/cookbooks/'), env, fetchImpl)).text();
	assert.match(html, /class="docs-eyebrow">Developer education<\/p><h1 class="docs-title">Cookbooks<\/h1><p class="docs-description">Recipes on <em>real<\/em> data. Second line.<\/p>/);
	assert.match(html, /<p>Body text.<\/p>.*<table>/s);
	assert.doesNotMatch(html, /class="listing"|layout: docs|<blockquote>|doc-tag/);
});

test('layout: docs Markdown files use the same header; other files keep theirs', async () => {
	const docs = async () => Response.json({ type: 'file', name: 'README.md', size: 10, content: b64('---\nlayout: docs\neyebrow: Extraction\n---\n# Select\n\n> Pick a date.\n\n## Setup\n') });
	const html = await (await serveJevDocs(req('/jev/docs/a/README.md'), env, docs)).text();
	assert.match(html, /docs-eyebrow">Extraction<.*docs-title">Select<.*docs-description">Pick a date.<.*<h2[^>]*>Setup<\/h2>/s);
	const plain = async () => Response.json({ type: 'file', name: 'b.md', size: 10, content: b64('# Plain\n\n> A quote.') });
	const html2 = await (await serveJevDocs(req('/jev/docs/a/b.md'), env, plain)).text();
	assert.match(html2, /doc-tag.*<blockquote>/s);
	assert.doesNotMatch(html2, /docs-head/);
});

test('short URLs: hub cards map to their repo folders and back', async () => {
	const { shortToDocs, docsToShort } = await import('./jev-view.js');
	assert.equal(shortToDocs('/jev/feedback/'), '/jev/docs/feedback/');
	assert.equal(shortToDocs('/jev/customer-analysis/memos/a.md'), '/jev/docs/research/memos/a.md');
	assert.equal(shortToDocs('/jev/skill-issue'), '/jev/docs/takehome/skill-issue');
	assert.equal(shortToDocs('/jev/feedback/search.css'), null);
	assert.equal(shortToDocs('/jev/feedback/search'), null);
	assert.equal(shortToDocs('/jev/feedbackx/'), null);
	assert.equal(docsToShort('/jev/docs/takehome/ideas/prompt2jev/run.mjs'), '/jev/prompt2jev/run.mjs');
	assert.equal(docsToShort('/jev/docs/takehome/'), null);
});

test('short URLs: long URLs redirect, short ones serve with repo-relative links fixed', async () => {
	const { serveJevPage } = await import('./jev-view.js');
	const long = await serveJevPage(req('/jev/docs/research/?x=1', basic('jev', 'test-password')), env);
	assert.equal(long.status, 308);
	assert.equal(long.headers.get('location'), 'https://ai.rhyslindmark.com/jev/customer-analysis/?x=1');
	const md = '# Customer Analysis\n\n[up](../takehome/ideas/x/) [corpus](../feedback/) [orgs](organizations.md) [top](#a) [out](https://example.com/)';
	const fake = async u => {
		if (u.includes('/contents/research?')) return Response.json([{ name: 'README.md', type: 'file' }, { name: 'organizations.md', type: 'file' }]);
		if (u.includes('/contents/research/README.md?')) return Response.json({ content: btoa(md) });
		return new Response('', { status: 404 });
	};
	const res = await serveJevPage(req('/jev/customer-analysis/', basic('jev', 'test-password')), env, fake);
	assert.equal(res.status, 200);
	const html = await res.text();
	assert.match(html, /href="\/jev\/docs\/takehome\/ideas\/x\/"/);
	assert.match(html, /href="\/jev\/feedback\/"/);
	assert.match(html, /href="\/jev\/customer-analysis\/organizations\.md"/);
	assert.match(html, /href="#a"/);
	assert.match(html, /href="https:\/\/example\.com\/"/);
	const noSlash = await serveJevPage(req('/jev/customer-analysis', basic('jev', 'test-password')), env, fake);
	assert.equal(noSlash.headers.get('location'), 'https://ai.rhyslindmark.com/jev/customer-analysis/');
});
