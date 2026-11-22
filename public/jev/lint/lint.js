// jev-lint. Two layers, as in jev-lint (takehome/demos/a1-wrong-question):
// code checks what code can check, in the browser; Jev answers four judgments about the
// question's wording, through /api/jev (functions/_lib/jev-lint.js). Flags at FLAG_AT.
import { GALLERY } from './gallery.js?v=lint-1'; // recorded examples

const FLAG_AT = 0.7, UNSURE_AT = 0.3;
const RECORDED = 'Recorded Jev answer · jev-1.14.0';
const JUDGMENTS = {
  decision: { name: 'Decision', ask: 'Asks what someone should do, rather than what is true?', fix: 'Asks Jev to decide. Split the decision into the judgments it depends on, and write the decision in code.' },
  compound: { name: 'Compound', ask: 'Two or more separate conditions at once?', fix: 'Two conditions in one question. Ask each as its own Noul, and combine them in code.' },
  hidden_rules: { name: 'Hidden rules', ask: 'Depends on business rules that aren’t written in it?', fix: 'Depends on your policy, which Jev can’t see. Ask about observable facts, and keep the policy in code.' },
  needs_math: { name: 'Needs math', ask: 'Needs arithmetic, counting, or comparing dates or numbers?', fix: 'Needs arithmetic or a date comparison. Read the values with Jev or code, and compare them in code.' },
};
const CRITERIA_HELP = {
  noul: 'Criteria (optional): one per line, <code>true: …</code> and <code>false: …</code>',
  choice: 'Options: one per line, <code>name: description</code>',
  score: 'Levels: one per line, lowest first',
};
const PLACEHOLDERS = {
  noul: ['Should `ticket` be escalated?', 'true: Records are missing because of something our product did.\nfalse: A forgotten password, or a project the customer deleted.'],
  choice: ['What is `ticket` mainly about?', 'billing: A charge, refund or invoice.\nbug: Something in the product is broken.\nhow-to: The customer is asking how to do something.'],
  score: ['How frustrated does the customer sound in `ticket`?', 'calm\nannoyed\nangry\nfurious'],
};

const $ = id => document.getElementById(id);
const h = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids.filter(k => k != null)); return e; };
let type = 'noul', token = '', widgetId, rendered = false, busy = false, needed = false;

// --- Code checks: the same rules as staticChecks() in lint-rules.mjs, for one question.
function codeChecks(q) {
  const out = [], text = q.instructions || '';
  if (q.type === 'choice') {
    const names = Object.keys(q.criteria || {});
    if (names.length < 2) out.push('A Choice needs at least two options.');
    if (names.some(n => /^(option_?\d+|[a-d]|left|right|first|second)$/i.test(n))) out.push('Option names are sent to the model. Positional names like A/B or option_1 give it nothing to go on.');
    if (names.some(n => /^(other|none|none_of_the_above|n\/a)$/i.test(n))) out.push('A “none of these” option usually works worse than a companion Noul that asks whether anything fits.');
    else out.push('A Choice always picks something. Add a companion Noul (“Does it mention any of these?”) so code can tell when nothing fits.');
  }
  if (q.type === 'noul' && typeof q.criteria?.false === 'string' && /^(not|isn't|is not|no)\b/i.test(q.criteria.false.trim())) out.push('Describe the false case as a concrete situation, not as “not X”.');
  if (/^(you are|as an?|consider|think step|please)\b/i.test(text.trim())) out.push('Preambles and instructions-to-an-LLM are noise. A question is not a prompt.');
  if (text.length > 400) out.push(`Instructions are ${text.length} characters. A long rulebook inside a question usually means the policy belongs in code.`);
  return out;
}

// --- Reading the editor.
function parseCriteria(raw) {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  if (!lines.length) return undefined;
  if (type === 'score') return lines.slice(0, 16);
  const pairs = lines.map(l => { const i = l.indexOf(':'); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim() || null] : [l, null]; });
  return Object.fromEntries(pairs.slice(0, 16));
}
const current = () => ({ type, instructions: $('lint-instructions').value.trim(), criteria: parseCriteria($('lint-criteria').value) });

function setType(t) {
  type = t;
  for (const b of document.querySelectorAll('[data-type]')) { const on = b.dataset.type === t; b.classList.toggle('active', on); b.setAttribute('aria-checked', String(on)); }
  $('lint-criteria-label').innerHTML = CRITERIA_HELP[t];
  [$('lint-instructions').placeholder, $('lint-criteria').placeholder] = PLACEHOLDERS[t];
}
function load(q) {
  setType(q.type);
  $('lint-instructions').value = q.instructions;
  const c = q.criteria;
  $('lint-criteria').value = !c ? '' : Array.isArray(c) ? c.join('\n') : Object.entries(c).map(([k, v]) => v == null ? k : `${k}: ${v}`).join('\n');
  updateCount();
}
const updateCount = () => { $('lint-count').textContent = `${$('lint-instructions').value.length} / 1000`; };

// --- Rendering a review.
const band = p => p >= FLAG_AT ? 'flag' : p > UNSURE_AT ? 'unsure' : 'ok';
function judgmentRows(j) {
  return Object.entries(JUDGMENTS).map(([id, d]) => {
    const p = j[id], b = band(p);
    const bar = h('div', 'lint-bar'); const fill = h('div', 'lint-fill'); fill.style.width = `${Math.round(p * 100)}%`; bar.append(fill);
    return h('div', `lint-row is-${b}`,
      h('div', 'lint-row-head', h('span', 'lint-name', d.name), h('span', 'lint-p', p.toFixed(2)), h('span', 'lint-tag', b === 'flag' ? 'flagged' : b === 'unsure' ? 'unsure' : 'clear')),
      bar,
      h('p', 'lint-ask', b === 'flag' ? d.fix : d.ask));
  });
}
function verdict(j, code) {
  const flags = j ? Object.keys(JUDGMENTS).filter(k => j[k] >= FLAG_AT) : [];
  if (!j) return code.length ? h('p', 'lint-verdict warn', `${code.length} code check${code.length > 1 ? 's' : ''} to look at. Ask Jev for the wording review.`) : h('p', 'lint-verdict', 'Code checks pass. Ask Jev for the wording review.');
  if (!flags.length && !code.length) return h('p', 'lint-verdict good', '✓ Ship it. One observable thing, answerable at a glance.');
  return h('p', 'lint-verdict warn', `✗ Rewrite: ${[...flags.map(k => JUDGMENTS[k].name.toLowerCase()), ...(code.length ? ['code checks'] : [])].join(', ')}.`);
}
function renderResult({ q, j, rewrite, source }) {
  const code = codeChecks(q), out = $('lint-result');
  if (!q.instructions) { out.replaceChildren(h('p', 'note', 'Type a question, or open one of the examples above.')); $('lint-source').textContent = ''; return; }
  const kids = [verdict(j, code)];
  if (j) kids.push(h('div', 'lint-rows', ...judgmentRows(j)));
  if (code.length) kids.push(h('div', 'lint-code', h('h4', null, 'Code checks'), h('ul', null, ...code.map(c => h('li', null, c)))));
  if (rewrite) kids.push(rewriteBlock(rewrite));
  else if (j && Object.keys(JUDGMENTS).some(k => j[k] >= FLAG_AT) && source?.startsWith('Live')) kids.push(h('p', 'note lint-norewrite', 'No proposed rewrite this time: the drafting model didn’t return a usable one. The flagged rows above say what to change.'));
  out.replaceChildren(...kids);
  $('lint-source').textContent = source || '';
}

// --- Live review through /api/jev.
function showError(msg) { $('route-error').textContent = msg; $('route-error').hidden = !msg; }
function renderWidget() {
  if (!needed || rendered || !window.turnstile || window.jevHuman?.ok()) return;
  rendered = true; $('route-human-check').hidden = false;
  widgetId = window.turnstile.render('#route-human-check', {
    sitekey: '0x4AAAAAAFoxX_DwyD2--6xP', action: 'jev_check', theme: 'light',
    callback: t => { token = t; showError(''); },
    'expired-callback': () => { token = ''; },
    'error-callback': () => { token = ''; showError('Human verification unavailable. Reload to try again.'); },
  });
}
// Logged-in /jev viewers never see Turnstile: it renders only after /api/jev answers needs_human.
window.jevRenderRouter = renderWidget; // human.js calls this once Turnstile loads
window.addEventListener('jev-human-needed', () => { needed = true; rendered = false; renderWidget(); });

async function askJev(e) {
  e?.preventDefault();
  const q = current();
  if (!q.instructions || busy) return;
  busy = true; $('lint-run').disabled = true; showError('');
  $('lint-source').textContent = 'Asking Jev…';
  try {
    const r = await fetch('/api/jev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demo: 'lint', question: q, verification_token: token || undefined }), signal: AbortSignal.timeout(45000) });
    let data; try { data = await r.json(); } catch { throw new Error('The server returned an unreadable response. Please try again.'); }
    if (data.human_until) window.jevHuman.set(data.human_until);
    if (!r.ok) { if (data.needs_human) window.jevHuman.clear(); throw new Error(data.error || 'The review failed. Please try again.'); }
    renderResult({ q, j: data.judgments, rewrite: data.rewrite, source: `Live · ${data.model} · ${data.elapsed_ms} ms` });
    $('route-human-check').hidden = window.jevHuman.ok();
  } catch (err) {
    $('lint-source').textContent = '';
    showError(err.name === 'TimeoutError' ? 'The request timed out. Please try again.' : err.message);
  } finally {
    busy = false; $('lint-run').disabled = false; token = '';
    if (widgetId !== undefined && !window.jevHuman.ok()) window.turnstile.reset(widgetId);
  }
}

// --- The proposed rewrite, under a "Rewrite" verdict. Live: drafted by Workers AI and
// linted by Jev on the server. Examples: the rewrite recorded with them.
function pills(j) {
  return h('div', 'lint-pills', ...Object.entries(JUDGMENTS).map(([id, d]) => {
    const b = band(j[id]);
    const p = h('span', `lint-pill is-${b}`, `${d.name} ${j[id].toFixed(2)}`);
    p.title = d.ask; return p;
  }));
}
function questionText(q) {
  const c = q.criteria;
  const extra = !c ? '' : Array.isArray(c) ? ` · ${c.length} levels` : q.type === 'choice' ? ` · options: ${Object.keys(c).join(', ')}` : ' · with criteria';
  return h('span', 'lint-q', h('code', null, q.instructions), h('span', 'lint-qmeta', `${q.type}${extra}`));
}
function rewriteBlock(rw) {
  const items = rw.questions.map(({ name, q, judgments: rj }) => {
    const flags = rj ? Object.keys(JUDGMENTS).filter(k => rj[k] >= FLAG_AT) : [];
    const state = !rj ? 'unchecked' : flags.length ? 'bad' : 'good';
    const label = state === 'good' ? '✓ Jev: clear' : state === 'bad' ? `✗ Jev still flags: ${flags.map(k => JUDGMENTS[k].name.toLowerCase()).join(', ')}` : 'Not linted';
    const use = h('button', 'chip', 'Use this'); use.type = 'button';
    use.addEventListener('click', () => { load(q); renderResult({ q, j: rj, source: rj ? 'Jev’s review of the proposed rewrite' : '' }); $('editor').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    return h('li', `lint-step is-${state}`,
      h('div', 'lint-step-head', h('span', 'lint-step-label', name ? `j.${name}` : 'Question'), use),
      questionText(q), rj ? pills(rj) : null, h('p', 'lint-step-state', label));
  });
  return h('div', 'lint-rewrite',
    h('h4', null, 'Proposed rewrite'),
    items.length ? h('ol', 'lint-steps', ...items) : h('p', 'note', 'No Jev question needed. Code can answer this on its own.'),
    rw.code ? h('div', 'lint-then', h('span', 'lint-then-label', 'Then, in code'), h('pre', null, h('code', null, rw.code))) : null,
    rw.aside ? h('p', 'note', rw.aside) : null,
    h('p', 'note lint-rewrite-source', rw.recorded ? 'Written by hand; Jev’s answers recorded (jev-1.14.0).' : 'Drafted by Llama 3.3 70B on Workers AI, then linted by Jev. A starting point: check the names and the policy in the code before you ship it.'));
}

// --- Examples: real first drafts, with Jev's recorded review and a hand-written rewrite.
const EXAMPLE_LABELS = { escalate: 'Escalate a ticket', model: 'Pick a model', rude: 'Rude or drunk', pr: 'Approve a PR', lead: 'Lead priority', refund: 'Refund over $500', invoice: 'Invoice over 30 days', agent: 'Agent prompt', spam: 'option_1 / option_2', review: 'Shipping or price', clean: 'A clean one' };
const flagged = s => Object.keys(JUDGMENTS).some(k => s.j[k] >= FLAG_AT) || s.code.length;
function recordedRewrite(g) {
  const [first, ...rest] = g.steps;
  if (!flagged(first)) return null;
  const good = rest.filter(s => !flagged(s));
  return { recorded: true, questions: good.map(s => ({ q: s.q, judgments: s.j })), code: g.code, aside: g.aside };
}
function openExample(g) {
  const s = g.steps[0];
  load(s.q); renderResult({ q: s.q, j: s.j, rewrite: recordedRewrite(g), source: RECORDED });
  for (const b of document.querySelectorAll('#lint-examples .chip')) b.classList.toggle('active', b.dataset.id === g.id);
}
function renderExamples() {
  $('lint-examples').replaceChildren(...GALLERY.map(g => {
    const b = h('button', 'chip', EXAMPLE_LABELS[g.id] || g.id); b.type = 'button'; b.dataset.id = g.id; b.title = g.lesson;
    b.addEventListener('click', () => openExample(g)); return b;
  }));
}

// --- Wiring.
for (const b of document.querySelectorAll('[data-type]')) b.addEventListener('click', () => { setType(b.dataset.type); renderResult({ q: current() }); });
for (const id of ['lint-instructions', 'lint-criteria']) $(id).addEventListener('input', () => { updateCount(); renderResult({ q: current() }); for (const b of document.querySelectorAll('#lint-examples .chip')) b.classList.remove('active'); });
$('lint-form').addEventListener('submit', askJev);
$('route-human-check').hidden = true;
renderExamples();
openExample(GALLERY[0]);
renderWidget();
