// Eval cards: each reads a summary and a replay file written by
// evals/model-router/analyze.mjs, and stays hidden until its summary exists.
const NS = 'http://www.w3.org/2000/svg';
const h = (tag, cls, ...kids) => { const el = document.createElement(tag); if (cls) el.className = cls; for (const k of kids) if (k != null) el.append(k); return el; };
const s = (tag, attrs = {}, ...kids) => { const el = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v); for (const k of kids) el.append(k); return el; };
const pct = x => `${(x * 100).toFixed(1)}%`;
const usd = x => x < 1 ? `$${x.toFixed(2)}` : x < 10 ? `$${x.toFixed(1)}` : `$${Math.round(x)}`;

const EVALS = [
  { section: 'router-eval', title: 'Eval v0: a first pass', summary: '/jev/eval-summary.json', replay: '/jev/eval-replay.json', collapsed: true,
    intro: 'The first pass. Four open models from two families stood in for the router’s four tiers. Its lessons shaped the eval above.',
    finding: 'Price didn’t track skill: DeepSeek V4.1 Flash, the second-cheapest model, passed everything, while pricier GLM 5.3 stumbled on letter-level tasks. So the original router mostly paid for capability it didn’t need, and did no better than random routing with the same model mix.' },
  { section: 'router-eval-2', title: 'Eval', summary: '/jev/eval-summary-v2.json', replay: '/jev/eval-replay-v2.json',
    intro: 'This is the eval. Qwen 3.7 Flash, Plus and Max play the router’s tiers (a Fable pick falls back to Max). Router v2 and v3 were built from Eval v0’s lessons using only its 60 prompts, then tested on 168 new prompts, sorted into easy, medium and hard by how many of the six model/effort combinations failed them.',
    finding: 'Both new routers beat the original by 11–13 points at about the same cost, and do far better on hard prompts. But neither beats simply sending everything to Qwen 3.7 Plus at high effort (93.5% for $3.32 per 1,000), so with this family there is little left for routing to win.' }
];

// Series: color carries identity, shape repeats it (validated palette, light surface).
const SERIES = {
  fixed: { label: 'One model for everything', color: '#9a9a9a', shape: 'square' },
  router: { label: 'Router v1 (original truth table)', color: '#e0179f', shape: 'circle' },
  'router-v2': { label: 'Router v2 (new Jev judgments)', color: '#e0179f', shape: 'triangle' },
  'router-v3': { label: 'Router v3 (Jev + learned odds)', color: '#7a4be8', shape: 'circle' },
  choice: { label: 'Choice (argmax)', color: '#e01a2b', shape: 'diamond' },
  learned: { label: 'Learned router (cost dial λ)', color: '#7a4be8', shape: 'line' }
};
const LEARNED_SHOWN = [0, 32, 256];
const SHORT = { router: 'Judgment', 'router-v2': 'Judgment v2', 'router-v3': 'Judgment v3' };

function marker(shape, x, y, color, r = 5) {
  const ring = { stroke: '#fff', 'stroke-width': 2, fill: color };
  if (shape === 'square') return s('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r, rx: 1.5, ...ring });
  if (shape === 'diamond') return s('path', { d: `M${x} ${y - r - 1}L${x + r + 1} ${y}L${x} ${y + r + 1}L${x - r - 1} ${y}Z`, ...ring });
  if (shape === 'triangle') return s('path', { d: `M${x} ${y - r - 1}L${x + r + 1} ${y + r}L${x - r - 1} ${y + r}Z`, ...ring });
  return s('circle', { cx: x, cy: y, r: r + (shape === 'circle' ? 1 : 0), ...ring });
}

function chart(data, tip) {
  const W = 640, H = 340, m = { l: 48, r: 40, t: 12, b: 40 };
  // The learned router shows three settings of its cost dial: most likely to pass, the sweet spot, cheapest.
  const pts = data.policies.filter(p => SERIES[p.kind] && (p.kind !== 'learned' || LEARNED_SHOWN.includes(p.lambda)));
  const costs = pts.map(p => Math.max(p.cost, 0.01));
  const x0 = Math.log10(Math.min(...costs) / 1.6), x1 = Math.log10(Math.max(...costs) * 1.6);
  const X = c => m.l + (Math.log10(Math.max(c, 0.01)) - x0) / (x1 - x0) * (W - m.l - m.r);
  const yMin = Math.max(0, Math.floor(Math.min(...pts.map(p => p.pass)) * 10) / 10 - 0.05);
  const Y = p => H - m.b - (p - yMin) / (1 - yMin) * (H - m.t - m.b);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'eval-chart', role: 'img', 'aria-label': 'Pass rate against cost per 1,000 prompts for each routing policy' });
  for (let v = Math.ceil(yMin * 10) / 10; v <= 1.0001; v += 0.1) svg.append(s('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), class: 'grid' }), s('text', { x: m.l - 8, y: Y(v) + 4, class: 'tick', 'text-anchor': 'end' }, `${Math.round(v * 100)}%`));
  for (let e = Math.ceil(x0); e <= Math.floor(x1); e++) { const c = 10 ** e; svg.append(s('line', { x1: X(c), x2: X(c), y1: m.t, y2: H - m.b, class: 'grid' }), s('text', { x: X(c), y: H - m.b + 16, class: 'tick', 'text-anchor': 'middle' }, `$${+c.toPrecision(1)}`)); }
  svg.append(s('text', { x: (m.l + W - m.r) / 2, y: H - 6, class: 'axis-label', 'text-anchor': 'middle' }, 'Cost per 1,000 prompts (log scale)'));
  // One line per color, joining that color's points from cheapest to priciest.
  for (const color of new Set(pts.map(p => SERIES[p.kind].color))) {
    const line = pts.filter(p => SERIES[p.kind].color === color).sort((a, b) => a.cost - b.cost);
    if (line.length > 1) svg.append(s('path', { d: line.map((p, i) => `${i ? 'L' : 'M'}${X(p.cost)} ${Y(p.pass)}`).join(''), class: 'curve', stroke: color }));
  }
  for (const p of pts) {
    const k = SERIES[p.kind], g = s('g', { class: 'pt', tabindex: 0 });
    if (p.kind === 'learned') g.append(s('circle', { cx: X(p.cost), cy: Y(p.pass), r: 3.5, fill: k.color, stroke: '#fff', 'stroke-width': 1.5 }));
    else g.append(marker(k.shape, X(p.cost), Y(p.pass), k.color));
    g.append(s('circle', { cx: X(p.cost), cy: Y(p.pass), r: 12, fill: 'transparent' }));
    const show = () => tip(p, X(p.cost) / W, Y(p.pass) / H);
    g.addEventListener('mouseenter', show); g.addEventListener('focus', show);
    g.addEventListener('mouseleave', () => tip(null)); g.addEventListener('blur', () => tip(null));
    svg.append(g);
  }
  for (const p of pts.filter(p => p.kind === 'learned')) svg.append(s('text', { x: X(p.cost), y: Y(p.pass) + 16, 'text-anchor': 'middle', class: 'pt-label lambda' }, `λ=${p.lambda}`));
  // Router labels sit above their point, Choice labels below, so near-neighbors don't collide.
  // Labels go right of their point; the chart's right margin leaves room for the longest one.
  for (const p of pts.filter(p => SHORT[p.kind] || p.kind === 'choice')) svg.append(s('text', { x: X(p.cost) + 9, y: Y(p.pass) + (p.kind === 'choice' ? 16 : -8), class: 'pt-label' }, p.kind === 'choice' ? `Choice · ${p.name.includes('high') ? 'high' : 'low'} effort` : SHORT[p.kind]));
  return svg;
}

function legend(kinds) {
  return h('div', 'eval-legend', ...Object.entries(SERIES).filter(([k]) => kinds.has(k)).map(([, k]) => {
    const sw = s('svg', { width: 16, height: 16, viewBox: '0 0 16 16', 'aria-hidden': 'true' });
    sw.append(k.shape === 'line' ? s('path', { d: 'M1 8H15', stroke: k.color, 'stroke-width': 2 }) : marker(k.shape, 8, 8, k.color, 4.5));
    return h('span', null, sw, k.label);
  }));
}

// ---- replay: play the eval back one run at a time ------------------------------
const TIER_COLOR = { haiku: '#c9c9c9', sonnet: '#9a9a9a', opus: '#6a6a6a', fable: '#222' };
const SPEEDS = [['1×', 1100], ['4×', 260], ['16×', 60]];
function replayView(rep, cfg) {
  const root = h('div', 'replay');
  const policies = rep.policies.filter(p => p.kind !== 'learned');
  let pol = 0, i = -1, timer = null, speed = 0, events = [];
  // A fixed shuffle so categories are mixed, then every repeat of every prompt.
  const order = rep.tasks.map((t, k) => [k, (Math.sin(k * 99.13) * 1e4) % 1]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  const reps = Math.max(...rep.tasks.flatMap(t => Object.values(t.runs).map(r => r.length)));
  const build = () => {
    const P = policies[pol];
    events = [];
    for (let r = 0; r < reps; r++) for (const k of order) { const t = rep.tasks[k], arm = P.arms[k], run = t.runs[arm]?.[r]; if (run) events.push({ t, arm, run, r }); }
  };
  const name = arm => rep.arm_names?.[arm] ?? arm;
  const btn = (label, aria, fn) => { const b = h('button', 'replay-btn', label); b.type = 'button'; b.setAttribute('aria-label', aria); b.addEventListener('click', fn); return b; };
  const play = btn('▶ Play', 'Play', () => timer ? stop() : start());
  const stop = () => { clearInterval(timer); timer = null; play.textContent = '▶ Play'; };
  const start = () => { if (i >= events.length - 1) i = -1; play.textContent = '❚❚ Pause'; timer = setInterval(() => { if (i >= events.length - 1) return stop(); i++; draw(); }, SPEEDS[speed][1]); };
  const speedBtn = btn(SPEEDS[0][0], 'Speed', () => { speed = (speed + 1) % SPEEDS.length; speedBtn.textContent = SPEEDS[speed][0]; if (timer) { stop(); start(); } });
  const select = h('select', 'replay-select'); select.setAttribute('aria-label', 'Router to replay');
  policies.forEach((p, k) => { const o = h('option', null, p.name); o.value = k; select.append(o); });
  select.addEventListener('change', () => { pol = +select.value; build(); i = Math.min(i, events.length - 1); draw(); });
  const counter = h('span', 'replay-counter'), stage = h('div', 'replay-stage'), tally = h('div', 'replay-tally'), strip = h('div', 'replay-strip');
  strip.setAttribute('aria-label', 'Every run so far; click one to jump to it');
  root.append(
    h('div', 'replay-controls', play, btn('⏮', 'Back to start', () => { stop(); i = -1; draw(); }), btn('◀', 'Previous run', () => { stop(); i = Math.max(-1, i - 1); draw(); }), btn('▶︎', 'Next run', () => { stop(); i = Math.min(events.length - 1, i + 1); draw(); }), speedBtn, select, counter),
    stage, tally, strip);
  const chip = (label, on) => h('span', `jchip ${on ? 'on' : ''}`, label);
  const DEPTH = ['none', 'few steps', 'plan', 'long'];
  function draw() {
    counter.textContent = `Run ${i + 1} of ${events.length}`;
    if (i < 0) { stage.replaceChildren(h('p', 'route-empty', `Press play to watch ${policies[pol].name} route ${events.length} runs: ${rep.tasks.length} prompts${reps > 1 ? ` × ${reps} runs each` : ''}.`)); }
    else {
      const e = events[i], [ok, cost, said] = e.run, tier = e.arm.split(':')[0];
      stage.replaceChildren(
        h('div', 'rs-prompt', h('span', 'rs-tags', h('span', 'jchip', e.t.category), e.t.bucket ? h('span', `jchip b-${e.t.bucket}`, e.t.bucket) : null, reps > 1 ? h('span', 'jchip', `run ${e.r + 1}`) : null), h('p', null, `“${e.t.prompt}”`)),
        h('div', 'rs-row', h('span', 'rs-k', 'Jev'), h('span', 'rs-chips', chip(`depth: ${DEPTH[e.t.jev.depth]}`, e.t.jev.depth >= 2), chip('expertise', e.t.jev.expertise), chip('high stakes', e.t.jev.high_stakes), chip('large output', e.t.jev.large_output), chip('nuanced writing', e.t.jev.nuanced_writing))),
        h('div', 'rs-row', h('span', 'rs-k', 'Routed to'), h('span', 'rs-model', h('i', null), name(e.arm))),
        h('div', `rs-row rs-result ${ok ? 'pass' : 'fail'}`, h('span', 'rs-k', ok ? '✓ Passed' : '✗ Failed'), h('span', null, h('code', null, said), e.t.answer && !ok ? h('span', 'rs-sub', ` · expected ${e.t.answer}`) : null, h('span', 'rs-sub', ` · $${cost.toFixed(5)}`))));
      stage.querySelector('.rs-model i').style.background = TIER_COLOR[tier];
    }
    const seen = events.slice(0, i + 1), passed = seen.filter(e => e.run[0]).length, spent = seen.reduce((a, e) => a + e.run[1], 0);
    const tiers = {}; for (const e of seen) { const k = name(e.arm).split(' · ')[0]; tiers[k] = (tiers[k] || 0) + 1; }
    tally.replaceChildren(
      h('span', null, h('strong', null, seen.length ? pct(passed / seen.length) : '–'), ' passed'),
      h('span', null, h('strong', null, `${passed}/${seen.length}`), ' runs'),
      h('span', null, h('strong', null, seen.length ? usd(1000 * spent / seen.length) : '–'), ' per 1k prompts'),
      h('span', 'rs-mix', ...Object.entries(tiers).map(([k, n]) => `${k} ${Math.round(100 * n / seen.length)}%`).join(' · ')));
    if (strip.childElementCount !== events.length) strip.replaceChildren(...events.map((_, k) => { const d = h('button', 'dot'); d.type = 'button'; d.setAttribute('aria-label', `Run ${k + 1}`); d.addEventListener('click', () => { stop(); i = k; draw(); }); return d; }));
    [...strip.children].forEach((d, k) => { d.className = `dot ${k > i ? '' : events[k].run[0] ? 'pass' : 'fail'} ${k === i ? 'now' : ''}`; });
  }
  build(); draw();
  return root;
}

function render(cfg, data, rep) {
  const section = document.getElementById(cfg.section); if (!section) return;
  const armLabel = a => data.arm_names?.[a] ?? a.replace(':', ' · ');
  const best = kind => data.policies.filter(p => p.kind === kind);
  const router = best('router')[0];
  const learned = [...data.learned_curve].sort((a, b) => Math.abs(Math.log(a.cost / router.cost)) - Math.abs(Math.log(b.cost / router.cost)))[0];
  const box = h('div', 'eval-chart-box'), tipEl = h('div', 'eval-tip'); tipEl.hidden = true;
  const tip = (p, fx, fy) => {
    if (!p) { tipEl.hidden = true; return; }
    tipEl.replaceChildren(...[h('strong', null, p.name), h('span', null, `${pct(p.pass)} pass · ${usd(p.cost)} per 1k`), p.random_p95 != null ? h('span', null, p.beats_random ? `beats random routing (p95 ${pct(p.random_p95)})` : `within random routing (p95 ${pct(p.random_p95)})`) : null].filter(Boolean));
    tipEl.style.left = `${fx * 100}%`; tipEl.style.top = `${fy * 100}%`; tipEl.hidden = false;
  };
  box.append(chart(data, tip), tipEl);
  const rows = [
    ...['router', 'router-v2', 'router-v3'].flatMap(k => best(k).map(p => [SERIES[k].label, p])),
    ['Choice · low effort', data.policies.find(p => p.kind === 'choice' && p.name.includes('low'))],
    ['Choice · high effort', data.policies.find(p => p.kind === 'choice' && p.name.includes('high'))],
    [`Learned router · λ=${learned.lambda}`, data.policies.find(p => p.kind === 'learned' && p.lambda === learned.lambda)],
    ...best('fixed').map(p => [p.name, p])
  ].filter(([, p]) => p);
  const table = h('table', 'tt eval-table', h('thead', null, h('tr', null, ...['Policy', 'Pass rate', 'Per 1k prompts', 'vs. random routing'].map(c => h('th', null, c)))),
    h('tbody', null, ...rows.map(([name, p]) => h('tr', SHORT[p.kind] ? 'hit' : '', h('td', null, name), h('td', null, pct(p.pass)), h('td', null, usd(p.cost)),
      h('td', null, p.random_p95 == null ? '–' : h('span', `agree-tag ${p.beats_random ? 'win' : ''}`, p.beats_random ? 'beats' : 'no better'))))));
  const c = data.router_diagnosis.counts, total = data.tasks;
  const verdicts = [['right', 'Right size'], ['more than needed', 'More than needed'], ['too weak', 'Too weak'], ['nothing passes', 'Nothing passes']].filter(([k]) => c[k]);
  const misses = data.router_diagnosis.tasks.filter(t => t.verdict === 'too weak');
  const kinds = new Set(data.policies.map(p => p.kind));
  const kids = [
    h('p', 'eval-intro', cfg.intro),
    cfg.finding ? h('p', 'eval-finding', h('strong', null, 'Finding: '), cfg.finding) : null,
    data.partial ? h('p', 'eval-partial', `Results so far: more runs are in progress. Updated ${new Date(data.generated).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`) : null,
    h('p', 'eval-meta', `${data.tasks} prompts with code-checked answers · ${data.reps} run${data.reps === 1 ? '' : 's'} of each on ${data.arms.length} model/effort combinations · ${usd(data.spent_usd)} spent · ${data.jev_model ?? ''}`),
    data.tiers ? h('p', 'eval-tiers', 'Open models played the router’s four tiers: ', ...Object.entries(data.tiers).flatMap(([t, m], i, all) => [h('strong', null, `${t[0].toUpperCase()}${t.slice(1)}`), ` → ${m.name}${i < all.length - 1 ? ', ' : '.'}`])) : null,
    rep ? h('h3', 'eval-h3', 'Replay') : null,
    rep ? replayView(rep, cfg) : null,
    h('h3', 'eval-h3', 'Cost vs. pass rate'),
    legend(kinds), box,
    h('p', 'note', 'Each point routes all prompts one way. Up and to the left is better. "vs. random routing" deals the same mix of models to prompts at random 10,000 times; a policy beats it if it scores above the 95th percentile. Lines join points of the same color. The learned router fits a small model on Jev’s judgments (one category held out at a time) and trades pass chance against cost with a dial λ; the chart shows λ=0 (most likely to pass), λ=32 and λ=256 (cheapest).'),
    h('h3', 'eval-h3', 'Policies'), h('div', 'cmp-scroll', table),
    data.by_bucket ? h('h3', 'eval-h3', 'By difficulty') : null,
    data.by_bucket ? h('p', 'note', `Difficulty is measured, not guessed: a prompt is easy if all ${data.arms.length} model/effort combinations passed it in a calibration run, medium if 1–2 failed, hard if 3 or more failed. ${Object.entries(data.bucket_counts).map(([b, n]) => `${n} ${b}`).join(', ')}.`) : null,
    data.by_bucket ? h('div', 'cmp-scroll', h('table', 'tt eval-table', h('thead', null, h('tr', null, ...['Policy', 'Easy', 'Medium', 'Hard'].map(x => h('th', null, x)))),
      h('tbody', null, ...data.by_bucket.filter(p => p.kind !== 'oracle' && (p.kind !== 'fixed' || / · low$/.test(p.name))).map(p => h('tr', SHORT[p.kind] ? 'hit' : '', h('td', null, p.name),
        ...['easy', 'medium', 'hard'].map(b => h('td', null, p[b] ? `${pct(p[b].pass)} · ${usd(p[b].cost)}` : '–'))))))) : null,
    h('h3', 'eval-h3', 'Where Router v1 sent each prompt'),
    h('div', 'eval-verdicts', ...verdicts.map(([k, label]) => h('div', `v-${k.replace(/ /g, '-')}`, h('strong', null, String(c[k])), h('span', null, label)))),
    h('p', 'note', `Compared with the cheapest combination that passed each prompt at least half the time. “Too weak” failed; “more than needed” passed but cost more than necessary. Out of ${total} prompts.`),
    misses.length ? h('details', 'eval-misses', h('summary', null, `Prompts the router under-served (${misses.length})`),
      h('ul', null, ...misses.map(t => h('li', null, h('span', null, t.prompt), h('span', 'cmp-sub', ` — sent to ${armLabel(t.router)}, cheapest passing: ${t.cheapest_passing ? armLabel(t.cheapest_passing) : 'none'}`))))) : null
  ].filter(Boolean);
  // A collapsed card is a closed disclosure whose summary is the card's title.
  section.replaceChildren(...(cfg.collapsed
    ? [h('details', 'eval-collapse', h('summary', null, h('h2', null, cfg.title)), ...kids)]
    : [h('div', 'demo-heading', h('h2', null, cfg.title)), ...kids]));
  section.hidden = false;
}

const get = url => fetch(url, { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null);
for (const cfg of EVALS) Promise.all([get(cfg.summary), get(cfg.replay)]).then(([d, rep]) => { if (d?.policies?.length) render(cfg, d, rep?.tasks?.length ? rep : null); });
