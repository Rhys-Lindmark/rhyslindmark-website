// Made with Jev: builder posts from the X corpus, read from /jev/made-with-jev/posts.
// State lives in the URL (?use=, ?all=1, ?author=) so a filtered view can be linked.
(() => {
	const API = '/jev/made-with-jev/posts';
	const USES = [
		['', 'All'], ['classify', 'Classify'], ['route', 'Route'], ['rank_score', 'Rank and score'],
		['eval_judge', 'Judge and eval'], ['agent_control', 'Agent control'], ['production', 'In production'],
	];
	const USE_TAG = Object.fromEntries(USES.slice(1));
	// madewithjev.com's sitemap: its newest /builds/ page is dated Oct 15 (checked Nov 24).
	const THEIR_LAST = '2026-10-15';

	const $ = id => document.getElementById(id);
	const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
	const fmt = (iso, year) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC', ...(year ? { year: 'numeric' } : {}) });
	const DAY = 864e5;

	const params = new URLSearchParams(location.search);
	const state = { use: params.get('use') || '', all: params.get('all') === '1', author: params.get('author') || '', offset: 0 };
	let meta = null, loading = false;

	function query(extra = {}) {
		const q = new URLSearchParams();
		if (state.use) q.set('use', state.use);
		if (state.all) q.set('all', '1');
		if (state.author) q.set('author', state.author);
		for (const [k, v] of Object.entries(extra)) q.set(k, v);
		return q;
	}
	function syncURL() {
		const q = query();
		history.replaceState(null, '', q.toString() ? `?${q}` : location.pathname);
	}

	// --- stats and chart, from the first answer's meta ---------------------------------
	function stat(label, value) {
		const d = el('div'); d.append(el('dt', '', label), el('dd', '', value)); return d;
	}
	function drawMeta(body) {
		const days = body.meta.days;
		const newest = days.length ? days[days.length - 1].d : null;
		$('stats').replaceChildren(
			stat('Builder posts', body.meta.posts.toLocaleString()),
			stat('Builders', body.meta.builders.toLocaleString()),
			stat('Newest post', newest ? fmt(newest) : '–'),
			stat('Corpus updated', body.meta.uploaded_at ? fmt(body.meta.uploaded_at) : '–'),
		);
		drawChart(days);
		for (const b of $('uses').children) {
			const n = b.dataset.use ? body.meta.uses[b.dataset.use] : body.meta.posts;
			if (n != null) b.textContent = `${USES.find(u => u[0] === b.dataset.use)[1]} ${n.toLocaleString()}`;
		}
	}
	function monday(t) { const d = new Date(t); return t - ((d.getUTCDay() + 6) % 7) * DAY; }
	function drawChart(days) {
		const chart = $('chart');
		if (!days.length) { chart.textContent = 'No posts yet.'; return; }
		const first = monday(Date.parse(days[0].d)), lastDay = Date.parse(days[days.length - 1].d);
		const weeks = [];
		for (let t = first; t <= lastDay; t += 7 * DAY) weeks.push({ t, n: 0 });
		for (const { d, n } of days) weeks[Math.floor((Date.parse(d) - first) / (7 * DAY))].n += n;
		const max = Math.max(...weeks.map(w => w.n));
		const partial = lastDay < weeks[weeks.length - 1].t + 6 * DAY;
		chart.replaceChildren(...weeks.map((w, i) => {
			const col = el('div', `mw-week${partial && i === weeks.length - 1 ? ' partial' : ''}`);
			const bar = el('i'); bar.style.height = `calc(${(w.n / max) * 100}% - 15px)`; // room for the count above it
			col.title = `Week of ${fmt(w.t)}: ${w.n} posts`;
			col.append(el('b', '', w.n), bar);
			return col;
		}));
		const theirs = Date.parse(THEIR_LAST);
		if (theirs >= first && theirs <= lastDay) {
			const mark = el('div', 'mw-mark');
			const pos = (theirs - first + DAY / 2) / (7 * DAY) / weeks.length * 100;
			mark.style.left = `${pos}%`;
			mark.append(el('span', '', `madewithjev.com’s\nnewest build, ${fmt(THEIR_LAST)}`));
			chart.append(mark);
		}
		const axis = el('div', 'mw-axis');
		axis.append(...weeks.map(w => el('span', '', fmt(w.t))));
		chart.after(axis);
		// Keep the marker label and the last dates inside the chart on narrow screens.
		const fit = () => {
			const right = chart.getBoundingClientRect().right;
			const mark = chart.querySelector('.mw-mark');
			if (mark) {
				mark.classList.remove('flip');
				if (mark.firstChild.getBoundingClientRect().right > right) mark.classList.add('flip');
			}
			for (const s of axis.children) {
				s.style.direction = '';
				if (s.getBoundingClientRect().left + s.scrollWidth > right) s.style.direction = 'rtl';
			}
		};
		fit();
		document.fonts?.ready.then(fit); // the mono font widens the labels when it arrives
		addEventListener('resize', fit);
		$('chart').setAttribute('aria-label', `Builder posts per week, ${weeks.map(w => `${fmt(w.t)}: ${w.n}`).join('; ')}`);
		$('chart-note').textContent = `Weeks start Monday. ${partial ? `The last bar is a part week, to ${fmt(lastDay)}.` : ''}`;
	}

	// --- cards -------------------------------------------------------------------------
	const URL_RE = /(https?:\/\/[^\s]+)/g;
	function postText(raw) {
		// Replies start with a run of @handles; the card already says who wrote it.
		// X's API sends &amp; &lt; &gt; escaped; blank lines between every line read as gaps.
		const text = raw.replace(/^(@\w+\s+)+/, '')
			.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
			.replace(/\n\s*\n+/g, '\n').trim();
		const p = el('p', 'mw-text');
		for (const part of text.split(URL_RE)) {
			if (/^https?:\/\//.test(part)) {
				const a = el('a', '', part.replace(/^https?:\/\//, '').slice(0, 32));
				a.href = part; a.target = '_blank'; a.rel = 'noopener noreferrer';
				p.append(a);
			} else if (part) p.append(part);
		}
		return { p, long: text.length > 420 };
	}
	function card(r) {
		const c = el('article', 'mw-card');
		const who = el('div', 'mw-who');
		const prof = el('a', '', `@${r.author}`);
		prof.href = `https://x.com/${encodeURIComponent(r.author)}`; prof.target = '_blank'; prof.rel = 'noopener noreferrer';
		const when = el('time', '', fmt(r.created_at, true)); when.dateTime = r.created_at;
		who.append(el('span', 'mw-av', r.author.replace(/[^a-z0-9]/i, '').charAt(0) || '@'), prof, when);
		c.append(who);
		const { p, long } = postText(r.text);
		c.append(p);
		if (long) {
			p.classList.add('clamped');
			const b = el('button', 'text-button mw-expand', 'Read all');
			b.type = 'button';
			b.addEventListener('click', () => { const on = p.classList.toggle('clamped'); b.textContent = on ? 'Read all' : 'Show less'; });
			c.append(b);
		}
		const foot = el('div', 'mw-foot');
		for (const u of r.uses) foot.append(el('span', `jchip${u === 'production' ? ' prod' : ''}`, USE_TAG[u]));
		const links = el('span', 'mw-links');
		if (!state.all && !state.author && r.n > 1) {
			const more = el('button', 'text-button', `+${r.n - 1} more`);
			more.type = 'button';
			more.title = `Every post from @${r.author}`;
			more.addEventListener('click', () => { state.author = r.author; reload(); window.scrollTo({ top: $('uses').getBoundingClientRect().top + scrollY - 20 }); });
			links.append(more);
		}
		const x = el('a', '', 'View on X ↗');
		x.href = r.url; x.target = '_blank'; x.rel = 'noopener noreferrer';
		links.append(x);
		foot.append(links);
		c.append(foot);
		return c;
	}

	function showing(body) {
		const line = $('showing');
		const shown = Math.min(body.offset + body.results.length, body.every ? body.posts : body.builders);
		if (state.author) {
			line.replaceChildren(`All ${body.posts} posts from @${state.author}.`);
			const back = el('button', 'text-button', 'Back to everyone');
			back.type = 'button';
			back.addEventListener('click', () => { state.author = ''; reload(); });
			line.append(back);
		} else if (body.every) {
			line.textContent = `${shown} of ${body.posts.toLocaleString()} posts, newest first.`;
		} else {
			line.textContent = `${shown} of ${body.builders.toLocaleString()} builders, one card each (their newest post).`;
		}
	}

	async function load() {
		if (loading) return;
		loading = true;
		$('more').hidden = true;
		$('status').textContent = 'Loading…';
		try {
			const res = await fetch(`${API}?${query({ offset: state.offset, ...(meta ? {} : { meta: '1' }) })}`, { credentials: 'same-origin' });
			const body = await res.json();
			if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
			if (!meta && body.meta) { meta = body.meta; drawMeta(body); }
			if (state.offset === 0) $('grid').replaceChildren();
			$('grid').append(...body.results.map(card));
			showing(body);
			$('status').textContent = body.results.length || state.offset ? '' : 'No posts match.';
			$('more').hidden = !body.more;
			state.offset += body.results.length;
		} catch (err) {
			$('status').textContent = `Couldn’t load the posts. ${err.message}`;
		} finally {
			loading = false;
		}
	}
	function reload() {
		state.offset = 0;
		syncURL();
		drawControls();
		load();
	}

	// --- controls ------------------------------------------------------------------------
	function drawControls() {
		for (const b of $('uses').children) {
			const on = b.dataset.use === state.use;
			b.classList.toggle('active', on);
			b.setAttribute('aria-checked', String(on));
		}
		for (const b of $('mode').children) b.setAttribute('aria-pressed', String((b.dataset.all === '1') === state.all));
	}
	$('uses').append(...USES.map(([k, label]) => {
		const b = el('button', 'chip', label);
		b.type = 'button'; b.dataset.use = k; b.setAttribute('role', 'radio');
		b.addEventListener('click', () => { state.use = k; reload(); });
		return b;
	}));
	$('mode').append(...[['0', 'One per builder'], ['1', 'Every post']].map(([v, label]) => {
		const b = el('button', '', label);
		b.type = 'button'; b.dataset.all = v;
		b.addEventListener('click', () => { state.all = v === '1'; reload(); });
		return b;
	}));
	$('more').addEventListener('click', load);
	drawControls();
	load();
})();
