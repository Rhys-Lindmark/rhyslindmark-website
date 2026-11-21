// Shared-login gate for ai.rhyslindmark.com/jev/*, plus /jev/docs/*, which renders
// files from the private GitHub repo Rhys-Lindmark/jev for logged-in viewers.
//
// Secrets (Cloudflare Pages, set by the owner, never in source):
//   JEV_VIEW_PASSWORD  the shared password; the username is always "jev".
//                      Unset: /jev stays public as before and /jev/docs is off.
//   JEV_GITHUB_TOKEN   fine-grained token, Contents: read-only on Rhys-Lindmark/jev.
import { marked } from 'marked';

export const VIEW_USER = 'jev';
const REPO = 'Rhys-Lindmark/jev';
const DOCS_PREFIX = '/jev/docs';

function timingSafeEqual(a, b) {
	const x = new TextEncoder().encode(a);
	const y = new TextEncoder().encode(b);
	let diff = x.length ^ y.length;
	for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
	return diff === 0;
}

// Returns a 401 Response when the request must log in, or null when it may pass.
export function jevGate(request, env) {
	// Forgiving on purpose: a shared, spoken password. Phones capitalize the first
	// letter and pasted values carry stray spaces, so compare trimmed and lowercased.
	const norm = s => String(s).trim().toLowerCase();
	const password = env.JEV_VIEW_PASSWORD ? norm(env.JEV_VIEW_PASSWORD) : '';
	if (!password) return null;
	const header = request.headers.get('authorization') || '';
	const match = header.match(/^Basic\s+([A-Za-z0-9+/=]+)$/i);
	if (match) {
		let decoded = '';
		try { decoded = new TextDecoder().decode(Uint8Array.from(atob(match[1]), c => c.charCodeAt(0))); } catch {}
		const sep = decoded.indexOf(':');
		if (sep > 0 && timingSafeEqual(norm(decoded.slice(0, sep)), VIEW_USER) && timingSafeEqual(norm(decoded.slice(sep + 1)), password)) return null;
	}
	return new Response('Log in to see the Jev pages.', {
		status: 401,
		headers: {
			'WWW-Authenticate': 'Basic realm="Jev", charset="UTF-8"',
			'Content-Type': 'text/plain; charset=utf-8',
			'Cache-Control': 'no-store',
			'X-Robots-Tag': 'noindex',
		},
	});
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

function page(title, crumbs, body, status = 200) {
	const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escapeHTML(title)} · Jev</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="/jev/minimal.css?v=jev-1"><link rel="stylesheet" href="/jev/docs.css?v=jev-1"></head>
<body><div class="shell"><header><a href="/">Rhys / AI</a><a href="/jev">Jev</a>${crumbs}</header>
<main class="doc">${body}</main></div></body></html>`;
	return new Response(html, {
		status,
		headers: {
			'Content-Type': 'text/html; charset=utf-8',
			'Cache-Control': 'private, no-store',
			'X-Robots-Tag': 'noindex',
			'Referrer-Policy': 'no-referrer',
			'Content-Security-Policy': "default-src 'none'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
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
		const items = data
			.filter(item => !item.name.startsWith('.'))
			.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))
			.map(item => {
				const href = encodeURIComponent(item.name) + (item.type === 'dir' ? '/' : '');
				return `<li><a href="${href}">${escapeHTML(item.name)}${item.type === 'dir' ? '/' : ''}</a></li>`;
			}).join('');
		let readme = '';
		const readmeItem = data.find(item => item.type === 'file' && /^readme\.md$/i.test(item.name));
		if (readmeItem) {
			const r = await contents(repoPath ? `${repoPath}/${readmeItem.name}` : readmeItem.name);
			if (r.ok) {
				const f = await r.json();
				if (f.content) readme = `<article class="markdown">${marked.parse(decodeBase64UTF8(f.content))}</article>`;
			}
		}
		const title = repoPath || 'Files';
		return page(title, crumbsFor(repoPath), `<ul class="listing">${items}</ul>${readme}`);
	}

	if (url.pathname.endsWith('/')) {
		url.pathname = url.pathname.replace(/\/+$/, '');
		return Response.redirect(url.toString(), 308);
	}
	const name = data.name || repoPath.split('/').pop();
	if (!data.content) {
		return page(name, crumbsFor(repoPath), `<h1>${escapeHTML(name)}</h1><p>This file is too large to show here (${Math.round((data.size || 0) / 1e6)} MB).</p>`);
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
	const body = /\.md$/i.test(name)
		? `<article class="markdown">${marked.parse(text)}</article>`
		: `<h1>${escapeHTML(name)}</h1><pre class="file">${escapeHTML(text)}</pre>`;
	return page(name, crumbsFor(repoPath), body);
}
