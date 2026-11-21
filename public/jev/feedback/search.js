// Search page for the Jev feedback corpus. Talks to /jev/feedback/search (functions/jev/feedback/search.js).
// Builds every node with textContent; snippets mark matches with \u0002 … \u0003 from FTS5.
(() => {
	const $ = id => document.getElementById(id);
	const form = $('search'), resultsEl = $('results'), statusEl = $('status'), moreBtn = $('more');
	const FIELDS = ['q', 'kind', 'from', 'to', 'label', 'segment', 'sort'];

	const LABEL_NAMES = {
		author_builds_with_jev: 'Builds with Jev', in_production: 'In production',
		use_classify: 'Use: classify', use_route: 'Use: route', use_rank_score: 'Use: rank or score',
		use_eval_judge: 'Use: eval judge', use_agent_control: 'Use: agent control',
		love_typed: 'Loves: typed answers', love_speed: 'Loves: speed', love_price: 'Loves: price',
		pain_wrong_answers: 'Pain: wrong answers', pain_question_design: 'Pain: question design',
		pain_trust: 'Pain: trust in probabilities', pain_unclear_use: 'Pain: unclear what it’s for',
		pain_closed_hosted: 'Pain: closed or hosted-only', pain_sdk_api: 'Pain: SDK, API or docs', pain_limits: 'Pain: hits a limit',
	};
	const SEGMENT_NAMES = {
		agent_or_coding_tool_builder: 'Agent or coding-tool builder', production_pipeline_team: 'Production pipeline team',
		framework_or_platform_integrator: 'Framework or platform integrator', eval_or_research: 'Eval or research', maker_or_hobbyist: 'Maker or hobbyist',
	};
	const KIND_NAMES = {
		'github/pr': 'GitHub PR', 'github/issue': 'GitHub issue', 'github/comment': 'GitHub comment', 'github/repo': 'GitHub repo',
		'hn/story': 'HN story', 'hn/comment': 'HN comment', 'x/post': 'X post', 'discord/message': 'Discord',
	};
	const SOURCE_NAMES = { github: 'GitHub', hn: 'Hacker News', x: 'X', web: 'Web', discord: 'Discord', reddit: 'Reddit' };
	const kindName = (s, k) => KIND_NAMES[`${s}/${k}`] || (s === 'web' ? `Web: ${k.replace(/-/g, ' ')}` : `${s} ${k}`);
	const fmt = n => Number(n).toLocaleString('en-US');
	const day = iso => {
		const d = new Date(iso);
		return isNaN(d) ? '' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
	};
	const el = (tag, cls, text) => {
		const n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	};
	const option = (value, text, parent) => { const o = el('option', null, text); o.value = value; parent.append(o); };

	let offset = 0, lastParams = null, busy = false;

	function paramsFromForm() {
		const p = new URLSearchParams();
		for (const f of FIELDS) { const v = $(f).value.trim(); if (v) p.set(f, v); }
		if ($('about').checked) p.set('about', '1');
		return p;
	}
	function formFromParams(p) {
		for (const f of FIELDS) $(f).value = p.get(f) || '';
		$('about').checked = p.get('about') === '1';
		const n = ['kind', 'from', 'to', 'label', 'segment', 'sort', 'about'].filter(f => p.get(f)).length;
		$('filter-count').textContent = n ? `(${n})` : '';
		if (n) $('filters').open = true;
	}

	function snippetNode(text) {
		const p = el('p', 'fs-snippet');
		const parts = String(text).replace(/\s+/g, ' ').split(/([\u0002\u0003])/);
		let inMark = false;
		for (const part of parts) {
			if (part === '\u0002') { inMark = true; continue; }
			if (part === '\u0003') { inMark = false; continue; }
			if (part) p.append(inMark ? el('mark', null, part) : document.createTextNode(part));
		}
		return p;
	}

	function card(r) {
		const li = el('li', 'fs-item');
		const meta = el('div', 'fs-meta');
		meta.append(el('span', 'fs-kind', kindName(r.source, r.kind)));
		if (r.author) meta.append(el('span', null, r.author));
		if (r.created_at) meta.append(el('span', null, day(r.created_at)));
		li.append(meta);
		const title = r.title || (r.snippet ? '' : r.id);
		const safeURL = /^https?:\/\//i.test(r.url || '') ? r.url : '';
		if (title) {
			const h = el('h2', 'fs-item-title');
			if (safeURL) { const a = el('a', null, title); a.href = safeURL; a.target = '_blank'; a.rel = 'noopener noreferrer'; h.append(a); }
			else h.textContent = title;
			li.append(h);
		}
		if (r.snippet) li.append(snippetNode(r.snippet));
		const tags = el('div', 'fs-tags');
		if (r.about_jev != null && r.about_jev < 0.3) tags.append(el('span', 'fs-chip fs-chip-dim', 'Jev: not about Jev'));
		if (r.segment) tags.append(el('span', 'fs-chip', SEGMENT_NAMES[r.segment] || r.segment));
		for (const [k, p] of Object.entries(r.labels || {}).sort((a, b) => b[1] - a[1])) {
			const c = el('span', k.startsWith('pain') ? 'fs-chip fs-chip-pain' : 'fs-chip', LABEL_NAMES[k] || k);
			c.title = `Jev: ${Math.round(p * 100)}%`;
			tags.append(c);
		}
		if (r.sentiment != null) tags.append(el('span', 'fs-chip fs-chip-dim', `Sentiment ${r.sentiment.toFixed(1)} / 4`));
		if (tags.childNodes.length) li.append(tags);
		if (safeURL) {
			const a = el('a', 'fs-open', `Open on ${SOURCE_NAMES[r.source] || new URL(safeURL).hostname} ↗`);
			a.href = safeURL; a.target = '_blank'; a.rel = 'noopener noreferrer';
			li.append(a);
		}
		return li;
	}

	async function run(params, append = false) {
		if (busy) return;
		busy = true;
		const p = new URLSearchParams(params);
		if (append) p.set('offset', String(offset)); else offset = 0;
		if (!append) {
			history.replaceState(null, '', params.toString() ? `?${params}` : location.pathname);
			if (!params.toString()) { resultsEl.replaceChildren(); statusEl.textContent = ''; moreBtn.hidden = true; $('try').hidden = false; busy = false; return; }
			statusEl.textContent = 'Searching…';
		}
		moreBtn.disabled = true;
		try {
			const res = await fetch(`/jev/feedback/search?${p}`, { headers: { Accept: 'application/json' } });
			const data = await res.json();
			if (!res.ok) throw new Error(data.error || `Search failed (${res.status})`);
			if (!append) resultsEl.replaceChildren();
			for (const r of data.results) resultsEl.append(card(r));
			offset = data.offset + data.results.length;
			lastParams = params;
			statusEl.textContent = data.total
				? `${fmt(data.total)} item${data.total === 1 ? '' : 's'}${offset < data.total ? `, showing ${fmt(offset)}` : ''}`
				: 'No items match. Try fewer words or clear the filters.';
			moreBtn.hidden = !data.more;
			$('try').hidden = true;
		} catch (err) {
			statusEl.textContent = err.message;
		} finally {
			busy = false;
			moreBtn.disabled = false;
		}
	}

	async function loadMeta() {
		try {
			const res = await fetch('/jev/feedback/search?meta=1');
			if (!res.ok) return;
			const m = await res.json();
			const kindSel = $('kind'), current = new URLSearchParams(location.search).get('kind');
			const bySource = {};
			for (const [sk, n] of Object.entries(m.kinds || {})) {
				const [s] = sk.split('/');
				(bySource[s] ||= []).push([sk, n]);
			}
			for (const [s, list] of Object.entries(bySource).sort((a, b) => b[1].reduce((t, x) => t + x[1], 0) - a[1].reduce((t, x) => t + x[1], 0))) {
				const total = list.reduce((t, x) => t + x[1], 0);
				option(s, `${SOURCE_NAMES[s] || s} (${fmt(total)})`, kindSel);
				if (list.length > 1) for (const [sk, n] of list.sort((a, b) => b[1] - a[1])) option(sk, `  ${kindName(...sk.split('/'))} (${fmt(n)})`, kindSel);
			}
			if (current) kindSel.value = current;
			if (m.total) {
				const when = m.uploaded_at ? `, updated ${day(m.uploaded_at)}` : '';
				$('corpus-meta').textContent = `${fmt(m.total)} things people have said about Jev since launch, ${fmt(m.labeled)} of them read and labeled by Jev${when}.`;
			}
		} catch {}
	}

	// Static choices: label and segment names are known here, not fetched.
	const labelSel = $('label');
	const groups = { 'Who': ['author_builds_with_jev', 'in_production'], 'Uses': [], 'Loves': [], 'Pains': [] };
	for (const k of Object.keys(LABEL_NAMES)) {
		if (k.startsWith('use_')) groups.Uses.push(k); else if (k.startsWith('love_')) groups.Loves.push(k); else if (k.startsWith('pain_')) groups.Pains.push(k);
	}
	for (const [g, keys] of Object.entries(groups)) {
		const og = document.createElement('optgroup'); og.label = g;
		for (const k of keys) option(k, LABEL_NAMES[k].replace(/^(Use|Loves|Pain): /, ''), og);
		labelSel.append(og);
	}
	for (const [k, v] of Object.entries(SEGMENT_NAMES)) option(k, v, $('segment'));

	form.addEventListener('submit', e => { e.preventDefault(); $('q').blur(); formFromParams(paramsFromForm()); run(paramsFromForm()); });
	for (const id of ['kind', 'from', 'to', 'label', 'segment', 'sort', 'about']) $(id).addEventListener('change', () => { formFromParams(paramsFromForm()); run(paramsFromForm()); });
	moreBtn.addEventListener('click', () => lastParams && run(lastParams, true));
	$('clear').addEventListener('click', () => { const p = new URLSearchParams(); const q = $('q').value.trim(); if (q) p.set('q', q); formFromParams(p); run(p); });
	$('try').addEventListener('click', e => {
		const b = e.target.closest('button');
		if (!b) return;
		const p = new URLSearchParams();
		for (const k of ['q', 'kind', 'label', 'about']) if (b.dataset[k]) p.set(k, b.dataset[k]);
		formFromParams(p);
		run(p);
	});

	const initial = new URLSearchParams(location.search);
	formFromParams(initial);
	loadMeta();
	if ([...initial.keys()].length) run(initial);
	else if (matchMedia('(hover: hover)').matches) $('q').focus({ preventScroll: true }); // no keyboard pop-up on phones
})();
