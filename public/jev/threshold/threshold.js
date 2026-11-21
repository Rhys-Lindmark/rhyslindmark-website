// Threshold Explorer: the coverage-vs-error trade-off from Trust Meter, made draggable.
// Same statistics as takehome/demos/a2-trust-meter/calibration.mjs.
import { DATA } from './data.js?v=threshold-1';

const $ = id => document.getElementById(id);
const pct = (x, d = 1) => `${(100 * x).toFixed(d)}%`;
const money = x => x >= 100 ? `$${Math.round(x).toLocaleString('en-US')}` : `$${x.toFixed(2)}`;
const h = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids.filter(k => k != null)); return e; };

function wilsonHigh(k, n, z = 1.96) {
  if (!n) return 1;
  const ph = k / n, d = 1 + z * z / n;
  return Math.min(1, (ph + z * z / (2 * n) + z * Math.sqrt(ph * (1 - ph) / n + z * z / (4 * n * n))) / d);
}

// One point per message: the probability of the answer you'd act on, and whether it was right.
// For a Noul that's whichever side is above 0.5, so its probability is max(p, 1 - p).
function points(ds) {
  return ds.rows.map(r => ds.kind === 'choice'
    ? { conf: r[0], hit: r[1] === r[2], said: r[1].replaceAll('_', ' '), truth: r[2].replaceAll('_', ' '), text: r[3] }
    : { conf: Math.max(r[0], 1 - r[0]), hit: (r[0] >= 0.5) === r[1], said: r[0] >= 0.5 ? `ironic (p ${r[0].toFixed(2)})` : `not ironic (p ${r[0].toFixed(2)})`, truth: r[1] ? 'ironic' : 'not ironic', text: r[2] });
}
const at = (pts, t) => { const kept = pts.filter(p => p.conf >= t), errs = kept.filter(p => !p.hit).length; return { t, kept, n: kept.length, errs, coverage: kept.length / pts.length, error: kept.length ? errs / kept.length : 0, error_hi: wilsonHigh(errs, kept.length) }; };
// Trust Meter's rule: the threshold with the most coverage whose observed error fits the budget, with at least 20 cases.
function forBudget(pts, budget) {
  let best = null;
  for (let i = 0; i < 50; i++) { const s = at(pts, +(0.5 + i * 0.01).toFixed(2)); if (s.n >= 20 && s.error <= budget && (!best || s.coverage > best.coverage)) best = s; }
  return best;
}

const NAMES = { banking77: 'Banking77 · 400 support messages, 77 intents', irony: 'Irony · 300 tweets, yes/no' };
let name = 'banking77', pts = points(DATA[name]), t = 0.85;

function renderDatasets() {
  $('th-datasets').replaceChildren(...Object.keys(DATA).map(k => {
    const b = h('button', `chip${k === name ? ' active' : ''}`, NAMES[k]); b.type = 'button'; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(k === name));
    b.addEventListener('click', () => { name = k; pts = points(DATA[k]); const b5 = forBudget(pts, 0.05); setT(b5 ? b5.t : 0.8); renderDatasets(); renderBudgets(); });
    return b;
  }));
  const ds = DATA[name];
  $('th-question').innerHTML = '';
  $('th-question').append('Jev was asked ', h('code', null, ds.question), ` (${ds.kind === 'choice' ? 'a Choice' : 'a Noul'}) about each of ${ds.n} human-labeled examples from ${ds.source}. Zero-shot, ${ds.model}, ${money(ds.cost_usd)} for all of them.`);
}
function renderBudgets() {
  $('th-budget-buttons').replaceChildren(...[0.01, 0.02, 0.05, 0.10].map(b => {
    const best = forBudget(pts, b), btn = h('button', 'chip', pct(b, 0));
    btn.type = 'button'; btn.disabled = !best; btn.title = best ? `Act when p ≥ ${best.t.toFixed(2)}` : 'No threshold meets this budget on this data';
    if (best) btn.addEventListener('click', () => setT(best.t));
    return btn;
  }));
}

// The strip: every message as a dot at its probability, stacked into columns.
const W = 1000, PAD = 24, LO = 0.2;
function renderStrip(s) {
  const svg = $('th-strip'), cols = new Map(), step = 0.01, r = 4.2;
  const x = c => PAD + (Math.max(LO, c) - LO) / (1 - LO) * (W - 2 * PAD);
  const placed = pts.map(p => { const k = Math.round(Math.max(LO, p.conf) / step); const i = cols.get(k) || 0; cols.set(k, i + 1); return { p, cx: x(k * step), i }; });
  const tall = Math.max(...cols.values()), H = Math.min(260, Math.max(120, tall * r * 2 + 40)), rowH = Math.min(r * 2, (H - 40) / tall);
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const NS = 'http://www.w3.org/2000/svg', el = (n, a) => { const e = document.createElementNS(NS, n); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
  const kids = [el('rect', { x: PAD, y: 8, width: x(s.t) - PAD, height: H - 36, class: 'th-human-zone' })];
  for (const { p, cx, i } of placed) {
    const c = el('circle', { cx, cy: H - 32 - rowH / 2 - i * rowH, r: Math.min(r, rowH / 2 + .2), class: `${p.hit ? 'ok' : 'bad'}${p.conf >= s.t ? '' : ' dim'}`, tabindex: p.hit ? -1 : 0 });
    const show = () => { $('th-tip').replaceChildren(h('strong', null, p.hit ? 'Right. ' : 'Wrong. '), `“${p.text}” `, h('span', 'note', `Jev: ${p.said} (${p.conf.toFixed(2)}) · Human label: ${p.truth}`)); };
    c.addEventListener('mouseenter', show); c.addEventListener('focus', show); c.addEventListener('click', show);
    kids.push(c);
  }
  kids.push(el('line', { x1: x(s.t), x2: x(s.t), y1: 4, y2: H - 28, class: 'th-line' }));
  for (const v of [0.2, 0.4, 0.6, 0.8, 1]) { const tx = el('text', { x: x(v), y: H - 10, class: 'th-axis', 'text-anchor': 'middle' }); tx.textContent = v.toFixed(1); kids.push(tx); }
  const lbl = el('text', { x: Math.min(W - PAD, x(s.t) + 6), y: 22, class: 'th-axis strong', 'text-anchor': x(s.t) > W - 180 ? 'end' : 'start' }); lbl.textContent = `p ≥ ${s.t.toFixed(2)}`; kids.push(lbl);
  svg.replaceChildren(...kids);
}

function renderCost(s) {
  const v = Math.max(0, +$('c-volume').value || 0), hc = Math.max(0, +$('c-human').value || 0), ec = Math.max(0, +$('c-error').value || 0);
  const ds = DATA[name], jevPer = ds.cost_usd / ds.n, all = at(pts, 0);
  const row = (label, cover, err) => {
    const jev = v * jevPer, people = v * (1 - cover) * hc, wrong = v * cover * err, total = jev + people + wrong * ec;
    return h('tr', null, h('td', null, label), h('td', null, money(jev)), h('td', null, money(people)), h('td', null, Math.round(wrong).toLocaleString('en-US')), h('td', null, h('strong', null, money(total))));
  };
  $('th-cost').replaceChildren(h('table', null,
    h('thead', null, h('tr', null, ...['', 'Jev', 'People', 'Wrong answers', 'Total'].map(x => h('th', null, x)))),
    h('tbody', null,
      row('Everyone reviews by hand', 0, 0),
      row(`Jev answers everything`, 1, 1 - all.kept.filter(p => p.hit).length / pts.length),
      row(`Jev when p ≥ ${s.t.toFixed(2)}, people the rest`, s.coverage, s.error))));
}

function renderMisses(s) {
  const misses = s.kept.filter(p => !p.hit).sort((a, b) => b.conf - a.conf).slice(0, 12);
  $('th-misses').replaceChildren(...(misses.length ? misses.map(p => h('li', null, h('span', 'th-miss-text', `“${p.text}”`), h('span', 'note', `Jev: ${p.said} · ${p.conf.toFixed(2)}   Human label: ${p.truth}`))) : [h('li', 'note', 'No wrong answers above this threshold on this data.')]));
}

function setT(v) { t = +(+v).toFixed(2); $('th-slider').value = t; render(); }
function render() {
  const s = at(pts, t), all = at(pts, 0);
  $('th-t-label').textContent = t.toFixed(2);
  $('th-n').textContent = `${s.n} of ${pts.length} answers`;
  $('s-cover').textContent = pct(s.coverage); $('s-cover-n').textContent = `${s.n} of ${pts.length}`;
  $('s-err').textContent = pct(s.error); $('s-err-hi').textContent = s.n ? `could be as high as ${pct(s.error_hi)} (95%)` : '';
  $('s-human').textContent = pct(1 - s.coverage); $('s-human-n').textContent = `${pts.length - s.n} messages`;
  $('s-acc').textContent = pct(all.kept.filter(p => p.hit).length / pts.length);
  for (const b of $('th-budget-buttons').children) b.classList.toggle('active', b.title === `Act when p ≥ ${t.toFixed(2)}`);
  renderStrip(s); renderCost(s); renderMisses(s);
}

$('th-slider').addEventListener('input', e => setT(e.target.value));
for (const id of ['c-volume', 'c-human', 'c-error']) $(id).addEventListener('input', () => renderCost(at(pts, t)));
renderDatasets(); renderBudgets(); setT(0.85);
