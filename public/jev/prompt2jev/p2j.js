// prompt2jev: paste an LLM prompt, get a Jev integration back.
// 1. p2j_fit: Jev judges the prompt (should it become Jev?); the verdict is code on the server.
// 2. p2j_draft: an LLM (OpenRouter, or Workers AI as the fallback) drafts questions, a truth table, decide() and an example; Jev lints.
// 3. p2j_try: Jev answers the drafted questions about an input; decide() runs in a sandbox here.
// Server: functions/api/jev.js and functions/_lib/prompt2jev.js.

const $ = id => document.getElementById(id);
const h = (tag, cls, ...kids) => { const e = document.createElement(tag); if (cls) e.className = cls; e.append(...kids.filter(k => k != null && k !== false)); return e; };
const FLAG_AT = 0.7, NO_AT = 0.3, MAX = 6000;
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

const EXAMPLES = [
  { label: 'Support triage', prompt: `You are a support triage assistant for a B2B SaaS company. Read the customer ticket and decide its priority: P1, P2 or P3.
P1 if the customer reports an outage, data loss or a security problem, or if they are an enterprise customer threatening to churn.
P2 if something is broken but there is a workaround, or the customer has been waiting more than 48 hours.
P3 for questions, feature requests and everything else.
Ticket fields: message, plan, hours_waiting.
Respond in JSON: {"priority": "P1"|"P2"|"P3", "reason": "..."}` },
  { label: 'Marketplace moderation', prompt: `You moderate listings on a secondhand marketplace. Given a listing (title, description, price, seller_account_age_days), decide: APPROVE, REVIEW or REJECT.
Reject weapons, drugs, counterfeit goods, and listings that ask buyers to pay outside the platform.
Send to human review if the price is suspiciously low for the item, or if the seller account is less than 7 days old and the item is expensive (over $500).
Otherwise approve. Be strict but fair. Output only the decision word.` },
  { label: 'Agent tool choice', prompt: `You are the planning step of a research agent. Given the user's request and the conversation so far, choose the next action: SEARCH_WEB, READ_URL, ASK_USER, or ANSWER.
Search the web when the request needs recent or factual information we don't have yet. Read a URL when the user or a previous search result gave a URL that is likely to contain the answer. Ask the user when the request is ambiguous. Answer when we already have enough information.
Return JSON: {"action": "...", "argument": "..."}` },
  { label: 'Reply to a review', prompt: `You are the voice of our coffee shop. Write a warm, short reply (2–3 sentences) to the customer review below. Thank them by name, mention one specific thing they liked, and if they had a complaint, apologize and invite them back. Never offer refunds in a public reply.` },
  { label: 'Invoice fields', prompt: `Extract the following fields from the invoice text and return them as JSON: vendor_name, invoice_number, invoice_date (YYYY-MM-DD), due_date (YYYY-MM-DD), currency, total_amount, and line_items (description, quantity, unit_price). Use null for anything missing.` },
];

// --- Human check (Turnstile), as on the other /jev demos.
let token = '', widgetId, rendered = false, needed = false, busy = false;
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
window.jevRenderRouter = renderWidget;
window.addEventListener('jev-human-needed', () => { needed = true; rendered = false; renderWidget(); });

// One call to /api/jev. The first call carries the Turnstile token; it earns a cookie for the rest.
async function api(body, ms) {
  const r = await fetch('/api/jev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, verification_token: token || undefined }), signal: AbortSignal.timeout(ms) });
  token = '';
  let data; try { data = await r.json(); } catch { throw new Error('The server returned an unreadable response. Please try again.'); }
  if (data.human_until) { window.jevHuman.set(data.human_until); $('route-human-check').hidden = true; }
  if (!r.ok) { if (data.needs_human) window.jevHuman.clear(); throw new Error(data.error || 'The request failed. Please try again.'); }
  return data;
}
const errText = err => err.name === 'TimeoutError' ? 'The request timed out. Please try again.' : err.message;

// --- Shared bits.
const band = p => p >= FLAG_AT ? 'yes' : p <= NO_AT ? 'no' : 'unsure';
function row(name, p, text, flagWhenHigh = true) {
  const b = band(p), cls = flagWhenHigh ? (b === 'yes' ? 'flag' : b === 'unsure' ? 'unsure' : 'ok') : b;
  const bar = h('div', 'lint-bar'); const fill = h('div', 'lint-fill'); fill.style.width = `${Math.round(p * 100)}%`; bar.append(fill);
  return h('div', `lint-row is-${cls}`, h('div', 'lint-row-head', h('span', 'lint-name', name), h('span', 'lint-p', p.toFixed(2)), h('span', 'lint-tag', b)), bar, text ? h('p', 'lint-ask', inline(text)) : null);
}
// `code` spans in otherwise plain text.
function inline(text) {
  const out = h('span', null);
  String(text).split(/(`[^`]+`)/).forEach(part => out.append(part.startsWith('`') && part.endsWith('`') && part.length > 1 ? h('code', null, part.slice(1, -1)) : part.replace(/\*\*/g, '')));
  return out;
}
function copyButton(getText, label = 'Copy') {
  const b = h('button', 'chip', label); b.type = 'button';
  b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(getText()); b.textContent = 'Copied'; } catch { b.textContent = 'Copy failed'; } setTimeout(() => { b.textContent = label; }, 1500); });
  return b;
}
function block(title, text, copy = true) {
  return h('div', 'p2j-block', h('div', 'p2j-block-head', h('h4', null, title), copy ? copyButton(() => text) : null), h('pre', null, h('code', null, text)));
}
// A small Markdown renderer for the truth table: tables, bullets, headings, paragraphs.
function markdown(md) {
  const root = h('div', 'p2j-table'), lines = md.split('\n');
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (line.startsWith('|')) {
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(lines[i].trim()); i++; }
      const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const body = rows.filter(r => !/^\|?[\s:|-]+\|?$/.test(r));
      const table = h('table', null);
      body.forEach((r, n) => table.append(h('tr', null, ...cells(r).map(c => h(n === 0 ? 'th' : 'td', null, inline(c))))));
      root.append(table); continue;
    }
    if (/^[-*] /.test(line)) {
      const ul = h('ul', null);
      while (i < lines.length && /^\s*[-*] /.test(lines[i])) { ul.append(h('li', null, inline(lines[i].trim().slice(2)))); i++; }
      root.append(ul); continue;
    }
    if (/^#+ /.test(line)) { root.append(h('h5', null, inline(line.replace(/^#+ /, '')))); i++; continue; }
    root.append(h('p', null, inline(line))); i++;
  }
  return root;
}

// --- 1. Fit.
const FIT = {
  picks_outcome: 'Picks from a fixed set of outcomes (a label, a level, an action)?',
  writes_text: 'Mainly writes free-form text (a reply, a summary, code)?',
  extracts_values: 'Mainly copies values out of the input (names, amounts, dates)?',
};
const VERDICTS = {
  migrate: ['✓ Yes, migrate it.', 'It picks one of a few outcomes, so it’s a set of judgments plus a policy. Jev answers the judgments and your code holds the policy.'],
  split: ['◐ Partly.', 'Jev can make the decision, but it can’t write text. Keep an LLM or a template for the writing, and move the decision to Jev and code.'],
  keep: ['✗ Keep the LLM for this one.', 'Jev answers questions with probabilities. It doesn’t write replies or copy values out of a document, and that’s what this prompt mostly does.'],
  unsure: ['? Jev isn’t sure.', 'Drafting anyway. Check whether the questions below really capture what the prompt does.'],
};
function renderFit(data) {
  const [title, why] = VERDICTS[data.verdict];
  const kids = [h('p', `p2j-verdict${data.verdict === 'keep' ? ' warn' : ''}`, title), h('p', 'p2j-why', why),
    h('div', 'lint-rows', ...Object.entries(FIT).map(([id, text]) => row(id, data.fit[id], text, false))),
    h('p', 'note', `Live · ${data.model} · ${data.elapsed_ms} ms`)];
  if (data.verdict === 'keep') {
    const b = h('button', 'chip p2j-anyway', 'Draft a Jev version anyway'); b.type = 'button';
    b.addEventListener('click', () => { b.remove(); runDraft(lastPrompt); });
    kids.push(b);
  }
  $('fit-body').replaceChildren(...kids); $('fit').hidden = false;
}

// --- 2. Draft.
const LINT = { decision: 'decision', compound: 'compound', hidden_rules: 'hidden rules', needs_math: 'needs math' };
const flagsOf = j => j ? Object.keys(LINT).filter(k => j[k] >= FLAG_AT) : [];
function questionCard(id, q, j) {
  const flags = flagsOf(j), state = !j ? 'unchecked' : flags.length ? 'bad' : 'good';
  const crit = q.criteria ? (Array.isArray(q.criteria) ? q.criteria.map((c, n) => [n, c]) : Object.entries(q.criteria)) : [];
  return h('li', `p2j-q is-${state}`,
    h('div', 'p2j-q-head', h('span', 'p2j-q-id', id), h('span', 'p2j-q-type', q.type)),
    h('p', 'p2j-q-text', inline(q.instructions)),
    crit.length ? h('ul', 'p2j-q-crit', ...crit.map(([k, v]) => h('li', null, h('code', null, String(k)), v ? ` ${v}` : ''))) : null,
    j ? h('div', 'lint-pills', ...Object.entries(LINT).map(([k, name]) => { const p = h('span', `lint-pill is-${j[k] >= FLAG_AT ? 'flag' : j[k] > NO_AT ? 'unsure' : 'ok'}`, `${name} ${j[k].toFixed(2)}`); return p; }))
      : h('p', 'note', 'Jev couldn’t lint this one.'));
}
function integration(d) {
  const facts = d.example?.facts && Object.keys(d.example.facts).length;
  return `// Jev integration drafted by prompt2jev. Check the policy in decide() before you ship it.
const questions = ${JSON.stringify(d.questions, null, 2)};

${d.code || '// (no decide() drafted)'}

export async function run(state${facts ? ', facts' : ''}) {
  const r = await fetch('${ENDPOINT}', {
    method: 'POST',
    headers: { Authorization: \`Bearer \${process.env.TYPESAFE_API_KEY}\`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'jev-1.14.0', state, questions }),
  });
  if (!r.ok) throw new Error(\`Jev \${r.status}\`); // a failed call is an error, never a "no"
  const { answers } = await r.json();
  return decide(answers${facts ? ', facts' : ', {}'});
}
`;
}
let current = null;
function renderDraft(data) {
  current = data.draft;
  const ids = Object.keys(data.draft.questions), bad = ids.filter(id => flagsOf(data.lint[id]).length);
  const modelName = data.draft_model.split('/').pop();
  $('draft-sub').replaceChildren(`Drafted by ${modelName} on ${data.draft_model.startsWith('@cf/') ? 'Workers AI' : 'OpenRouter'}, then linted by Jev (${data.model}) · ${(data.elapsed_ms / 1000).toFixed(1)} s.`);
  const kids = [h('p', `p2j-summary${bad.length ? ' warn' : ''}`, bad.length
    ? `${ids.length} question${ids.length > 1 ? 's' : ''} for Jev. Jev still flags ${bad.length}: ${bad.join(', ')}. Fix those by hand, or try jev-lint’s rewrite.`
    : `✓ ${ids.length} question${ids.length > 1 ? 's' : ''} for Jev, all clear on jev-lint.`)];
  if (data.first_draft) {
    const first = Object.entries(data.first_draft.lint).filter(([, j]) => flagsOf(j).length).map(([id, j]) => `${id} (${flagsOf(j).map(k => LINT[k]).join(', ')})`);
    kids.push(h('p', 'p2j-first', data.first_draft.kept
      ? `Jev flagged ${first.join('; ')} in the first draft. The revision was worse, so this is the first draft.`
      : `Jev flagged ${first.join('; ')} in the first draft, so the model revised it once with Jev’s flags.`));
  }
  kids.push(h('ol', 'p2j-qs', ...ids.map(id => questionCard(id, data.draft.questions[id], data.lint[id]))));
  if (data.draft.table) kids.push(h('div', 'p2j-block', h('div', 'p2j-block-head', h('h4', null, 'Truth table'), copyButton(() => data.draft.table)), markdown(data.draft.table)));
  if (data.draft.code) kids.push(block('decide()', data.draft.code));
  kids.push(block('Questions JSON', JSON.stringify(data.draft.questions, null, 2)));
  kids.push(block('All of it, as one file', integration(data.draft)));
  $('draft-body').replaceChildren(...kids); $('draft').hidden = false;
  $('try-input').value = JSON.stringify(data.draft.example || { state: {}, facts: {} }, null, 2);
  $('try-body').replaceChildren(); $('try-error').hidden = true; $('try-status').textContent = '';
  $('try').hidden = false;
}

// --- 3. Try it. decide() is model-written code, so it runs in a sandboxed iframe with an
// opaque origin: no cookies, no page access, no network beyond what any page could do.
const SANDBOX = `<!doctype html><script>
addEventListener('message', e => {
  const { id, code, answers, facts } = e.data || {};
  let out;
  try { const decide = new Function(code + '\\n;return typeof decide === "function" ? decide : null;')(); if (!decide) throw new Error('The code defines no decide() function.'); const v = decide(answers, facts); out = { ok: true, value: JSON.stringify(v) ?? String(v) }; }
  catch (err) { out = { ok: false, error: String(err && err.message || err) }; }
  parent.postMessage({ id, ...out }, '*');
});
<\/script>`;
function runDecide(code, answers, facts) {
  return new Promise(resolve => {
    const frame = h('iframe', null); frame.setAttribute('sandbox', 'allow-scripts'); frame.hidden = true; frame.srcdoc = SANDBOX;
    const id = Math.random().toString(36).slice(2);
    const done = out => { clearTimeout(timer); removeEventListener('message', onMsg); frame.remove(); resolve(out); };
    const onMsg = e => { if (e.source === frame.contentWindow && e.data?.id === id) done(e.data); };
    const timer = setTimeout(() => done({ ok: false, error: 'decide() took longer than 3 seconds.' }), 3000);
    addEventListener('message', onMsg);
    frame.addEventListener('load', () => frame.contentWindow.postMessage({ id, code, answers, facts }, '*'));
    document.body.append(frame);
  });
}
function answerCard(id, q, a) {
  if (q.type === 'noul') return h('div', `p2j-answer is-${band(a.noul)}`, row(id, a.noul, q.instructions.length > 90 ? null : q.instructions, false));
  const picked = q.type === 'choice' ? a.choice : a.score;
  const probs = Object.entries(a.probabilities || {}).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([k, p]) => `${k} ${p.toFixed(2)}`).join(' · ');
  return h('div', 'p2j-answer', h('div', 'lint-row-head', h('span', 'lint-name', id), h('span', 'lint-tag', q.type)), h('p', 'p2j-q-text', h('code', null, String(picked))), h('p', 'lint-ask', probs));
}
async function runTry() {
  if (!current || busy) return;
  let input;
  try { input = JSON.parse($('try-input').value); } catch { $('try-error').textContent = 'The input isn’t valid JSON.'; $('try-error').hidden = false; return; }
  const state = input?.state, facts = input?.facts ?? {};
  if (!state || typeof state !== 'object' || Array.isArray(state)) { $('try-error').textContent = 'The input needs a "state" object: what Jev sees.'; $('try-error').hidden = false; return; }
  busy = true; $('try-run').disabled = true; $('try-error').hidden = true;
  $('try-status').textContent = 'Asking Jev'; $('try-status').classList.add('p2j-busy');
  try {
    const data = await api({ demo: 'p2j_try', questions: current.questions, state }, 30000);
    const kids = [h('div', 'p2j-answers', ...Object.entries(current.questions).map(([id, q]) => answerCard(id, q, data.answers[id])))];
    if (current.code) {
      const r = await runDecide(current.code, data.answers, facts);
      kids.push(r.ok ? h('p', 'p2j-decision', 'decide() returned ', h('code', null, r.value)) : h('p', 'p2j-decision is-error', `decide() threw: ${r.error}`));
    }
    $('try-body').replaceChildren(...kids);
    $('try-status').textContent = `Live · ${data.model} · ${data.elapsed_ms} ms`;
  } catch (err) {
    $('try-status').textContent = ''; $('try-error').textContent = errText(err); $('try-error').hidden = false;
  } finally { busy = false; $('try-run').disabled = false; $('try-status').classList.remove('p2j-busy'); resetWidget(); }
}

// --- The flow.
let lastPrompt = '';
const status = (text, spinning) => { $('p2j-status').textContent = text; $('p2j-status').classList.toggle('p2j-busy', !!spinning); };
function resetWidget() { if (widgetId !== undefined && !window.jevHuman.ok()) window.turnstile.reset(widgetId); }
function setBusy(on) { busy = on; $('p2j-run').disabled = on; }
async function runDraft(prompt) {
  setBusy(true); showError('');
  status('Drafting, then Jev lints each question (about a minute)', true);
  $('draft').hidden = true; $('try').hidden = true;
  try {
    const data = await api({ demo: 'p2j_draft', prompt, draft_model: new URLSearchParams(location.search).get('model') || undefined }, 200000);
    renderDraft(data); status('');
    $('draft').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) { status(''); showError(errText(err)); }
  finally { setBusy(false); resetWidget(); }
}
async function convert(e) {
  e?.preventDefault();
  const prompt = $('p2j-prompt').value.trim();
  if (!prompt || busy) return;
  lastPrompt = prompt;
  setBusy(true); showError(''); status('Asking Jev whether this should be Jev', true);
  for (const id of ['fit', 'draft', 'try']) $(id).hidden = true;
  let fit;
  try { fit = await api({ demo: 'p2j_fit', prompt }, 30000); renderFit(fit); }
  catch (err) { status(''); showError(errText(err)); setBusy(false); resetWidget(); return; }
  setBusy(false);
  if (fit.verdict === 'keep') { status(''); $('fit').scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  await runDraft(prompt);
}

// --- Wiring.
const updateCount = () => { $('p2j-count').textContent = `${$('p2j-prompt').value.length} / ${MAX}`; };
$('p2j-examples').replaceChildren(...EXAMPLES.map(x => {
  const b = h('button', 'chip', x.label); b.type = 'button';
  b.addEventListener('click', () => { $('p2j-prompt').value = x.prompt; updateCount(); for (const c of $('p2j-examples').children) c.classList.toggle('active', c === b); });
  return b;
}));
$('p2j-prompt').addEventListener('input', () => { updateCount(); for (const c of $('p2j-examples').children) c.classList.remove('active'); });
$('p2j-form').addEventListener('submit', convert);
$('try-run').addEventListener('click', runTry);
$('route-human-check').hidden = true;
$('p2j-prompt').value = EXAMPLES[0].prompt; $('p2j-examples').children[0].classList.add('active'); updateCount();
renderWidget();
