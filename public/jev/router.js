// Model Router. Jev makes five judgments about a prompt (see routerQuestions in
// functions/api/jev.js). Everything below is plain code: reading the answers,
// and two truth tables that pick a Claude model and a reasoning level. Edit the tables, not the questions,
// to change routing policy.
const $ = id => document.getElementById(id);

// ---- Policy: everything a person would audit lives in this block ----------
const YES = 0.7, NO = 0.3;            // Noul thresholds; the band between is "unsure"
const UNSURE_COUNTS_AS = true;        // err toward more capability when Jev is unsure
const DEPTH = ['none', 'few steps', 'plan', 'long'];
const DEPTH_TEXT = ['None', 'A few steps', 'A multi-step plan', 'Long, careful reasoning'];
const LEVELS = ['Off', 'Low', 'Medium', 'High'];
const MODELS = { haiku: 'Claude Haiku', sonnet: 'Claude Sonnet', opus: 'Claude Opus', fable: 'Claude Fable' };
// Reasoning level: one row per (depth, high stakes). Every combination has an outcome.
const REASONING_TABLE = [
  { depth: 0, stakes: false, level: 0 }, { depth: 0, stakes: true, level: 1 },
  { depth: 1, stakes: false, level: 1 }, { depth: 1, stakes: true, level: 2 },
  { depth: 2, stakes: false, level: 2 }, { depth: 2, stakes: true, level: 3 },
  { depth: 3, stakes: null,  level: 3 }
];
// Model level: ordered rules, first match wins. The last row always matches.
const MODEL_RULES = [
  { when: 'Large piece of work', test: j => j.large_output, tier: 'fable' },
  { when: 'Depth is long', test: j => j.depth === 3, tier: 'fable' },
  { when: 'Expertise and depth is plan', test: j => j.expertise && j.depth >= 2, tier: 'opus' },
  { when: 'Expertise and high stakes', test: j => j.expertise && j.high_stakes, tier: 'opus' },
  { when: 'Expertise', test: j => j.expertise, tier: 'sonnet' },
  { when: 'Depth is plan', test: j => j.depth === 2, tier: 'sonnet' },
  { when: 'Nuanced writing', test: j => j.nuanced_writing, tier: 'sonnet' },
  { when: 'High stakes', test: j => j.high_stakes, tier: 'sonnet' },
  { when: 'Otherwise', test: () => true, tier: 'haiku' }
];
const NOULS = {
  expertise: { label: 'Expertise', q: 'Does answering `prompt` well take specialist expertise?' },
  high_stakes: { label: 'High stakes', q: 'Could a wrong answer to `prompt` cause real harm or cost?' },
  large_output: { label: 'Large piece of work', q: 'Does `prompt` ask for a large piece of work?' },
  nuanced_writing: { label: 'Nuanced writing', q: 'Does `prompt` ask for writing where tone and style matter?' }
};
const PROMPTS = [
  'hi! how’s it going?',
  'What’s the capital of Australia?',
  'Convert 72°F to Celsius',
  'can you write a small program that does addition?',
  'Write a haiku about Monday mornings',
  'Rewrite my text to my landlord so it’s firm but polite: the heat has been broken for 3 weeks',
  'Why does my React useEffect run twice in development?',
  'Is it safe to take ibuprofen with my blood pressure medication?',
  'Compare a Roth IRA and a traditional 401(k) for someone earning $90k',
  'My Postgres query got 10x slower after I added an index. Why?',
  'Review the non-compete clause in my employment contract for red flags',
  'Write a 3,000-word short story about a lighthouse keeper',
  'Prove that there are infinitely many primes',
  'Design the database schema and API for a multi-tenant SaaS billing system',
  'Can you rebuild this OS in Rust?'
];
// ---- Reading Jev's answers --------------------------------------------------
const read = p => p >= YES ? 'yes' : p <= NO ? 'no' : 'unsure';
const truthy = p => read(p) === 'yes' || (read(p) === 'unsure' && UNSURE_COUNTS_AS);
// The Score's `score` is a weighted mean and can sit between two peaks, so code
// reads the most likely level instead (ties go to the higher level).
const topLevel = probs => DEPTH.reduce((best, _, i) => probs[i] >= probs[best] ? i : best, 0);
export function judge(answers) {
  const j = { depth: topLevel(DEPTH.map((_, i) => answers.reasoning_depth.probabilities[String(i)])) };
  for (const id of Object.keys(NOULS)) j[id] = truthy(answers[id].noul);
  return j;
}
export function decide(j) {
  const reasoningRow = REASONING_TABLE.findIndex(r => r.depth === j.depth && (r.stakes === null || r.stakes === j.high_stakes));
  const ruleRow = MODEL_RULES.findIndex(r => r.test(j));
  return { reasoningRow, reasoning: REASONING_TABLE[reasoningRow].level, ruleRow, tier: MODEL_RULES[ruleRow].tier };
}

// ---- Page -------------------------------------------------------------------
const h = (tag, cls, ...kids) => { const el = document.createElement(tag); if (cls) el.className = cls; for (const k of kids) if (k != null) el.append(k); return el; };
const pct = n => n.toFixed(2);
const cache = new Map();
let current = null, widgetId, token = '', busy = false, rendered = false;
const human = () => window.jevHuman?.ok() || !!token;
const showError = m => { $('route-error').textContent = m; $('route-error').hidden = !m; };
const setBusy = b => { busy = b; for (const el of document.querySelectorAll('#router [data-prompt], #route-run, #route-prompt')) el.disabled = b; };

function renderOutput() {
  const out = $('route-output');
  if (!current) { out.replaceChildren(h('p', 'route-empty', 'Pick a prompt to see where it goes.')); return; }
  const { prompt, data } = current, d = decide(judge(data.answers));
  const level = LEVELS[d.reasoning];
  out.replaceChildren(
    h('p', 'route-quote', `“${prompt}”`),
    h('div', 'route-pick',
      h('div', null, h('span', 'route-k', 'Model'), h('strong', null, MODELS[d.tier]), h('span', 'route-sub', `rule ${d.ruleRow + 1}: ${MODEL_RULES[d.ruleRow].when.toLowerCase()}`)),
      h('div', null, h('span', 'route-k', 'Reasoning'), h('strong', null, level), h('span', 'route-sub', h('code', null, d.reasoning === 0 ? 'thinking: off' : `effort: "${level.toLowerCase()}"`)))),
    h('p', 'route-meta', `${data.model} ·${Math.round(data.elapsed_ms)}ms · 1 call, 5 questions${data.cached ? ' · cached, no new call' : ''}`));
}

function traceRow(type, question, options, readout, tone) {
  return h('div', 'trace-row' + (tone ? ` ${tone}` : ''),
    h('span', 'trace-type', type),
    h('div', 'trace-body', h('p', 'trace-q', question), h('p', 'trace-opts', ...options)),
    h('span', 'trace-read', readout));
}
function renderTrace() {
  const box = $('route-trace');
  if (!current) { box.replaceChildren(h('p', 'route-empty', 'Each question Jev answered, with its probabilities and how code reads them.')); return; }
  const a = current.data.answers, j = judge(a), probs = DEPTH.map((_, i) => a.reasoning_depth.probabilities[String(i)]);
  const rows = [traceRow('score', 'How much working out does a good answer to `prompt` take?',
    DEPTH.map((name, i) => h('span', i === j.depth ? 'opt on' : 'opt', `${name} ${pct(probs[i])}`)),
    `${DEPTH[j.depth]}`, 'is-level')];
  for (const [id, meta] of Object.entries(NOULS)) {
    const p = a[id].noul, r = read(p), on = j[id];
    rows.push(traceRow('noul', meta.q,
      [h('span', p >= .5 ? 'opt on' : 'opt', `true ${pct(p)}`), h('span', p < .5 ? 'opt on' : 'opt', `false ${pct(1 - p)}`),
       r === 'unsure' ? h('span', 'opt note', `unsure → counts as ${UNSURE_COUNTS_AS ? 'yes' : 'no'}`) : null],
      on ? 'yes' : 'no', r === 'unsure' ? 'is-unsure' : on ? 'is-yes' : 'is-no'));
  }
  box.replaceChildren(...rows);
}

function table(head, rows) {
  return h('table', 'tt', h('thead', null, h('tr', null, ...head.map(c => h('th', null, c)))), h('tbody', null, ...rows));
}
function renderTables() {
  const j = current ? judge(current.data.answers) : null, d = j ? decide(j) : null;
  const yn = v => v === null ? 'any' : v ? 'yes' : 'no';
  const reasoning = table(['Depth', 'High stakes', 'Reasoning'], REASONING_TABLE.map((r, i) =>
    h('tr', d && i === d.reasoningRow ? 'hit' : '', h('td', null, DEPTH[r.depth]), h('td', null, yn(r.stakes)), h('td', null, LEVELS[r.level]))));
  const model = table(['#', 'If', 'Model'], MODEL_RULES.map((r, i) => {
    const state = !d ? '' : i === d.ruleRow ? 'hit' : i < d.ruleRow ? 'miss' : 'skip';
    return h('tr', state, h('td', null, String(i + 1)), h('td', null, r.when), h('td', null, MODELS[r.tier]));
  }));
  $('route-table').replaceChildren(
    h('h4', null, '1 · Reasoning level'), reasoning,
    h('h4', null, '2 · Model', h('span', null, ' first match wins')), model,
    h('p', 'note', `Nouls read yes at ≥ ${YES}, no at ≤ ${NO}. In between counts as ${UNSURE_COUNTS_AS ? 'yes' : 'no'}, so the router errs toward more capability.`));
}
function renderApi() {
  if (!current) return;
  $('route-request').textContent = JSON.stringify(current.data.request, null, 2);
  $('route-response').textContent = JSON.stringify(current.data.response, null, 2);
}
// ---- Anti-pattern: Jev picks the model; "code" just takes the top option ----
const ANTI = ['Sonnet', 'Opus', 'Fable'];
function renderAnti(pending) {
  const c = current?.data.answers.model_choice;
  if (pending || !c) {
    $('anti-output').replaceChildren(h('p', 'route-empty', pending ? 'Asking Jev to pick a model…' : 'Pick a prompt above to see what one Choice would pick.'));
    $('anti-trace').replaceChildren(h('p', 'route-empty', 'One question. Jev answers it with a decision.'));
  } else {
    $('anti-output').replaceChildren(
      h('p', 'route-quote', `“${current.prompt}”`),
      h('div', 'route-pick',
        h('div', null, h('span', 'route-k', 'Model'), h('strong', null, `Claude ${c.choice}`), h('span', 'route-sub', `${pct(c.probabilities[c.choice])} probability`)),
        h('div', null, h('span', 'route-k', 'Reasoning'), h('strong', 'muted', '—'), h('span', 'route-sub', 'not asked, so no answer'))),
      h('p', 'route-meta', 'Same call as the router'));
    $('anti-trace').replaceChildren(traceRow('choice', 'Which model should I use for this prompt?',
      ANTI.map(k => h('span', k === c.choice ? 'opt on' : 'opt', `${k} ${pct(c.probabilities[k])}`)), c.choice, 'is-anti'));
  }
  const rows = ANTI.map(k => h('tr', c && k === c.choice ? 'hit' : '', h('td', null, k), h('td', null, c ? pct(c.probabilities[k]) : '–'), h('td', null, `Claude ${k}`)));
  $('anti-table').replaceChildren(
    h('h4', null, 'argmax', h('span', null, ' highest probability wins')),
    table(['Option', 'Probability', 'Use'], rows),
    h('p', 'note', 'That’s the whole table. There are no inputs to inspect, no rows to edit, and no way to explain why one model won.'));
}
const renderAll = () => { renderOutput(); renderTrace(); renderTables(); renderApi(); renderAnti(); };

function renderWidget() {
  if (rendered || !window.turnstile || window.jevHuman?.ok()) return;
  rendered = true; $('route-human-check').hidden = false;
  widgetId = window.turnstile.render('#route-human-check', {
    sitekey: '0x4AAAAAAFoxX_DwyD2--6xP', action: 'jev_check', theme: 'light',
    callback: t => { token = t; showError(''); },
    'expired-callback': () => { token = ''; },
    'error-callback': () => { token = ''; showError('Human verification unavailable. Reload to try again.'); }
  });
}
window.jevRenderRouter = renderWidget;
window.addEventListener('jev-human-needed', () => { rendered = false; renderWidget(); });

async function route(prompt) {
  prompt = prompt.trim();
  if (!prompt || busy) return;
  $('route-prompt').value = prompt;
  for (const c of document.querySelectorAll('#router [data-prompt]')) c.classList.toggle('active', c.dataset.prompt === prompt);
  if (cache.has(prompt)) { current = { prompt, data: { ...cache.get(prompt), cached: true } }; renderAll(); return; }
  if (!human()) { showError('Complete the human check above first.'); renderWidget(); return; }
  setBusy(true); showError('');
  $('route-output').replaceChildren(h('p', 'route-empty', `Asking Jev about “${prompt}”…`));
  renderAnti(true);
  try {
    const response = await fetch('/api/jev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demo: 'route', prompt, verification_token: token || undefined }), signal: AbortSignal.timeout(45000) });
    let data; try { data = await response.json(); } catch { throw new Error('The server returned an unreadable response. Please try again.'); }
    if (data.human_until) window.jevHuman.set(data.human_until);
    if (!response.ok) { if (data.needs_human) window.jevHuman.clear(); throw new Error(data.error || 'Routing failed. Please try again.'); }
    cache.set(prompt, data); current = { prompt, data }; renderAll();
    $('route-human-check').hidden = window.jevHuman.ok();
  } catch (error) {
    renderOutput(); renderAnti(); showError(error.name === 'TimeoutError' ? 'The request timed out. Please try again.' : error.message);
  } finally {
    setBusy(false); token = '';
    if (widgetId !== undefined && !window.jevHuman.ok()) window.turnstile.reset(widgetId);
  }
}

$('route-chips').replaceChildren(...PROMPTS.map(p => { const b = h('button', 'chip', p); b.type = 'button'; b.dataset.prompt = p; b.addEventListener('click', () => route(p)); return b; }));
$('route-form').addEventListener('submit', e => { e.preventDefault(); route($('route-prompt').value); });
$('route-human-check').hidden = !!window.jevHuman?.ok();
renderWidget();
renderAll();
