// Tabs for /jev/style: Preview, or the raw text of one of the system's files.
const tabs = [...document.querySelectorAll('[role="tab"]')];
const preview = document.getElementById('preview');
const source = document.getElementById('source');
const sourceName = document.getElementById('source-name');
const sourceText = document.getElementById('source-text');
const download = document.getElementById('download');
const copy = document.getElementById('copy');
const cache = new Map();

async function show(name) {
	tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
	if (name === 'preview') {
		preview.hidden = false;
		source.hidden = true;
		return;
	}
	preview.hidden = true;
	source.hidden = false;
	sourceName.textContent = name;
	download.href = `/jev/style/${name}`;
	download.setAttribute('download', name);
	if (!cache.has(name)) {
		sourceText.textContent = 'Loading…';
		try {
			const res = await fetch(`/jev/style/${name}?v=jev-1`, { cache: 'no-cache' });
			cache.set(name, res.ok ? await res.text() : `Couldn’t load ${name} (${res.status}).`);
		} catch {
			cache.set(name, `Couldn’t load ${name}.`);
		}
	}
	sourceText.textContent = cache.get(name);
}

tabs.forEach(t => t.addEventListener('click', () => show(t.dataset.tab)));
copy.addEventListener('click', async () => {
	try {
		await navigator.clipboard.writeText(sourceText.textContent);
		copy.textContent = 'Copied';
		setTimeout(() => { copy.textContent = 'Copy'; }, 1500);
	} catch {}
});
