// Model Router. Jev makes five judgments about a prompt (see routerQuestions in
// functions/api/jev.js). Everything below is plain code: reading the answers,
// and two truth tables that pick a Claude model and a reasoning level. Edit the tables, not the questions,
// to change routing policy.
const $ = id => document.getElementById(id);

import { YES, NO, UNSURE_COUNTS_AS, DEPTH, LEVELS, MODELS, REASONING_TABLE, MODEL_RULES, NOULS, read, judge, decide } from './router-policy.js?v=router-13';
import { ROUTER_V2_TABLE, V2_JUDGMENTS, judgeV2, decideV2 } from './router-v2-policy.js?v=router-21';

const PROMPTS = [
  'hi! how’s it going?',
  'What’s the capital of Australia?',
  'Write a haiku about Monday mornings',
  'Why does my React useEffect run twice in development?',
  'Is it safe to take ibuprofen with my blood pressure medication?',
  'Write a 3,000-word short story about a lighthouse keeper',
  'Design the database schema and API for a multi-tenant SaaS billing system',
  'Can you rebuild this OS in Rust?'
];
// ---- Page -------------------------------------------------------------------
const h = (tag, cls, ...kids) => { const el = document.createElement(tag); if (cls) el.className = cls; for (const k of kids) if (k != null) el.append(k); return el; };
const pct = n => n.toFixed(2);
const cache = new Map();
let current = null, widgetId, token = '', busy = false, rendered = false, needed = false;
let lastError = '';
const showError = m => { lastError = m; for (const id of ['route-error', 'anti-error', 'v2-error']) { const e = $(id); if (e) { e.textContent = m; e.hidden = !m; } } };
const setBusy = b => { busy = b; for (const el of document.querySelectorAll('[data-prompt], #route-run, #route-prompt')) el.disabled = b; };

function renderOutput() {
  const out = $('route-output');
  if (!current) { out.replaceChildren(h('p', 'route-empty', 'Pick a prompt to see where it goes.')); return; }
  const { data } = current, d = decide(judge(data.answers));
  out.replaceChildren(
    h('div', 'route-pick',
      h('div', null, h('span', 'route-k', 'Model'), h('strong', null, MODELS[d.tier])),
      h('div', null, h('span', 'route-k', 'Reasoning'), h('strong', null, LEVELS[d.reasoning]))),
    h('p', 'route-meta', `${data.model} · ${Math.round(data.elapsed_ms)}ms`));
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
const ANTI = ['Haiku', 'Sonnet', 'Opus', 'Fable'];
function renderAnti(pending) {
  const c = current?.data.answers.model_choice;
  if (pending || !c) {
    $('anti-output').replaceChildren(h('p', 'route-empty', pending ? 'Asking Jev to pick a model…' : 'Pick a prompt above to see what one Choice would pick.'));
    $('anti-trace').replaceChildren(h('p', 'route-empty', 'One question. Jev answers it with a decision.'));
  } else {
    $('anti-output').replaceChildren(
      h('div', 'route-pick',
        h('div', null, h('span', 'route-k', 'Model'), h('strong', null, `Claude ${c.choice}`)),
        h('div', null, h('span', 'route-k', 'Reasoning'), h('strong', 'muted', '—'))),
      h('p', 'route-meta', `${current.data.model} · ${Math.round(current.data.elapsed_ms)}ms`));
    $('anti-trace').replaceChildren(traceRow('choice', 'Which model should I use for this prompt?',
      ANTI.map(k => h('span', k === c.choice ? 'opt on' : 'opt', `${k} ${pct(c.probabilities[k])}`)), c.choice, 'is-anti'));
  }
  const rows = ANTI.map(k => h('tr', c && k === c.choice ? 'hit' : '', h('td', null, k), h('td', null, c ? pct(c.probabilities[k]) : '–'), h('td', null, `Claude ${k}`)));
  $('anti-table').replaceChildren(
    h('h4', null, 'argmax', h('span', null, ' highest probability wins')),
    table(['Option', 'Probability', 'Use'], rows),
    h('p', 'note', 'That’s the whole table. There are no inputs to inspect, no rows to edit, and no way to explain why one model won.'));
}
// ---- Agree / disagree across every prompt that has been run -----------------
// Runs the prompts not yet asked, one call at a time. It always finishes: a
// failure stops the run and shows why here, and the button never sticks.
async function runAll() {
  const todo = PROMPTS.filter(p => !cache.has(p));
  runningAll = { done: 0, total: todo.length }; showError(''); renderCompare();
  try {
    for (const p of todo) {
      if (!(await route(p))) { if (!lastError) showError('A prompt could not be run. Please try again.'); break; }
      runningAll.done++; renderCompare();
      await new Promise(r => setTimeout(r, 250));
    }
  } catch (error) {
    console.error(error); showError(error?.message || 'Something went wrong. Please try again.');
  } finally { runningAll = null; renderCompare(); }
}
let runningAll = null; // { done, total } while "Run all" is going
function renderCompare() {
  const rows = PROMPTS.map(prompt => {
    const data = cache.get(prompt);
    const go = h('button', 'link-cell', prompt); go.type = 'button'; go.dataset.prompt = prompt; go.disabled = busy; go.addEventListener('click', () => route(prompt));
    if (!data) return h('tr', 'pending', h('td', null, go), h('td', null, '–'), h('td', null, '–'), h('td', null, h('span', 'agree-tag', 'not run')));
    const d = decide(judge(data.answers)), c = data.answers.model_choice;
    const router = MODELS[d.tier], choice = `Claude ${c.choice}`, same = router === choice;
    return h('tr', (same ? 'agree' : 'disagree') + (current?.prompt === prompt ? ' now' : ''), h('td', null, go),
      h('td', null, router, h('span', 'cmp-sub', ` · ${LEVELS[d.reasoning].toLowerCase()}`)),
      h('td', null, choice, h('span', 'cmp-sub', ` ${pct(c.probabilities[c.choice])}`)),
      h('td', null, h('span', 'agree-tag', same ? 'agree' : 'disagree')));
  });
  const run = PROMPTS.filter(p => cache.has(p)), agree = run.filter(p => { const a = cache.get(p).answers; return MODELS[decide(judge(a)).tier] === `Claude ${a.model_choice.choice}`; }).length;
  const all = h('button', 'text-button', runningAll ? `Running ${runningAll.done + 1} of ${runningAll.total}…` : run.length === PROMPTS.length ? 'All run' : `Run the other ${PROMPTS.length - run.length}`);
  all.type = 'button'; all.disabled = busy || runningAll || run.length === PROMPTS.length;
  all.addEventListener('click', runAll);
  $('anti-compare').replaceChildren(...[
    h('div', 'section-heading', h('h3', null, 'Router vs. Choice'), all),
    lastError && !busy ? h('p', 'error', `Stopped: ${lastError}`) : null,
    h('p', 'cmp-summary', run.length ? `They agree on ${agree} of ${run.length} prompts run.` : 'Run prompts to compare the two approaches.'),
    h('div', 'cmp-scroll', table(['Prompt', 'Router (truth table)', 'Choice (argmax)', ''], rows)),
    h('p', 'note', 'Each prompt is one Jev call; answers are saved for this visit.')].filter(Boolean));
}
// ---- Model Router v2: rebuilt from the eval (bottom card) ----------------------
// Same Jev call as everything above; it also asks Router v2's four judgments.
// The table is router-v2-policy.js, the exact one the eval tested.
const EFFORT_LABEL = { low: 'Low', high: 'High' };
function initV2() {
  const sec = $('router-v2'); if (!sec) return;
  sec.replaceChildren(
    h('div', 'demo-heading', h('span', 'v2-tag', 'Built from the eval'), h('h2', null, h('span', null, 'Model Router v2'))),
    h('p', 'eval-intro', 'The eval showed where models actually fail: exact, letter-level work and long step-by-step procedures, not “expertise” or “stakes”. So Router v2 asks Jev four new questions aimed at those, and uses a new truth table set from the 60 training prompts. On the eval’s 168 held-out prompts it passed 91.1% against the original router’s 80.4%, at about the same cost. A learned version on the same judgments (Router v3) did a little better, 93.5%, but v2 keeps a table you can read.'),
    h('div', 'chips', ...PROMPTS.map(p => { const b = h('button', 'chip', p); b.type = 'button'; b.dataset.prompt = p; b.addEventListener('click', () => route(p)); return b; })),
    (() => { const e = h('p', 'error'); e.id = 'v2-error'; e.setAttribute('role', 'alert'); e.hidden = true; return e; })(),
    (() => { const o = h('div', 'route-output'); o.id = 'v2-output'; o.setAttribute('aria-live', 'polite'); return o; })(),
    h('div', 'route-grid',
      h('section', null, h('div', 'section-heading', h('h3', null, 'Judgment Trace'), h('span', 'status', 'Jev')), (() => { const d = h('div'); d.id = 'v2-trace'; return d; })()),
      h('section', 'route-tables', h('div', 'section-heading', h('h3', null, 'Truth Table v2'), h('span', 'status', 'Code')), (() => { const d = h('div'); d.id = 'v2-table'; return d; })())));
  sec.hidden = false;
}
function renderV2() {
  if (!$('v2-output')) return;
  const a = current?.data.answers, hasV2 = a && 'exact_details' in a;
  const j = hasV2 ? judgeV2(a, a) : null, d = j ? decideV2(j) : null;
  if (!current) $('v2-output').replaceChildren(h('p', 'route-empty', 'Pick a prompt to see where Router v2 sends it.'));
  else if (!hasV2) $('v2-output').replaceChildren(h('p', 'route-empty', 'This answer came from before Router v2 existed. Reload the page and pick the prompt again.'));
  else {
    const [tier, effort] = d.arm.split(':');
    $('v2-output').replaceChildren(
      h('div', 'route-pick',
        h('div', null, h('span', 'route-k', 'Model'), h('strong', null, MODELS[tier])),
        h('div', null, h('span', 'route-k', 'Effort'), h('strong', null, EFFORT_LABEL[effort]))),
      h('p', 'route-meta', `Row ${d.row + 1}: ${ROUTER_V2_TABLE[d.row].when.toLowerCase()} · ${current.data.model}`));
  }
  const p = k => typeof a?.[k] === 'object' ? a[k].noul : a?.[k];
  $('v2-trace').replaceChildren(...(hasV2
    ? [...Object.entries(V2_JUDGMENTS).map(([k, label]) => traceRow('noul', label, [h('span', p(k) >= .5 ? 'opt on' : 'opt', `true ${pct(p(k))}`), h('span', p(k) < .5 ? 'opt on' : 'opt', `false ${pct(1 - p(k))}`)], j[k] ? 'yes' : 'no', j[k] ? 'is-yes' : 'is-no')),
       traceRow('score', 'Reasoning depth (from the original questions)', [h('span', 'opt on', DEPTH[j.depth])], DEPTH[j.depth], 'is-level')]
    : [h('p', 'route-empty', 'Jev’s answers to Router v2’s questions, with the probabilities code reads.')]));
  $('v2-table').replaceChildren(
    table(['#', 'If', 'Model', 'Effort'], ROUTER_V2_TABLE.map((r, i) => {
      const state = !d ? '' : i === d.row ? 'hit' : i < d.row ? 'miss' : 'skip', [tier, effort] = r.arm.split(':');
      return h('tr', state, h('td', null, String(i + 1)), h('td', null, r.when), h('td', null, MODELS[tier]), h('td', null, EFFORT_LABEL[effort]));
    })),
    h('p', 'note', 'First match wins. Yes means Jev’s probability is at least 0.5. No row needs Claude Fable: on the eval’s prompts the top tier never earned its cost.'));
}
const renderAll = () => { renderOutput(); renderTrace(); renderTables(); renderApi(); renderAnti(); renderCompare(); renderV2(); };

function renderWidget() {
  if (!needed || rendered || !window.turnstile || window.jevHuman?.ok()) return;
  rendered = true; $('route-human-check').hidden = false;
  widgetId = window.turnstile.render('#route-human-check', {
    sitekey: '0x4AAAAAAFoxX_DwyD2--6xP', action: 'jev_check', theme: 'light',
    callback: t => { token = t; showError(''); },
    'expired-callback': () => { token = ''; },
    'error-callback': () => { token = ''; showError('Human verification unavailable. Reload to try again.'); }
  });
}
// Logged-in /jev viewers never see Turnstile: it renders only after /api/jev answers needs_human.
window.jevRenderRouter = renderWidget;
window.addEventListener('jev-human-needed', () => { needed = true; rendered = false; renderWidget(); });

async function route(prompt) {
  prompt = prompt.trim();
  if (!prompt || busy) return false;
  $('route-prompt').value = prompt;
  for (const c of document.querySelectorAll('[data-prompt]')) c.classList.toggle('active', c.dataset.prompt === prompt);
  if (cache.has(prompt)) { current = { prompt, data: { ...cache.get(prompt), cached: true } }; renderAll(); return true; }
  setBusy(true); showError('');
  $('route-output').replaceChildren(h('p', 'route-empty', `Asking Jev about “${prompt}”…`));
  renderAnti(true);
  if ($('v2-output')) $('v2-output').replaceChildren(h('p', 'route-empty', `Asking Jev about “${prompt}”…`));
  try {
    const response = await fetch('/api/jev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demo: 'route', prompt, verification_token: token || undefined }), signal: AbortSignal.timeout(45000) });
    let data; try { data = await response.json(); } catch { throw new Error('The server returned an unreadable response. Please try again.'); }
    if (data.human_until) window.jevHuman.set(data.human_until);
    if (!response.ok) { if (data.needs_human) window.jevHuman.clear(); throw new Error(data.error || 'Routing failed. Please try again.'); }
    cache.set(prompt, data); current = { prompt, data }; renderAll();
    $('route-human-check').hidden = window.jevHuman.ok();
    return true;
  } catch (error) {
    renderOutput(); renderAnti(); renderCompare(); showError(error.name === 'TimeoutError' ? 'The request timed out. Please try again.' : error.message);
  } finally {
    setBusy(false); token = ''; renderCompare();
    if (widgetId !== undefined && !window.jevHuman.ok()) window.turnstile.reset(widgetId);
  }
  return false;
}

// The same prompts appear in both cards; either set runs the one shared call.
const chips = () => PROMPTS.map(p => { const b = h('button', 'chip', p); b.type = 'button'; b.dataset.prompt = p; b.addEventListener('click', () => route(p)); return b; });
$('route-chips').replaceChildren(...chips());
$('anti-chips').replaceChildren(...chips());
initV2();
$('route-form').addEventListener('submit', e => { e.preventDefault(); route($('route-prompt').value); });
$('route-human-check').hidden = true;
renderWidget();
renderAll();
