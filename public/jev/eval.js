// Eval card: reads /jev/eval-summary.json (written by evals/model-router/analyze.mjs)
// and stays hidden until that file exists.
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg';
const h = (tag, cls, ...kids) => { const el = document.createElement(tag); if (cls) el.className = cls; for (const k of kids) if (k != null) el.append(k); return el; };
const s = (tag, attrs = {}, ...kids) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); for (const k of kids) el.append(k); return el; };
const pct = x => `${(x * 100).toFixed(1)}%`;
const usd = x => x < 1 ? `$${x.toFixed(2)}` : x < 10 ? `$${x.toFixed(1)}` : `$${Math.round(x)}`;

// Series: color carries identity, shape repeats it (validated palette, light surface).
const SERIES = {
  fixed: { label: 'One model for everything', color: '#9a9a9a', shape: 'square' },
  router: { label: 'Router (truth table)', color: '#e0179f', shape: 'circle' },
  choice: { label: 'Choice (argmax)', color: '#e01a2b', shape: 'diamond' },
  learned: { label: 'Learned router (λ sweep)', color: '#7a4be8', shape: 'line' },
  oracle: { label: 'Oracle (best possible)', color: '#0a8a68', shape: 'triangle' }
};

function marker(shape, x, y, color, r = 5) {
  const ring = { stroke: '#fff', 'stroke-width': 2, fill: color };
  if (shape === 'square') return s('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r, rx: 1.5, ...ring });
  if (shape === 'diamond') return s('path', { d: `M${x} ${y - r - 1}L${x + r + 1} ${y}L${x} ${y + r + 1}L${x - r - 1} ${y}Z`, ...ring });
  if (shape === 'triangle') return s('path', { d: `M${x} ${y - r - 1}L${x + r + 1} ${y + r}L${x - r - 1} ${y + r}Z`, ...ring });
  return s('circle', { cx: x, cy: y, r: r + (shape === 'circle' ? 1 : 0), ...ring });
}

function chart(data, tip) {
  const W = 640, H = 340, m = { l: 48, r: 16, t: 12, b: 40 };
  const pts = data.policies.filter(p => p.kind !== 'router-variant');
  const costs = pts.map(p => Math.max(p.cost, 0.01));
  const x0 = Math.log10(Math.min(...costs) / 1.6), x1 = Math.log10(Math.max(...costs) * 1.6);
  const X = c => m.l + (Math.log10(Math.max(c, 0.01)) - x0) / (x1 - x0) * (W - m.l - m.r);
  const yMin = Math.max(0, Math.floor(Math.min(...pts.map(p => p.pass)) * 10) / 10 - 0.05);
  const Y = p => H - m.b - (p - yMin) / (1 - yMin) * (H - m.t - m.b);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'eval-chart', role: 'img', 'aria-label': 'Pass rate against cost per 1,000 prompts for each routing policy' });
  // recessive grid + axes
  for (let v = Math.ceil(yMin * 10) / 10; v <= 1.0001; v += 0.1) { svg.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' }), s('text', { x: m.l - 8, y: Y(v) + 4, class: 'tick', 'text-anchor': 'end' }, `${Math.round(v * 100)}%`)); }
  for (let e = Math.ceil(x0); e <= Math.floor(x1); e++) { const c = 10 ** e; svg.append(s('line', { x1: X(c), x2: X(c), y1: m.t, y2: H - m.b, class: 'grid' }), s('text', { x: X(c), y: H - m.b + 16, class: 'tick', 'text-anchor': 'middle' }, `$${+c.toPrecision(1)}`)); }
  svg.append(s('text', { x: (m.l + W - m.r) / 2, y: H - 6, class: 'axis-label', 'text-anchor': 'middle' }, 'Cost per 1,000 prompts (log scale)'));
  // learned-router curve, sorted by cost
  const curve = [...data.learned_curve].sort((a, b) => a.cost - b.cost);
  svg.append(s('path', { d: curve.map((p, i) => `${i ? 'L' : 'M'}${X(p.cost)} ${Y(p.pass)}`).join(''), class: 'curve', stroke: SERIES.learned.color }));
  // points, with a hit target larger than the mark
  for (const p of pts) {
    const k = SERIES[p.kind]; if (!k) continue;
    const g = s('g', { class: 'pt', tabindex: 0 });
    if (p.kind === 'learned') g.append(s('circle', { cx: X(p.cost), cy: Y(p.pass), r: 3.5, fill: k.color, stroke: '#fff', 'stroke-width': 1.5 }));
    else g.append(marker(k.shape, X(p.cost), Y(p.pass), k.color));
    g.append(s('circle', { cx: X(p.cost), cy: Y(p.pass), r: 12, fill: 'transparent' }));
    const show = () => tip(p, X(p.cost) / W, Y(p.pass) / H);
    g.addEventListener('mouseenter', show); g.addEventListener('focus', show);
    g.addEventListener('mouseleave', () => tip(null)); g.addEventListener('blur', () => tip(null));
    svg.append(g);
  }
  // selective direct labels: the router, the oracle, the two Choice points
  for (const p of pts.filter(p => ['router', 'oracle', 'choice'].includes(p.kind))) {
    svg.append(s('text', { x: X(p.cost) + 9, y: Y(p.pass) - 8, class: 'pt-label' }, p.kind === 'choice' ? `Choice · ${p.name.includes('high') ? 'high' : 'low'}` : p.kind === 'router' ? 'Router' : 'Oracle'));
  }
  return svg;
}

function legend() {
  return h('div', 'eval-legend', ...Object.values(SERIES).map(k => {
    const sw = s('svg', { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true' });
    sw.append(k.shape === 'line' ? s('path', { d: 'M1 8H15', stroke: k.color, 'stroke-width': 2 }) : marker(k.shape, 8, 8, k.color, 4.5));
    return h('span', null, sw, k.label);
  }));
}

function render(data) {
  const best = (kind) => data.policies.filter(p => p.kind === kind);
  const router = best('router')[0], oracle = best('oracle')[0];
  // the learned point closest in cost to the router, for a like-for-like row
  const learned = [...data.learned_curve].sort((a, b) => Math.abs(Math.log(a.cost / router.cost)) - Math.abs(Math.log(b.cost / router.cost)))[0];
  const box = h('div', 'eval-chart-box'), tipEl = h('div', 'eval-tip'); tipEl.hidden = true;
  const tip = (p, fx, fy) => {
    if (!p) { tipEl.hidden = true; return; }
    tipEl.replaceChildren(...[h('strong', null, p.name), h('span', null, `${pct(p.pass)} pass · ${usd(p.cost)} per 1k`), p.random_p95 != null ? h('span', null, p.beats_random ? `beats random routing (p95 ${pct(p.random_p95)})` : `within random routing (p95 ${pct(p.random_p95)})`) : null].filter(Boolean));
    tipEl.style.left = `${fx * 100}%`; tipEl.style.top = `${fy * 100}%`; tipEl.hidden = false;
  };
  box.append(chart(data, tip), tipEl);

  const rows = [
    ['Router (truth table)', router],
    ['Choice · low effort', data.policies.find(p => p.kind === 'choice' && p.name.includes('low'))],
    ['Choice · high effort', data.policies.find(p => p.kind === 'choice' && p.name.includes('high'))],
    [`Learned router · λ=${learned.lambda}`, data.policies.find(p => p.kind === 'learned' && p.lambda === learned.lambda)],
    ['Oracle', oracle],
    ...best('fixed').map(p => [p.name.replace('Always ', 'Always '), p])
  ];
  const table = h('table', 'tt eval-table', h('thead', null, h('tr', null, ...['Policy', 'Pass rate', 'Per 1k prompts', 'vs. random routing'].map(c => h('th', null, c)))),
    h('tbody', null, ...rows.map(([name, p]) => h('tr', p.kind === 'router' ? 'hit' : '', h('td', null, name), h('td', null, pct(p.pass)), h('td', null, usd(p.cost)),
      h('td', null, p.random_p95 == null ? '–' : h('span', `agree-tag ${p.beats_random ? 'win' : ''}`, p.beats_random ? 'beats' : 'no better'))))));

  const c = data.router_diagnosis.counts, total = data.tasks;
  const verdicts = [['right', 'Right size'], ['more than needed', 'More than needed'], ['too weak', 'Too weak'], ['nothing passes', 'Nothing passes']].filter(([k]) => c[k]);
  const misses = data.router_diagnosis.tasks.filter(t => t.verdict === 'too weak');

  $('eval-body').replaceChildren(...[
    h('div', 'demo-heading', h('h2', null, 'Eval: does the router pay off?')),
    h('p', 'eval-meta', `${data.tasks} prompts with code-checked answers · ${data.reps} run${data.reps === 1 ? '' : 's'} of each on ${data.arms.length} model/effort combinations · ${usd(data.spent_usd)} spent · Jev ${data.jev_model ?? ''}`),
    legend(), box,
    h('p', 'note', 'Each point routes all prompts one way. Up and to the left is better. The oracle knows every result in advance, so nothing can beat it. "vs. random routing" deals the same mix of models to prompts at random 10,000 times; a policy beats it if it scores above the 95th percentile. The learned router is fit on Jev’s five judgments with one category held out at a time.'),
    h('h3', 'eval-h3', 'Policies'), h('div', 'cmp-scroll', table),
    h('h3', 'eval-h3', `Where the router sent each prompt`),
    h('div', 'eval-verdicts', ...verdicts.map(([k, label]) => h('div', `v-${k.replace(/ /g, '-')}`, h('strong', null, String(c[k])), h('span', null, label)))),
    h('p', 'note', `Compared with the cheapest combination that passed each prompt at least half the time. “Too weak” failed; “more than needed” passed but cost more than necessary. Out of ${total} prompts.`),
    misses.length ? h('details', 'eval-misses', h('summary', null, `Prompts the router under-served (${misses.length})`),
      h('ul', null, ...misses.map(t => h('li', null, h('span', null, t.prompt), h('span', 'cmp-sub', ` — sent to ${t.router.replace(':', ' · ')}, cheapest passing: ${t.cheapest_passing ? t.cheapest_passing.replace(':', ' · ') : 'none'}`))))) : null
  ].filter(Boolean));
  $('router-eval').hidden = false;
}

fetch('/jev/eval-summary.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).then(d => { if (d?.policies?.length) render(d); }).catch(() => {});
