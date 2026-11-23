// jev-lint, part two: check an integration on your own labeled examples. Jev answers your
// questions once per example (through /api/jev, demo p2j_try); then check-core.js, in a
// worker, scores decide(), tries other values for each number between 0 and 1 in it, and
// estimates by leave-one-out whether a change holds up. The method and its test on the
// outcome suite: /jev/skill-issue/iterating/ (code: takehome/skill-issue/check/).
import { parseExamples } from './check-core.js?v=check-1';
import { PRESETS } from './check-presets.js?v=check-1';

const MAX_EXAMPLES = 50, MAX_QUESTIONS = 12, MAX_STATE = 7000, FLAG_AT = 0.7;
const RECORDED = 'Recorded Jev answers · jev-1.14.0';
// The unseen-dependency check (takehome/skill-issue/outcome/lint-v2.mjs).
const UNSEEN = {
  unseen_dependency: {
    type: 'noul',
    instructions: 'Does the right answer to `question` depend on information that is in neither `question` nor `example_state`?',
    criteria: {
      true: 'It needs facts a careful reader of the question and the state cannot see: the app owner\'s private policy or thresholds, prices, which of their models, staff or systems can handle what, a person\'s history, or what will happen later. For example, "Which model should handle this prompt?" or "Is this a high-value customer?" with no customer data in the state.',
      false: 'A careful reader could answer from the question and the state alone: whether a message is spam, whether a reply is rude, which listed team a ticket belongs to, whether an answer matches the passage it was drawn from. Wording such as "should this be blocked?" is fine when the question itself says what to block.',
    },
  },
};

const $ = id => document.getElementById(id);
const h = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids.filter(k => k != null)); return e; };
const pct = x => `${Math.round(100 * x)}%`;
const short = (v, n = 180) => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s.length > n ? s.slice(0, n) + '…' : s; };
const round = a => JSON.parse(JSON.stringify(a || {}, (k, v) => typeof v === 'number' ? +v.toFixed(2) : v));
const trim = v => typeof v === 'string' ? (v.length > 600 ? v.slice(0, 600) + '…' : v) : Array.isArray(v) ? v.slice(0, 5).map(trim) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, trim(x)])) : v;
// Jev's answers for the questions and examples last run, so editing only decide() needs no new calls.
let cache = null, busy = false;

// --- Reading the form.
function readInputs() {
  let parsed;
  try { parsed = JSON.parse($('check-questions').value); } catch { throw new Error('Questions must be valid JSON: the object you send Jev as `questions`.'); }
  const questions = parsed?.questions || parsed;
  if (!questions || typeof questions !== 'object' || Array.isArray(questions) || !Object.keys(questions).length) throw new Error('Questions must be an object of named questions.');
  if (Object.keys(questions).length > MAX_QUESTIONS) throw new Error(`Up to ${MAX_QUESTIONS} questions.`);
  const code = $('check-code').value;
  if (!/decide/.test(code)) throw new Error('Paste a function named decide(answers, state).');
  const examples = parseExamples($('check-examples').value);
  if (examples.length < 2) throw new Error('Paste at least two labeled examples; 20 or more is a good start.');
  if (examples.length > MAX_EXAMPLES) throw new Error(`Up to ${MAX_EXAMPLES} examples per run.`);
  const big = examples.findIndex(e => JSON.stringify(e.state).length > MAX_STATE);
  if (big >= 0) throw new Error(`Example ${big + 1}'s state is over ${MAX_STATE.toLocaleString('en-US')} characters.`);
  return { questions, code, examples };
}
const updateCount = () => { let n = 0; try { n = parseExamples($('check-examples').value).length; } catch {} $('check-count').textContent = `${n} / ${MAX_EXAMPLES}`; };

// --- Jev, live: one call per example, four at a time.
async function callJev(questions, state) {
  const r = await fetch('/api/jev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demo: 'p2j_try', questions, state }), signal: AbortSignal.timeout(45000) });
  let data; try { data = await r.json(); } catch { throw new Error('The server returned an unreadable response. Please try again.'); }
  if (data.human_until) window.jevHuman?.set(data.human_until);
  if (!r.ok) {
    if (data.needs_human) throw Object.assign(new Error('Verify you’re human first: press Ask Jev in the editor above once, then run this again.'), { fatal: true });
    throw Object.assign(new Error(data.error || 'Jev could not answer.'), { fatal: r.status === 400 || r.status === 402 || r.status === 503 });
  }
  return data.answers;
}
async function liveAnswers(questions, examples) {
  const out = new Array(examples.length).fill(null);
  let next = 0, done = 0, fatal = null;
  const worker = async () => {
    while (next < examples.length && !fatal) {
      const i = next++;
      try { out[i] = await callJev(questions, examples[i].state); }
      catch (e) { if (e.fatal) fatal = e; }
      $('check-source').textContent = `Asking Jev… ${++done} / ${examples.length}`;
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  if (fatal) throw fatal;
  return out;
}
async function liveUnseen(questions, state) {
  const per = {};
  await Promise.all(Object.entries(questions).map(async ([id, q]) => {
    const question = { type: q.type, instructions: q.instructions, ...(q.criteria ? { criteria: q.criteria } : {}) };
    try { per[id] = (await callJev(UNSEEN, { question, example_state: trim(state) })).unseen_dependency.noul; } catch { per[id] = null; }
  }));
  return per;
}

// --- The computation, in a worker with a time limit.
function runCheck(payload) {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./check-worker.js?v=check-1', import.meta.url), { type: 'module' });
    const timer = setTimeout(() => { w.terminate(); reject(new Error('decide() didn’t finish in 20 seconds. Is there a loop in it?')); }, 20000);
    w.onmessage = e => { clearTimeout(timer); w.terminate(); e.data.error ? reject(new Error(e.data.error)) : resolve(e.data.report); };
    w.onerror = e => { clearTimeout(timer); w.terminate(); reject(new Error(e.message || 'The check failed.')); };
    w.postMessage(payload);
  });
}

// --- Rendering.
function curve(n) {
  const W = 220, H = 44, x = v => 4 + v * (W - 8), y = s => H - 4 - s * (H - 8);
  const ns = 'http://www.w3.org/2000/svg', el = (t, a) => { const e = document.createElementNS(ns, t); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); return e; };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'check-curve', role: 'img', 'aria-label': `Score by value of ${n.text}: ${n.curve.map(c => `${c.value} ${pct(c.score)}`).join(', ')}` });
  svg.append(el('line', { x1: 4, x2: W - 4, y1: y(0.5), y2: y(0.5), class: 'check-curve-mid' }));
  svg.append(el('line', { x1: x(n.value), x2: x(n.value), y1: 2, y2: H - 2, class: 'check-curve-now' }));
  svg.append(el('polyline', { points: n.curve.map(c => `${x(c.value).toFixed(1)},${y(c.score).toFixed(1)}`).join(' '), class: 'check-curve-line' }));
  svg.append(el('circle', { cx: x(n.best.value), cy: y(n.best.score), r: 3.5, class: 'check-curve-best' }));
  return svg;
}
function render({ report: r, examples, answers, unseen, code, source }) {
  const kids = [];
  kids.push(h('p', 'lint-verdict', `Routes ${pct(r.score)} of ${r.n} examples to the right action.`));
  kids.push(h('p', 'note', `Balanced accuracy: for each action, the share of its examples that got it, averaged over actions. Always picking one action scores ${pct(r.chance)}.`));
  kids.push(h('div', 'check-per', ...r.per.map(p => {
    const bar = h('div', 'lint-bar'), fill = h('div', 'lint-fill'); fill.style.width = `${Math.round(100 * p.right / p.n)}%`; bar.append(fill);
    const others = Object.entries(p.got).filter(([a]) => a !== p.action).map(([a, n]) => `${n} to ${a}`).join(', ');
    return h('div', 'check-per-row', h('div', 'lint-row-head', h('code', null, p.action), h('span', 'lint-p', `${p.right}/${p.n}`), others ? h('span', 'lint-tag', others) : null), bar);
  })));
  if (r.numbers.length) {
    kids.push(h('h4', null, 'The numbers in decide()'));
    kids.push(h('div', 'check-nums', ...r.numbers.map(n => h('div', 'check-num',
      h('div', 'check-num-head', h('span', 'lint-step-label', `line ${n.line} · ${n.text}`), h('code', null, short(n.context, 90))),
      curve(n),
      h('p', 'check-num-text', `Score by value, 0 to 1 (dashed: yours, dot: best). ${n.value} scores ${pct(n.now)}. Best here: ${n.best.range[0] === n.best.range[1] ? n.best.value : `${n.best.range[0]}–${n.best.range[1]}`} (${pct(n.best.score)}). Fitted and checked by leave-one-out: ${pct(n.loo)}.`)))));
    const s = r.suggest;
    if (s) {
      const use = h('button', 'chip', `Use ${s.to}`); use.type = 'button';
      use.addEventListener('click', () => { $('check-code').value = s.code; markEdited(); $('check-code').focus(); });
      kids.push(h('div', 'check-suggest', h('p', null, h('strong', null, `Change ${s.from} to ${s.to} on line ${s.line}.`), ` On examples it wasn’t fitted to, expect about ${pct(s.expected)}, up from ${pct(s.now)}.`), use));
      kids.push(h('p', 'note check-calibration', 'That estimate runs high. Tested on 239 suggestions for agent-written integrations, the change helped on unseen examples 60% of the time and hurt 22%, and the average gain was 4 points, about a third of what the estimate said. ', Object.assign(h('a', null, 'The test.'), { href: '/jev/skill-issue/iterating/#check-it-on-your-examples' })));
    } else kids.push(h('div', 'check-suggest is-keep', h('p', null, h('strong', null, 'Keep your numbers.'), ' No change beats the current score by 5 points or more once it has to hold up on examples it wasn’t fitted to.')));
  } else if (r.actions.length > 1) kids.push(h('p', 'note', 'No numbers between 0 and 1 in decide() to fit. (Score cuts such as 1.5 aren’t swept yet.)'));
  const warn = Object.entries(unseen || {}).filter(([, p]) => p >= FLAG_AT);
  if (warn.length) kids.push(h('div', 'lint-code', h('h4', null, 'Jev answers this from its own knowledge'), h('p', 'check-warn', `${warn.map(([id, p]) => `${id} (${p.toFixed(2)})`).join(', ')}: the right answer depends on something in neither the question nor the state. That can work, and these examples are how you find out.`)));
  if (r.notes.length) kids.push(h('div', 'lint-code', h('h4', null, 'Notes'), h('ul', null, ...r.notes.map(n => h('li', null, n)))));
  if (r.misses.length) {
    kids.push(h('h4', null, `Misses (${r.misses.length}${r.misses.length > 8 ? ', first 8' : ''})`));
    kids.push(h('ol', 'check-misses', ...r.misses.slice(0, 8).map(m => h('li', null,
      h('code', 'check-state', short(examples[m.i].state)),
      h('span', 'check-miss-line', `want ${m.want} · got ${m.got ?? `error (${m.error})`}`),
      h('span', 'check-miss-jev', `Jev: ${short(round(answers[m.i]), 220)}`)))));
  }
  $('check-result').replaceChildren(...kids);
  $('check-source').textContent = source;
}

// --- Running.
const showError = msg => { $('check-error').textContent = msg; $('check-error').hidden = !msg; };
async function run(e) {
  e?.preventDefault();
  if (busy) return;
  showError('');
  let inp; try { inp = readInputs(); } catch (err) { showError(err.message); return; }
  busy = true; $('check-run').disabled = true;
  try {
    const q = $('check-questions').value, ex = $('check-examples').value;
    let answers, unseen, source;
    if (cache && cache.q === q && cache.ex === ex) ({ answers, unseen, source } = cache);
    else {
      $('check-source').textContent = 'Asking Jev…';
      const started = Date.now();
      [answers, unseen] = await Promise.all([liveAnswers(inp.questions, inp.examples), liveUnseen(inp.questions, inp.examples[0].state)]);
      if (answers.every(a => !a)) throw new Error('Jev answered none of the examples. Check the questions.');
      source = `Live · jev-1.14.0 · ${inp.examples.length} examples · ${((Date.now() - started) / 1000).toFixed(1)} s`;
      cache = { q, ex, answers, unseen, source };
    }
    const report = await runCheck({ code: inp.code, examples: inp.examples, answers });
    render({ report, examples: inp.examples, answers, unseen, code: inp.code, source });
  } catch (err) {
    $('check-source').textContent = '';
    showError(err.name === 'TimeoutError' ? 'A request timed out. Please try again.' : err.message);
  } finally { busy = false; $('check-run').disabled = false; }
}

// --- Recorded presets: real integrations from the outcome suite, with Jev's recorded answers.
function markEdited() { for (const b of document.querySelectorAll('#check-presets .chip')) b.classList.remove('active'); updateCount(); }
function openPreset(p) {
  $('check-questions').value = JSON.stringify(p.questions, null, 2);
  $('check-code').value = p.code;
  $('check-examples').value = p.examples.map(e => JSON.stringify(e)).join('\n');
  updateCount();
  cache = { q: $('check-questions').value, ex: $('check-examples').value, answers: p.answers, unseen: p.unseen, source: RECORDED };
  for (const b of document.querySelectorAll('#check-presets .chip')) b.classList.toggle('active', b.dataset.id === p.id);
  $('check-lesson').textContent = p.lesson;
  run();
}
$('check-presets').replaceChildren(...PRESETS.map(p => { const b = h('button', 'chip', p.label); b.type = 'button'; b.dataset.id = p.id; b.addEventListener('click', () => openPreset(p)); return b; }));
for (const id of ['check-questions', 'check-code', 'check-examples']) $(id).addEventListener('input', () => { markEdited(); $('check-lesson').textContent = id === 'check-code' ? 'Edited decide(): the next run reuses Jev’s answers.' : 'Edited: the next run asks Jev live, one call per example.'; });
$('check-form').addEventListener('submit', run);
if (PRESETS.length) openPreset(PRESETS[0]);
