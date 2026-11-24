// Made with Jev: builder posts from the X corpus, drawn as X cards like madewithjev.com/newest.
// Posts come from /jev/made-with-jev/posts (the feedback D1); names, avatars and media from
// /jev/made-with-jev/x (X's embed data), a few posts per call. State lives in the URL
// (?use=, ?segment=, ?all=1, ?author=) so a filtered view can be linked.
(() => {
	const API = '/jev/made-with-jev/posts';
	const X_API = '/jev/made-with-jev/x';
	const X_BATCH = 6;
	const USES = [
		['classify', 'Classify'], ['route', 'Route'], ['rank_score', 'Rank and score'],
		['eval_judge', 'Judge and eval'], ['agent_control', 'Agent control'], ['production', 'In production'],
	];
	const SEGMENTS = [
		['agent_or_coding_tool_builder', 'Agents and coding tools'], ['framework_or_platform_integrator', 'Frameworks and platforms'],
		['eval_or_research', 'Evals and research'], ['production_pipeline_team', 'Production pipelines'], ['maker_or_hobbyist', 'Makers and hobbyists'],
	];
	const USE_LABEL = Object.fromEntries(USES), SEG_LABEL = Object.fromEntries(SEGMENTS);
	const X_PATH = 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';

	const $ = id => document.getElementById(id);
	const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
	const svg = (path, cls, viewBox = '0 0 24 24') => {
		const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		s.setAttribute('viewBox', viewBox); s.setAttribute('aria-hidden', 'true'); s.setAttribute('fill', 'currentColor');
		if (cls) s.setAttribute('class', cls);
		const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', path); s.append(p);
		return s;
	};
	const ext = (a, href) => { a.href = href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; };
	const fmt = (iso, year = true) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC', ...(year ? { year: 'numeric' } : {}) });
	const compactNum = n => n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

	const params = new URLSearchParams(location.search);
	const state = { use: params.get('use') || '', segment: params.get('segment') || '', all: params.get('all') === '1', author: params.get('author') || '', offset: 0 };
	let meta = null, loading = false, gen = 0;

	function query(extra = {}) {
		const q = new URLSearchParams();
		for (const k of ['use', 'segment', 'author']) if (state[k]) q.set(k, state[k]);
		if (state.all) q.set('all', '1');
		for (const [k, v] of Object.entries(extra)) q.set(k, v);
		return q;
	}
	const syncURL = () => { const q = query(); history.replaceState(null, '', (q.toString() ? `?${q}` : location.pathname) + location.hash); };

	// --- hero and sidebar ---------------------------------------------------------------
	function drawMeta(m) {
		$('updated').lastChild.textContent = `Updated ${m.uploaded_at ? fmt(m.uploaded_at) : '–'}`;
		$('sub').textContent = `${m.posts.toLocaleString()} posts from ${m.builders.toLocaleString()} people building with Jev, the System One model from TypeSafe AI, collected from X. Jev reads each post and keeps the ones where the author builds with it.`;
		const count = (n, label) => { const d = el('div'); d.append(el('dt', '', label), el('dd', '', n)); return d; };
		$('counts').replaceChildren(count(m.posts.toLocaleString(), 'posts'), count(m.builders.toLocaleString(), 'builders'),
			count(m.newest ? fmt(m.newest, false) : '–', 'newest post'));
		drawSide(m);
	}
	function sideButton(label, n, on, onClick) {
		const li = el('li'), b = el('button');
		b.type = 'button'; b.setAttribute('aria-pressed', String(on));
		b.append(el('span', '', label));
		if (n != null) b.append(el('small', '', n.toLocaleString()));
		b.addEventListener('click', onClick);
		li.append(b);
		return li;
	}
	function drawSide(m = meta) {
		if (!m) return;
		const pick = (use, segment) => () => { Object.assign(state, { use, segment, author: '' }); reload(true); };
		$('uses').replaceChildren(
			sideButton('All builds', m.posts, !state.use && !state.segment, pick('', '')),
			...USES.map(([k, label]) => sideButton(label, m.uses[k] ?? 0, state.use === k, pick(k, ''))),
		);
		$('segments').replaceChildren(...SEGMENTS.map(([k, label]) => sideButton(label, m.segments[k] ?? 0, state.segment === k, pick('', k))));
	}
	function drawMode() {
		$('mode').replaceChildren(...[[false, 'One per builder'], [true, 'Every post']].map(([all, label]) => {
			const b = el('button', '', label);
			b.type = 'button'; b.setAttribute('aria-pressed', String(state.all === all));
			b.addEventListener('click', () => { state.all = all; reload(); });
			return b;
		}));
	}

	// --- text: X entities and links, safely --------------------------------------------
	const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
	function richText(p, raw, links = {}) {
		const text = decode(raw).replace(/\n\s*\n+/g, '\n\n').trim();
		for (const part of text.split(/(https?:\/\/\S+|@\w{1,15}\b)/g)) {
			if (!part) continue;
			if (part.startsWith('@')) p.append(ext(el('a', '', part), `https://x.com/${part.slice(1)}`));
			else if (/^https?:\/\//.test(part)) {
				const l = links[part];
				p.append(ext(el('a', '', l ? l.display : part.replace(/^https?:\/\//, '').slice(0, 30)), l ? l.href : part));
			} else p.append(part);
		}
		return text.length;
	}

	// --- cards -------------------------------------------------------------------------
	const sizer = new ResizeObserver(entries => { for (const e of entries) span(e.target.parentElement); });
	function span(li) {
		if (!li?.firstElementChild) return;
		li.style.gridRowEnd = `span ${Math.ceil((li.firstElementChild.getBoundingClientRect().height + 16) / 4)}`;
	}

	function card(r) {
		const li = el('li'), c = el('article', 'mw-card');
		c.dataset.id = r.id.replace(/^x:/, '');
		const who = el('div', 'mw-who');
		const names = el('div', 'mw-names');
		const name = el('p', 'mw-name'), handle = el('p', 'mw-handle');
		name.append(ext(el('a', '', r.author), `https://x.com/${encodeURIComponent(r.author)}`));
		handle.textContent = `@${r.author}`;
		names.append(name, handle);
		who.append(el('span', 'mw-av', r.author.replace(/[^a-z0-9]/i, '').charAt(0) || '@'), names, svg(X_PATH, 'mw-xicon'));
		c.append(who);

		const body = el('div', 'mw-body');
		const p = el('p', 'mw-text');
		richText(p, r.text.replace(/^(@\w+\s+)+/, ''));
		body.append(p);
		c.append(body);
		clampable(c, p);

		const foot = el('div', 'mw-foot');
		const row = el('div', 'mw-foot-row');
		const src = el('p', 'mw-src');
		src.style.margin = '0';
		src.append(svg(X_PATH), el('span', '', 'X'), el('span', '', '·'), el('span', '', SEG_LABEL[r.segment] || 'Builder'));
		const stats = el('span', 'mw-stats');
		stats.append(el('time', '', fmt(r.created_at)));
		stats.lastChild.dateTime = r.created_at;
		row.append(src, stats);
		foot.append(row);
		if (r.uses.length) {
			const tags = el('div', 'mw-tags');
			for (const u of r.uses) tags.append(el('span', `mw-tag${u === 'production' ? ' prod' : ''}`, USE_LABEL[u]));
			foot.append(tags);
		}
		const links = el('div', 'mw-foot-links');
		if (!state.all && !state.author && r.n > 1) {
			const more = el('button', '', `+${r.n - 1} more from @${r.author}`);
			more.type = 'button';
			more.addEventListener('click', () => { state.author = r.author; reload(true); });
			links.append(more);
		} else links.append(el('span'));
		links.append(ext(el('a', 'mw-stretch', 'View on X ↗'), r.url));
		foot.append(links);
		c.append(foot);
		li.append(c);
		return li;
	}
	// Eight lines, as madewithjev.com does; a "Show more" only when the text is cut.
	function clampable(c, p) {
		p.classList.add('clamped');
		requestAnimationFrame(() => {
			if (p.scrollHeight <= p.clientHeight + 2 || c.querySelector('.mw-expand')) return;
			const b = el('button', 'mw-expand', 'Show more');
			b.type = 'button';
			b.addEventListener('click', () => { const on = p.classList.toggle('clamped'); b.textContent = on ? 'Show more' : 'Show less'; });
			p.after(b);
		});
	}

	// Fill a card in with what X knows about the post.
	function hydrate(c, x) {
		if (!x) return;
		if (x.missing) { c.querySelector('.mw-body').append(el('p', 'mw-gone', 'No longer on X. Text from the corpus.')); return; }
		const av = c.querySelector('.mw-av');
		if (x.avatar) {
			const img = el('img', 'mw-av');
			img.src = x.avatar; img.alt = ''; img.width = 32; img.height = 32; img.loading = 'lazy'; img.decoding = 'async';
			img.addEventListener('error', () => img.replaceWith(av), { once: true });
			av.replaceWith(img);
		}
		if (x.name) c.querySelector('.mw-name a').textContent = x.name;

		const body = c.querySelector('.mw-body');
		const p = el('p', 'mw-text');
		richText(p, x.text, x.links);
		body.replaceChildren(p);
		c.querySelector('.mw-expand')?.remove();
		clampable(c, p);

		const photos = x.media.filter(m => m.type === 'photo');
		const video = x.media.find(m => m.type !== 'photo');
		if (photos.length || video) {
			const shown = photos.length ? photos : [video];
			const m = el('div', `mw-media n${shown.length}`);
			for (const ph of shown) {
				const img = el('img');
				img.src = ph.type === 'photo' ? `${ph.src}?name=small` : ph.src;
				img.alt = `Image from a post by @${x.handle}`; img.loading = 'lazy'; img.decoding = 'async';
				if (ph.w && ph.h) { img.width = ph.w; img.height = ph.h; }
				img.addEventListener('error', () => img.remove(), { once: true });
				m.append(img);
			}
			if (!photos.length) { const play = el('span', 'mw-play'); play.append(svg('M8 5v14l11-7z')); m.append(play); }
			body.append(m);
		} else if (x.card) {
			const a = ext(el('a', 'mw-link'), x.card.href || c.querySelector('.mw-stretch').href);
			if (x.card.image) { const img = el('img'); img.src = x.card.image; img.alt = ''; img.loading = 'lazy'; a.append(img); }
			const t = el('div');
			if (x.card.domain) t.append(el('small', '', x.card.domain));
			if (x.card.title) t.append(el('strong', '', x.card.title));
			a.append(t);
			body.append(a);
		}
		if (x.quote) {
			const q = el('div', 'mw-quote');
			q.append(el('p', '', `${x.quote.name} @${x.quote.handle}`));
			const qt = el('p'); richText(qt, x.quote.text.slice(0, 280)); q.append(qt);
			body.append(q);
		}
		const stats = c.querySelector('.mw-stats');
		if (x.likes) stats.prepend(el('span', '', `♥ ${compactNum(x.likes)}`));
	}
	async function hydrateAll(cards, myGen) {
		const ids = cards.map(c => c.dataset.id);
		for (let i = 0; i < ids.length; i += X_BATCH) {
			const batch = ids.slice(i, i + X_BATCH);
			fetch(`${X_API}?ids=${batch.join(',')}`, { credentials: 'same-origin' })
				.then(r => r.ok ? r.json() : { posts: {} })
				.then(({ posts }) => {
					if (myGen !== gen) return;
					for (const c of cards) if (posts[c.dataset.id] !== undefined) hydrate(c, posts[c.dataset.id]);
				})
				.catch(() => {});
		}
	}

	function showing(body) {
		const line = $('showing');
		const total = body.every ? body.posts : body.builders;
		const shown = body.offset + body.results.length;
		const what = state.author ? `@${state.author}` : state.use ? USE_LABEL[state.use] : state.segment ? SEG_LABEL[state.segment] : '';
		line.replaceChildren(`${what ? `${what} · ` : ''}Newest first, 1–${shown} of ${total.toLocaleString()} ${body.every ? 'posts' : 'builders'}`);
		if (state.author || state.use || state.segment) {
			const clear = el('button', '', 'Clear ✕');
			clear.type = 'button';
			clear.addEventListener('click', () => { Object.assign(state, { use: '', segment: '', author: '' }); reload(); });
			line.append(clear);
		}
	}

	async function load() {
		if (loading) return;
		loading = true;
		const myGen = gen;
		$('more').hidden = true;
		$('status').textContent = 'Loading…';
		try {
			const res = await fetch(`${API}?${query({ offset: state.offset, ...(meta ? {} : { meta: '1' }) })}`, { credentials: 'same-origin' });
			const body = await res.json();
			if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
			if (myGen !== gen) return;
			if (!meta && body.meta) { meta = body.meta; drawMeta(meta); }
			if (state.offset === 0) { sizer.disconnect(); $('feed').replaceChildren(); }
			const lis = body.results.map(card);
			$('feed').append(...lis);
			for (const li of lis) { span(li); sizer.observe(li.firstElementChild); }
			hydrateAll(lis.map(li => li.firstElementChild), myGen);
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
	function reload(scroll) {
		gen++;
		loading = false;
		state.offset = 0;
		syncURL();
		drawSide();
		drawMode();
		load();
		if (scroll) $('gallery').scrollIntoView({ block: 'start' });
	}

	$('more').addEventListener('click', load);
	drawMode();
	load();
})();
