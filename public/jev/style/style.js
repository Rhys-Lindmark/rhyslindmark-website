// The code panel on /jev/style: one tab per file in the system, with light
// syntax colouring (headings, quotes, comments, strings) and copy/download.
const tabs = [...document.querySelectorAll('[role="tab"]')];
const sourceName = document.getElementById('source-name');
const sourceText = document.getElementById('source-text');
const download = document.getElementById('download');
const downloadExt = document.getElementById('download-ext');
const copy = document.getElementById('copy');
const cache = new Map();

const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

function highlight(name, text) {
	const lines = esc(text).split('\n');
	if (name.endsWith('.md')) {
		return lines.map(l =>
			/^#{1,6} /.test(l) ? `<span class="hl-h">${l}</span>`
			: /^&gt; /.test(l) ? `<span class="hl-q">${l}</span>`
			: /^\|/.test(l) ? `<span class="hl-t">${l}</span>`
			: l.replace(/`([^`]+)`/g, '<span class="hl-s">`$1`</span>').replace(/\*\*([^*]+)\*\*/g, '<b>**$1**</b>')
		).join('\n');
	}
	if (name.endsWith('.json')) {
		return lines.map(l => l
			.replace(/("[^"]+")(\s*:)/g, '<span class="hl-k">$1</span>$2')
			.replace(/(:\s*)("[^"]*")/g, '$1<span class="hl-s">$2</span>')).join('\n');
	}
	// CSS: comments (which may span lines), custom properties, at-rules.
	let inComment = false;
	return lines.map(l => {
		const start = inComment ? 0 : l.indexOf('/*');
		if (start < 0) {
			return l.replace(/(--[\w-]+)(\s*:)/g, '<span class="hl-k">$1</span>$2').replace(/(@[\w-]+)/g, '<span class="hl-h">$1</span>');
		}
		const end = l.indexOf('*/', start);
		inComment = end < 0;
		const stop = end < 0 ? l.length : end + 2;
		const code = l.slice(0, start).replace(/(--[\w-]+)(\s*:)/g, '<span class="hl-k">$1</span>$2');
		return `${code}<span class="hl-c">${l.slice(start, stop)}</span>${l.slice(stop)}`;
	}).join('\n');
}

async function show(name) {
	tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
	sourceName.textContent = name;
	download.href = `/jev/style/${name}`;
	download.setAttribute('download', name);
	downloadExt.textContent = name.slice(name.lastIndexOf('.'));
	if (!cache.has(name)) {
		sourceText.textContent = 'Loading…';
		try {
			const res = await fetch(`/jev/style/${name}?v=jev-1`, { cache: 'no-cache' });
			cache.set(name, res.ok ? await res.text() : `Couldn’t load ${name} (${res.status}).`);
		} catch {
			cache.set(name, `Couldn’t load ${name}.`);
		}
	}
	sourceText.innerHTML = highlight(name, cache.get(name));
	sourceText.scrollTop = 0;
}

tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
show('DESIGN.md');
copy.addEventListener('click', async () => {
	try {
		await navigator.clipboard.writeText(cache.get(sourceName.textContent) || sourceText.textContent);
		copy.textContent = 'Copied';
		setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
	} catch {}
});
