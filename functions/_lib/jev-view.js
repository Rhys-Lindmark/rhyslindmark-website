// Shared-login gate for ai.rhyslindmark.com/jev/*, plus /jev/docs/*, which renders
// files from the private GitHub repo Rhys-Lindmark/jev for logged-in viewers.
//
// Secrets (Cloudflare Pages, set by the owner, never in source):
//   JEV_VIEW_PASSWORD  the shared password; the username is always "jev".
//                      Unset: /jev stays public as before and /jev/docs is off.
//   JEV_GITHUB_TOKEN   fine-grained token, Contents: read-only on Rhys-Lindmark/jev.
//   JEV_PRIVATE_PASSWORD  Rhys's own login (username "rhys") for the owner-only pages:
//                      /jev-private, /jev/rehearse and the session-prep docs in PRIVATE_DOCS.
//                      It also opens everything the shared login does. Unset: those pages
//                      stay closed (they fail closed, unlike the shared gate).
//
// Two ways in, same passwords: the browser's Basic prompt, or the form at /jev/login,
// which sets a signed jev_session cookie for 30 days. The form exists for browsers that
// never show the Basic prompt (Claude's browser pane is one). The cookie's HMAC key comes
// from that user's password, so changing a password signs every cookie out.
import { marked } from 'marked';

export const VIEW_USER = 'jev';
export const PRIVATE_USER = 'rhys';
const REPO = 'Rhys-Lindmark/jev';
const DOCS_PREFIX = '/jev/docs';
// Repo paths only the owner sees: the interview run-of-show and prep notes.
// The one-pager in the same folder stays on the shared login (it's sent ahead).
const PRIVATE_DOCS = ['takehome/tuesday', 'takehome/tuesday/README.md', 'takehome/tuesday/hard-questions.md', 'takehome/tuesday/how-it-was-built.md'];
export const isPrivateDoc = repoPath => PRIVATE_DOCS.includes(String(repoPath).replace(/\/+$/, ''));
export function isPrivatePath(pathname) {
	if (pathname === '/jev-private' || pathname.startsWith('/jev-private/')) return true;
	if (pathname === '/jev/rehearse' || pathname.startsWith('/jev/rehearse/')) return true;
	const repoPath = docsRepoPath(pathname);
	return repoPath !== null && isPrivateDoc(repoPath);
}

// Forgiving on purpose: a shared, spoken password. Phones capitalize the first
// letter and pasted values carry stray spaces, so compare trimmed and lowercased.
const norm = s => String(s).trim().toLowerCase();
function login(request) {
	const match = (request.headers.get('authorization') || '').match(/^Basic\s+([A-Za-z0-9+/=]+)$/i);
	if (!match) return null;
	let decoded = '';
	try { decoded = new TextDecoder().decode(Uint8Array.from(atob(match[1]), c => c.charCodeAt(0))); } catch {}
	const sep = decoded.indexOf(':');
	return sep > 0 ? { user: norm(decoded.slice(0, sep)), pass: norm(decoded.slice(sep + 1)) } : null;
}
const matches = (l, user, secret) => !!(l && secret && norm(secret) && timingSafeEqual(l.user, user) && timingSafeEqual(l.pass, norm(secret)));
export const isOwner = async (request, env) => matches(login(request), PRIVATE_USER, env.JEV_PRIVATE_PASSWORD) || (await sessionUser(request, env)) === PRIVATE_USER;
const localDev = (request, env) => env.JEV_LOCAL_DEV === '1' && new URL(request.url).hostname === 'localhost';

// Cookie login. The value is "<user>.<expires, unix seconds>.<base64url HMAC-SHA256>".
const SESSION_COOKIE = 'jev_session';
const SESSION_SECONDS = 30 * 86400;
const secretFor = (user, env) => (user === PRIVATE_USER ? env.JEV_PRIVATE_PASSWORD : user === VIEW_USER ? env.JEV_VIEW_PASSWORD : null);
async function sessionMac(user, expires, secret) {
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(`jev-session\n${norm(secret)}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${user}.${expires}`)));
	return btoa(String.fromCharCode(...mac)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function cookieValue(request, name) {
	for (const part of (request.headers.get('cookie') || '').split(';')) {
		const i = part.indexOf('=');
		if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
	}
	return null;
}
// The user a valid, unexpired session cookie names, or null.
export async function sessionUser(request, env, now = Date.now()) {
	const m = /^(jev|rhys)\.(\d{9,11})\.([A-Za-z0-9_-]{43})$/.exec(cookieValue(request, SESSION_COOKIE) || '');
	if (!m || +m[2] * 1000 <= now) return null;
	const secret = secretFor(m[1], env);
	if (!secret || !norm(secret)) return null;
	return timingSafeEqual(m[3], await sessionMac(m[1], m[2], secret)) ? m[1] : null;
}

// Where to send someone after logging in: a /jev or /jev-private path on this site, else /jev.
function safeNext(raw, base) {
	try {
		const u = new URL(String(raw || '/jev'), base);
		const p = u.pathname;
		const inJev = p === '/jev' || p.startsWith('/jev/') || p === '/jev-private' || p.startsWith('/jev-private/');
		if (u.origin === base.origin && inJev && !/^\/jev\/log(in|out)\/?$/.test(p)) return p + u.search;
	} catch {}
	return '/jev';
}

function loginPage({ message, next, user = '', error = '', status = 200, headers = {} }) {
	const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Log in · Jev</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="/jev/minimal.css?v=jev-1"><link rel="stylesheet" href="/jev/login.css?v=jev-login-1"></head>
<body><div class="shell"><header><a href="/">Rhys / AI</a><a href="/jev">Jev</a></header>
<main class="login"><h1>Log in</h1><p>${escapeHTML(message)}</p>
<form method="post" action="/jev/login"><input type="hidden" name="next" value="${escapeHTML(next)}">
<label for="user"><span>Username</span></label><input id="user" name="user" value="${escapeHTML(user)}" autocomplete="username" autocapitalize="none" spellcheck="false" required>
<label for="password"><span>Password</span></label><input id="password" name="password" type="password" autocomplete="current-password" required${user ? ' autofocus' : ''}>
${error ? `<p class="login-error" role="alert">${escapeHTML(error)}</p>` : ''}<button type="submit">Log in</button></form></main></div></body></html>`;
	return new Response(html, {
		status,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'no-store',
			'X-Robots-Tag': 'noindex',
			'Referrer-Policy': 'no-referrer',
			'Content-Security-Policy': "default-src 'none'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
			...headers,
		},
	});
}

// Same realm as the shared gate, so a browser keeps one login for all of /jev. Browsers that
// show the Basic prompt still do; the body is the login form, for those that don't.
const askToLogIn = (request, message, user) => {
	const url = new URL(request.url);
	return loginPage({ message, next: url.pathname + url.search, user, status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Jev", charset="UTF-8"' } });
};

// GET/POST /jev/login and /jev/logout. Runs outside the gate.
export async function handleJevLogin(request, env, now = Date.now()) {
	const url = new URL(request.url);
	const noStore = { 'Cache-Control': 'no-store' };
	if (/^\/jev\/logout\/?$/.test(url.pathname)) {
		return new Response(null, { status: 303, headers: { ...noStore, Location: '/jev/login', 'Set-Cookie': `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` } });
	}
	const message = 'Log in to see the Jev pages.';
	if (['GET', 'HEAD'].includes(request.method)) {
		return loginPage({ message, next: safeNext(url.searchParams.get('next'), url), user: url.searchParams.get('user') || VIEW_USER });
	}
	if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'GET, HEAD, POST' } });
	let form;
	try { form = await request.formData(); } catch { form = new FormData(); }
	const l = { user: norm(form.get('user') ?? ''), pass: norm(form.get('password') ?? '') };
	const next = safeNext(form.get('next'), url);
	const who = matches(l, PRIVATE_USER, env.JEV_PRIVATE_PASSWORD) ? PRIVATE_USER : matches(l, VIEW_USER, env.JEV_VIEW_PASSWORD) ? VIEW_USER : null;
	if (!who) return loginPage({ message, next, user: l.user, error: 'That username and password don’t match.', status: 401 });
	const expires = Math.floor(now / 1000) + SESSION_SECONDS;
	const value = `${who}.${expires}.${await sessionMac(who, expires, secretFor(who, env))}`;
	return new Response(null, { status: 303, headers: { ...noStore, Location: next, 'Set-Cookie': `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${SESSION_SECONDS}; HttpOnly; Secure; SameSite=Lax` } });
}

// Owner-only pages: a 401 (or 503 when unconfigured) Response, or null when Rhys may pass.
export async function privateGate(request, env) {
	if (localDev(request, env)) return null;
	if (!env.JEV_PRIVATE_PASSWORD || !norm(env.JEV_PRIVATE_PASSWORD)) {
		return new Response('Not set up: these pages need the JEV_PRIVATE_PASSWORD secret.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } });
	}
	return (await isOwner(request, env)) ? null : askToLogIn(request, 'Log in as rhys to see this page.', PRIVATE_USER);
}

function timingSafeEqual(a, b) {
	const x = new TextEncoder().encode(a);
	const y = new TextEncoder().encode(b);
	let diff = x.length ^ y.length;
	for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
	return diff === 0;
}

// The stylesheets the login form needs, so it isn't bare before you log in. Nothing private.
const LOGIN_ASSETS = new Set(['/jev/minimal.css', '/jev/login.css', '/jev/style/tokens.css']);

// Returns a 401 Response when the request must log in, or null when it may pass.
export async function jevGate(request, env) {
	// Local testing only: `wrangler pages dev` with JEV_LOCAL_DEV=1 skips the login on
	// localhost, so test browsers never need credentials in the URL. Never set in production.
	if (localDev(request, env)) return null;
	if (!env.JEV_VIEW_PASSWORD || !norm(env.JEV_VIEW_PASSWORD)) return null;
	if (LOGIN_ASSETS.has(new URL(request.url).pathname)) return null;
	const l = login(request);
	// The shared login, or the owner's (which opens everything), by prompt or by cookie.
	if (matches(l, VIEW_USER, env.JEV_VIEW_PASSWORD) || matches(l, PRIVATE_USER, env.JEV_PRIVATE_PASSWORD)) return null;
	if (await sessionUser(request, env)) return null;
	return askToLogIn(request, 'Log in to see the Jev pages.', VIEW_USER);
}

const escapeHTML = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// "/jev/docs/research/a.md" -> "research/a.md"; null if the path is not allowed.
export function docsRepoPath(pathname) {
	if (pathname !== DOCS_PREFIX && !pathname.startsWith(`${DOCS_PREFIX}/`)) return null;
	let rest;
	try { rest = decodeURIComponent(pathname.slice(DOCS_PREFIX.length)); } catch { return null; }
	const parts = rest.split('/').filter(Boolean);
	if (parts.some(p => p === '.' || p === '..' || p.startsWith('.') || !/^[\w.@+ -]+$/.test(p))) return null;
	return parts.join('/');
}

// The feedback folder page carries the corpus search: its form, styles and script are
// the ones /jev/feedback/ uses, so it needs scripts and fetches from this origin.
const FEEDBACK_SEARCH = {
	styles: ['/jev/feedback/search.css?v=fs-2'],
	scripts: ['/jev/feedback/search.js?v=fs-2'],
	html: `<section class="fs fs-embed" aria-label="Search the feedback">
<p class="fs-sub" id="corpus-meta" hidden></p>
<form class="fs-form" id="search" role="search">
<div class="fs-query">
<input id="q" name="q" type="search" placeholder="Search every post: latency, calibration, “open weights”…" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Search the corpus">
<button type="submit" class="fs-go">Search</button>
</div>
<p class="fs-help">All words must appear. <code>"exact phrase"</code>, <code>calibrat*</code>, <code>-word</code>, <code>latency OR speed</code>.</p>
<details class="fs-filters" id="filters">
<summary>Filters <span id="filter-count"></span></summary>
<div class="fs-grid">
<label class="fs-field"><span>Source</span><select id="kind" name="kind"><option value="">Everything</option></select></label>
<label class="fs-field"><span>From</span><input id="from" name="from" type="date"></label>
<label class="fs-field"><span>To</span><input id="to" name="to" type="date"></label>
<label class="fs-field"><span>Jev says it shows</span><select id="label" name="label"><option value="">Any</option></select></label>
<label class="fs-field"><span>Builder type (Jev)</span><select id="segment" name="segment"><option value="">Any</option></select></label>
<label class="fs-field"><span>Sort</span><select id="sort" name="sort">
<option value="">Default (best match, or newest)</option><option value="newest">Newest</option><option value="oldest">Oldest</option>
<option value="label">Most likely to show the label</option><option value="sentiment">Most positive (Jev)</option><option value="-sentiment">Most negative (Jev)</option>
</select></label>
<label class="fs-check"><input id="about" name="about" type="checkbox" value="1"><span>Only items Jev says are about Jev</span></label>
</div>
<button type="button" class="text-button" id="clear">Clear filters</button>
</details>
</form>
<div class="fs-try" id="try">Try: <button type="button" data-q="&quot;question engineering&quot;">“question engineering”</button><button type="button" data-q="latency OR slow">latency OR slow</button><button type="button" data-label="pain_trust" data-about="1">doubts about calibration</button><button type="button" data-label="in_production" data-about="1">running in production</button><button type="button" data-q="open weights" data-kind="hn">open weights on HN</button></div>
<p class="fs-status" id="status" aria-live="polite"></p>
<ol class="fs-results" id="results"></ol>
<button type="button" class="fs-more" id="more" hidden>More results</button>
</section>`,
};

function page(title, crumbs, body, status = 200, { styles = [], scripts = [] } = {}) {
	const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHTML(title)} · Jev</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="/jev/minimal.css?v=jev-1"><link rel="stylesheet" href="/jev/docs.css?v=jev-charts-1">${styles.map(h => `<link rel="stylesheet" href="${h}">`).join('')}</head>
<body><div class="shell"><header><a href="/">Rhys / AI</a><a href="/jev">Jev</a>${crumbs}</header>
<main class="doc">${body}</main></div>${scripts.map(s => `<script src="${s}" defer></script>`).join('')}</body></html>`;
	const scriptCSP = scripts.length ? " script-src 'self'; connect-src 'self';" : '';
	return new Response(html, {
		status,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'private, no-store',
			'X-Robots-Tag': 'noindex',
			'Referrer-Policy': 'no-referrer',
			'Content-Security-Policy': `default-src 'none';${scriptCSP} style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
		},
	});
}

function crumbsFor(repoPath) {
	const parts = repoPath ? repoPath.split('/') : [];
	let href = DOCS_PREFIX;
	const links = [`<a href="${DOCS_PREFIX}/">Files</a>`];
	parts.forEach((p, i) => {
		href += `/${encodeURIComponent(p)}`;
		links.push(i === parts.length - 1 ? `<span>${escapeHTML(p)}</span>` : `<a href="${href}/">${escapeHTML(p)}</a>`);
	});
	return `<nav class="crumbs">${links.join(' / ')}</nav>`;
}

function decodeBase64UTF8(b64) {
	const bin = atob(b64.replace(/\s/g, ''));
	return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}

export async function serveJevDocs(request, env, fetchImpl = fetch) {
	const url = new URL(request.url);
	const repoPath = docsRepoPath(url.pathname);
	if (repoPath === null) return page('Not found', '', '<h1>Not found</h1>', 404);
	if (!env.JEV_VIEW_PASSWORD || !env.JEV_GITHUB_TOKEN) {
		return page('Not set up', '', '<h1>Not set up yet</h1><p>These pages need the JEV_VIEW_PASSWORD and JEV_GITHUB_TOKEN secrets.</p>', 503);
	}

	const contents = path => fetchImpl(`https://api.github.com/repos/${REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=main`, {
		headers: {
			Authorization: `Bearer ${env.JEV_GITHUB_TOKEN}`,
			Accept: 'application/vnd.github+json',
			'User-Agent': 'ai-rhyslindmark-jev-docs',
			'X-GitHub-Api-Version': '2022-11-28',
		},
	});
	const res = await contents(repoPath);
	if (res.status === 404) return page('Not found', crumbsFor(repoPath), '<h1>Not found</h1>', 404);
	if (!res.ok) return page('Unavailable', crumbsFor(repoPath), `<h1>Couldn’t load this</h1><p>GitHub answered ${res.status}.</p>`, 502);
	const data = await res.json();

	if (Array.isArray(data)) {
		if (!url.pathname.endsWith('/')) {
			url.pathname += '/';
			return Response.redirect(url.toString(), 308);
		}
		// Owner-only files don't show up in listings for anyone else.
		const owner = (await isOwner(request, env)) || localDev(request, env);
		const items = data
			.filter(item => !item.name.startsWith('.'))
			.filter(item => owner || !isPrivateDoc(repoPath ? `${repoPath}/${item.name}` : item.name))
			.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
			.map(item => {
				const href = encodeURIComponent(item.name) + (item.type === 'dir' ? '/' : '');
				return `<li><a href="${href}">${escapeHTML(item.name)}${item.type === 'dir' ? '/' : ''}</a></li>`;
			}).join('');
		const join = name => (repoPath ? `${repoPath}/${name}` : name);
		let readme = '';
		let readmeTitle = '';
		const readmeItem = data.find(item => item.type === 'file' && /^readme\.md$/i.test(item.name));
		if (readmeItem) {
			const r = await contents(join(readmeItem.name));
			if (r.ok) {
				const f = await r.json();
				if (f.content) {
					const { title: t, rest } = splitTitle(decodeBase64UTF8(f.content));
					readmeTitle = t;
					readme = `<article class="markdown">${marked.parse(rest)}</article>`;
				}
			}
		}
		// A folder holding a corpus (data/stats.json, as feedback/ does) leads with its numbers.
		let corpus = '';
		if (data.some(item => item.type === 'dir' && item.name === 'data')) {
			const r = await contents(join('data/stats.json'));
			if (r.ok) {
				try {
					const f = await r.json();
					corpus = corpusBlock(JSON.parse(decodeBase64UTF8(f.content)));
				} catch {}
			}
		}
		const title = repoPath ? repoPath.split('/').pop() : 'jev';
		const head = docHead('folder', readmeTitle ? marked.parseInline(readmeTitle) : escapeHTML(title));
		// The feedback corpus is the numbers, then the search, and nothing else.
		if (repoPath === 'feedback') {
			return page(readmeTitle || title, crumbsFor(repoPath), `${head}${corpus}${FEEDBACK_SEARCH.html}`, 200, FEEDBACK_SEARCH);
		}
		return page(readmeTitle || title, crumbsFor(repoPath), `${head}${corpus}${readme}<ul class="listing">${items}</ul>`);
	}

	if (url.pathname.endsWith('/')) {
		url.pathname = url.pathname.replace(/\/+$/, '');
		return Response.redirect(url.toString(), 308);
	}
	const name = data.name || repoPath.split('/').pop();
	if (!data.content) {
		return page(name, crumbsFor(repoPath), `${docHead('file', escapeHTML(name))}<p>This file is too large to show here (${Math.round((data.size || 0) / 1e6)} MB).</p>`);
	}
	const text = decodeBase64UTF8(data.content);
	// Standalone HTML pages in the repo (e.g. research write-ups) render as they are.
	// Inline scripts and styles may run; nothing may load or call out except fonts.
	if (/\.html?$/i.test(name)) {
		return new Response(text, {
			headers: {
				'Content-Type': 'text/html; charset=utf-8',
				'Cache-Control': 'private, no-store',
				'X-Robots-Tag': 'noindex',
				'Referrer-Policy': 'no-referrer',
				'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
			},
		});
	}
	const tag = repoPath.includes('/') ? repoPath.split('/').slice(-2, -1)[0] : 'jev';
	if (/\.md$/i.test(name)) {
		const { title, rest } = splitTitle(text);
		const head = docHead(tag, title ? marked.parseInline(title) : escapeHTML(name));
		return page(title || name, crumbsFor(repoPath), `${head}<article class="markdown">${marked.parse(rest)}</article>`);
	}
	return page(name, crumbsFor(repoPath), `${docHead(tag, escapeHTML(name))}<pre class="file">${escapeHTML(text)}</pre>`);
}

// A centered header like typesafe.ai's blog: a mono tag, then the title in display type.
function docHead(tag, titleHTML) {
	return `<header class="doc-head"><span class="doc-tag">${escapeHTML(tag)}</span><h1 class="doc-title">${titleHTML}</h1></header>`;
}

// The corpus at a glance, from data/stats.json: headline counts, items per week, items per source.
// The page's CSP allows no inline styles or scripts, so charts are plain SVG with <title> tooltips.
const SOURCE_LABELS = {
	'github/pr': 'GitHub pull requests', 'github/issue': 'GitHub issues', 'github/repo': 'Repos built on Jev',
	'github/comment': 'GitHub comments', 'hn/comment': 'Hacker News comments', 'hn/story': 'Hacker News stories',
	'x/post': 'X posts', 'web/x-post': 'X posts', 'web/x-article': 'X posts', 'discord/message': 'Discord messages',
};

export function corpusBlock(stats) {
	if (!stats || !Number.isFinite(stats.total)) return '';
	const fmt = n => Math.round(n).toLocaleString('en-US');
	const short = n => (n >= 1000 ? `${+(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n));

	const kinds = Object.entries(stats.by_source_kind || {});
	const sources = {};
	for (const [kind, n] of kinds) {
		const label = SOURCE_LABELS[kind] || (kind.startsWith('web/') ? 'Web: reviews, papers, posts' : kind);
		sources[label] = (sources[label] || 0) + n;
	}
	const sourceRows = Object.entries(sources).sort((a, b) => b[1] - a[1]);
	const platforms = new Set(kinds.map(([k]) => (k.startsWith('web/x-') ? 'x' : k.split('/')[0])));

	const weeks = Object.entries(stats.by_week || {}).sort((a, b) => a[0].localeCompare(b[0]));
	// Start at the launch week (Sep 14, 2026); the near-empty weeks before it fold into the note.
	const LAUNCH_WEEK = Date.UTC(2026, 8, 14);
	const firstShown = Math.max(weeks.length - 16, weeks.findIndex(([wk]) => (isoWeekStart(wk)?.getTime() ?? -Infinity) >= LAUNCH_WEEK));
	const cut = firstShown < 0 ? Math.max(0, weeks.length - 16) : firstShown;
	const shown = weeks.slice(cut);
	const earlier = weeks.slice(0, cut).reduce((s, [, n]) => s + n, 0);
	const built = stats.built_at ? new Date(stats.built_at) : null;
	const day = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

	const tiles = [
		[fmt(stats.total), 'items'],
		Number.isFinite(stats.unique_authors) ? [fmt(stats.unique_authors), 'authors'] : null,
		[String(platforms.size), 'platforms'],
		built ? [day(built), 'last refresh'] : null,
	].filter(Boolean).map(([v, k]) => `<div class="corpus-stat"><span class="corpus-num">${escapeHTML(v)}</span><span class="corpus-key">${escapeHTML(k)}</span></div>`).join('');

	// Weekly volume: one series, ink bars with 4px rounded tops on the baseline.
	let weekly = '';
	if (shown.length) {
		const W = 720, H = 220, L = 44, R = 8, T = 16, B = 28;
		const max = Math.max(...shown.map(([, n]) => n));
		const step = niceStep(max / 3);
		const top = Math.ceil(max / step) * step;
		const y = n => T + (H - T - B) * (1 - n / top);
		const slot = (W - L - R) / shown.length, bw = Math.max(4, slot - 6);
		let grid = '';
		for (let v = 0; v <= top; v += step) grid += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="tick" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`;
		const peak = shown.reduce((a, b) => (b[1] > a[1] ? b : a));
		const bars = shown.map(([wk, n], i) => {
			const x = L + i * slot + (slot - bw) / 2, start = isoWeekStart(wk);
			const label = start ? `Week of ${day(start)}` : wk;
			const partial = i === shown.length - 1 && built && start && built - start < 6 * 864e5 ? ' (week in progress)' : '';
			const xl = i % 2 === 0 ? `<text class="tick" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${escapeHTML(start ? day(start) : wk)}</text>` : '';
			const pk = wk === peak[0] ? `<text class="peak" x="${x + bw / 2}" y="${y(n) - 6}" text-anchor="middle">${fmt(n)}</text>` : '';
			return `<g class="bar"><title>${escapeHTML(label)}: ${fmt(n)} items${partial}</title><rect class="hit" x="${L + i * slot}" y="${T}" width="${slot}" height="${H - T - B}"/>${roundedBar(x, y(n), bw, H - B - y(n))}${pk}${xl}</g>`;
		}).join('');
		const note = earlier ? `<p class="corpus-note">Items per week. ${fmt(earlier)} items from before the September 15 launch are left off.</p>` : '<p class="corpus-note">Items per week.</p>';
		weekly = `<figure class="corpus-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Items collected per week">${grid}${bars}</svg>${note}</figure>`;
	}

	// By source: one horizontal bar per source, value at the end.
	let bySource = '';
	if (sourceRows.length) {
		const W = 720, row = 30, LBL = 210, R = 64, H = sourceRows.length * row;
		const max = sourceRows[0][1];
		const rows = sourceRows.map(([label, n], i) => {
			const yy = i * row, w = Math.max(2, (W - LBL - R) * n / max);
			return `<g class="bar"><title>${escapeHTML(label)}: ${fmt(n)}</title><rect class="hit" x="0" y="${yy}" width="${W}" height="${row}"/><text class="src" x="0" y="${yy + 19}">${escapeHTML(label)}</text>${roundedBar(LBL, yy + 8, w, 14, 'h')}<text class="val" x="${LBL + w + 8}" y="${yy + 19}">${fmt(n)}</text></g>`;
		}).join('');
		bySource = `<figure class="corpus-chart"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Items by source">${rows}</svg><p class="corpus-note">Items by source.</p></figure>`;
	}

	return `<section class="corpus" aria-label="Corpus at a glance"><div class="corpus-stats">${tiles}</div>${weekly}${bySource}</section>`;
}

// A bar whose far end is rounded (4px) and whose base is square on the axis.
function roundedBar(x, y, w, h, dir = 'v') {
	if (dir === 'v') {
		const r = Math.min(4, w / 2, h);
		return `<path class="mark" d="M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z"/>`;
	}
	const r = Math.min(4, h / 2, w);
	return `<path class="mark" d="M${x},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h - r}Q${x + w},${y + h} ${x + w - r},${y + h}H${x}Z"/>`;
}

function niceStep(raw) {
	const p = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
	return [1, 2, 2.5, 5, 10].map(m => m * p).find(s => s >= raw);
}

// "2026-W38" -> the Monday that starts that ISO week (UTC).
function isoWeekStart(wk) {
	const m = /^(\d{4})-W(\d{2})$/.exec(wk);
	if (!m) return null;
	const jan4 = new Date(Date.UTC(+m[1], 0, 4));
	const mon1 = new Date(jan4 - ((jan4.getUTCDay() + 6) % 7) * 864e5);
	return new Date(+mon1 + (+m[2] - 1) * 7 * 864e5);
}

// Pull a leading "# Title" out of markdown so the page can set it as its header.
export function splitTitle(text) {
	const m = text.match(/^\s*# (.+)\n?/);
	return m ? { title: m[1].trim(), rest: text.slice(m[0].length) } : { title: '', rest: text };
}
