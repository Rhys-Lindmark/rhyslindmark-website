// Q&A rehearsal. Reads the live hard-questions doc (rendered by /jev/docs from the jev repo),
// so edits to the markdown show up here. Each question is a paragraph that starts with
// "<strong>N. …</strong>"; the rest of that paragraph and any that follow are the draft answer.
const SRC = '/jev/docs/takehome/tuesday/hard-questions.md';
const KEY = 'jev-rehearse-v1', SECONDS = 60;
const $ = id => document.getElementById(id);
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} };

let cards = [], deck = [], cur = null, section = 'All', state = load(), timer = null;

function parse(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const out = []; let sec = '', card = null;
  for (const el of doc.querySelectorAll('main h2, main p, main ul, main ol')) {
    if (el.tagName === 'H2') { sec = el.textContent.trim(); card = null; continue; }
    const strong = el.firstElementChild?.tagName === 'STRONG' ? el.firstElementChild : null;
    const m = strong && strong.textContent.trim().match(/^(\d+)\.\s*(.+)$/);
    if (m) {
      const rest = el.cloneNode(true); rest.firstElementChild.remove();
      card = { n: +m[1], q: m[2].replace(/^"|"$/g, '').replace(/^“|”$/g, ''), section: sec, a: [rest.innerHTML.trim()] };
      out.push(card);
    } else if (card && sec) card.a.push(el.outerHTML);
  }
  return out;
}

function sections() {
  const names = ['All', ...new Set(cards.map(c => c.section))];
  $('rh-sections').replaceChildren(...names.map(n => {
    const b = document.createElement('button'); b.type = 'button'; b.className = `chip${n === section ? ' active' : ''}`;
    const left = cards.filter(c => (n === 'All' || c.section === n) && !state[c.n]).length;
    b.textContent = n === 'All' ? `All · ${left} left` : n.replace(/^About (.)/, (_, c) => c.toUpperCase());
    b.addEventListener('click', () => { section = n; build(); sections(); next(); });
    return b;
  }));
}
function build() {
  deck = cards.filter(c => (section === 'All' || c.section === section) && !state[c.n]);
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
}
function progress() {
  const pool = cards.filter(c => section === 'All' || c.section === section);
  $('rh-progress').textContent = `${pool.filter(c => state[c.n]).length} of ${pool.length} got`;
}
function startTimer() {
  clearInterval(timer); const t0 = Date.now(), fill = $('rh-timer-fill'); fill.style.width = '0%'; fill.classList.remove('over');
  timer = setInterval(() => { const f = (Date.now() - t0) / 1000 / SECONDS; fill.style.width = `${Math.min(100, f * 100)}%`; if (f >= 1) { fill.classList.add('over'); clearInterval(timer); } }, 200);
}
function show(c) {
  cur = c; $('rh-a').hidden = true; $('rh-got').hidden = $('rh-again').hidden = true; $('rh-reveal').hidden = false;
  if (!c) {
    clearInterval(timer); $('rh-section').textContent = ''; $('rh-timer-fill').style.width = '0%';
    $('rh-q').textContent = cards.length ? 'All done in this section. Start over, or pick another.' : 'No questions found.';
    $('rh-reveal').hidden = true; progress(); return;
  }
  $('rh-section').textContent = `${c.section} · #${c.n}`;
  $('rh-q').textContent = `“${c.q}”`;
  $('rh-a').innerHTML = c.a.join('');
  progress(); startTimer();
}
const next = () => show(deck.shift() || null);
function reveal() { if (!cur) return; clearInterval(timer); $('rh-a').hidden = false; $('rh-reveal').hidden = true; $('rh-got').hidden = $('rh-again').hidden = false; $('rh-got').focus(); }
function got() { if (!cur) return; state[cur.n] = 1; save(state); sections(); next(); }
function again() { if (!cur) return; deck.splice(Math.min(deck.length, 3), 0, cur); next(); }

$('rh-reveal').addEventListener('click', reveal);
$('rh-got').addEventListener('click', got);
$('rh-again').addEventListener('click', again);
$('rh-skip').addEventListener('click', () => { if (cur) deck.push(cur); next(); });
$('rh-reset').addEventListener('click', () => { state = {}; save(state); build(); sections(); next(); });
addEventListener('keydown', e => {
  if (e.target.closest('input,textarea')) return;
  if (e.key === ' ' && !$('rh-reveal').hidden) { e.preventDefault(); reveal(); }
  else if ((e.key === 'g' || e.key === 'G') && !$('rh-got').hidden) got();
  else if ((e.key === 'a' || e.key === 'A') && !$('rh-again').hidden) again();
  else if (e.key === 'ArrowRight') $('rh-skip').click();
});

try {
  const r = await fetch(SRC, { credentials: 'same-origin' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  cards = parse(await r.text());
  if (!cards.length) throw new Error('no questions found');
  build(); sections(); next();
} catch (e) {
  $('rh-q').innerHTML = `Couldn’t load the questions (${e.message}). Read them in <a href="${SRC}">hard-questions.md</a>.`;
  $('rh-reveal').hidden = true;
}
