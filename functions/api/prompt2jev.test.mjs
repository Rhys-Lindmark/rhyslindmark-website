// prompt2jev through /api/jev: the fit check, the draft (Workers AI + Jev lint + one
// revision) and "try it". Jev and Workers AI are mocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandler } from './jev.js';
import { parseDraft, fitVerdict, tryInput } from '../_lib/prompt2jev.js';

const db = { prepare() { return { bind() { return { async first() { return { reserved_micros: 10000 }; }, async run() { return {}; } }; } }; } };
const env = AI => ({ JEV_ENABLED: '1', JEV_API_KEY: 'test-key-placeholder', JEV_TURNSTILE_SECRET: 's', JEV_KEY_SECRET: 'k', JEV_DB: db, AI });
const make = body => new Request('https://ai.rhyslindmark.com/api/jev', { method: 'POST', headers: { Origin: 'https://ai.rhyslindmark.com', 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' }, body: JSON.stringify({ verification_token: 'human', ...body }) });
const handler = jev => createHandler(async (url, init) => url.includes('/siteverify') ? Response.json({ success: true, hostname: 'ai.rhyslindmark.com', action: 'jev_check' }) : Response.json({ model: 'jev-test', answers: jev(JSON.parse(init.body)) }));
const noul = p => ({ noul: p });
const clean = { decision: noul(.03), compound: noul(.05), hidden_rules: noul(.1), needs_math: noul(.04) };
const reply = (questions, code = 'function decide(answers, facts) { return "P3"; }') => `Here you go.\n\`\`\`md\n| a | b |\n\`\`\`\n\`\`\`json\n${JSON.stringify(questions)}\n\`\`\`\n\`\`\`javascript\n${code}\n\`\`\`\n\`\`\`json\n{"state": {"ticket": {"message": "Site is down"}}, "facts": {"plan": "enterprise"},}\n\`\`\``;
const PROMPT = 'You are a triage assistant. Decide P1, P2 or P3.';

test('fit: three Nouls about the prompt as quoted state, and a verdict from code', async () => {
  const h = handler(b => { assert.deepEqual(b.state, { prompt: PROMPT }); assert.deepEqual(Object.keys(b.questions), ['picks_outcome', 'writes_text', 'extracts_values']); return { picks_outcome: noul(.95), writes_text: noul(.1), extracts_values: noul(.05) }; });
  const r = await h({ request: make({ demo: 'p2j_fit', prompt: `  ${PROMPT}  ` }), env: env() });
  const b = await r.json();
  assert.equal(r.status, 200); assert.equal(b.verdict, 'migrate'); assert.equal(b.fit.picks_outcome, .95);
  assert.ok(!JSON.stringify(b).includes('test-key'));
  assert.equal(fitVerdict({ picks_outcome: .9, writes_text: .8, extracts_values: .1 }), 'split');
  assert.equal(fitVerdict({ picks_outcome: .1, writes_text: .9, extracts_values: .1 }), 'keep');
  assert.equal(fitVerdict({ picks_outcome: .5, writes_text: .5, extracts_values: .1 }), 'unsure');
});

test('draft: Workers AI drafts, Jev lints each question, and a flagged draft is revised once', async () => {
  const seen = [];
  const h = handler(b => { const i = b.state.question.instructions; seen.push(i); return i.includes('urgent') ? { ...clean, hidden_rules: noul(.9) } : clean; });
  const replies = [reply({ urgent: { type: 'noul', instructions: 'Is `ticket` urgent?' }, outage: { type: 'noul', instructions: 'Does `ticket.message` report an outage?' } }), reply({ outage: { type: 'noul', instructions: 'Does `ticket.message` report an outage?' } }, 'function decide(a){return "P1"}')];
  let last;
  const AI = { async run(model, input) { last = input.messages; assert.equal(model, '@cf/openai/gpt-oss-120b'); return { response: replies.shift() }; } };
  const r = await h({ request: make({ demo: 'p2j_draft', prompt: PROMPT, draft_model: '@cf/not/allowed' }), env: env(AI) });
  const b = await r.json();
  assert.equal(r.status, 200);
  assert.match(last.at(-1).content, /urgent: hidden_rules 0.90/);
  assert.match(last[1].content, /<prompt>\nYou are a triage assistant/);
  assert.deepEqual(Object.keys(b.draft.questions), ['outage']);
  assert.equal(b.draft.code, 'function decide(a){return "P1"}');
  assert.deepEqual(b.draft.example, { state: { ticket: { message: 'Site is down' } }, facts: { plan: 'enterprise' } });
  assert.equal(b.lint.outage.hidden_rules, .1);
  assert.deepEqual(Object.keys(b.first_draft.questions), ['urgent', 'outage']);
  assert.equal(seen.length, 3);
});

test('draft: an unusable reply gets one retry, then a clear error', async () => {
  let calls = 0;
  const h = handler(() => clean);
  const r = await h({ request: make({ demo: 'p2j_draft', prompt: PROMPT }), env: env({ async run() { calls++; return { response: 'I cannot help with that.' }; } }) });
  assert.equal(r.status, 502); assert.equal(calls, 2);
  assert.match((await r.json()).error, /usable draft/);
  const none = await h({ request: make({ demo: 'p2j_draft', prompt: PROMPT }), env: env(undefined) });
  assert.equal(none.status, 503);
});

test('try: Jev answers the drafted questions about the input, and only validated answers return', async () => {
  const h = handler(b => { assert.deepEqual(b.state, { ticket: { message: 'Down!' } }); return { outage: { noul: .97, extra: 'x' }, kind: { choice: 'bug', probabilities: { bug: .8, billing: .2 }, confidence: .7 } }; });
  const questions = { outage: { type: 'noul', instructions: 'Does `ticket.message` report an outage?' }, kind: { type: 'choice', instructions: 'What is `ticket` about?', criteria: { bug: 'A bug', billing: 'Billing' } } };
  const r = await h({ request: make({ demo: 'p2j_try', questions, state: { ticket: { message: 'Down!' } } }), env: env() });
  const b = await r.json();
  assert.equal(r.status, 200);
  assert.deepEqual(b.answers.outage, { noul: .97 });
  assert.equal(b.answers.kind.choice, 'bug');
});

test('rejects bad input before calling Jev', async () => {
  let calls = 0;
  const h = createHandler(async () => { calls++; throw Error(); });
  for (const body of [{ demo: 'p2j_fit', prompt: '' }, { demo: 'p2j_draft', prompt: 'x'.repeat(6001) }, { demo: 'p2j_try', questions: {}, state: {} }, { demo: 'p2j_try', questions: { 'Bad Id': { type: 'noul', instructions: 'Is it?' } }, state: {} }, { demo: 'p2j_try', questions: { a: { type: 'noul', instructions: 'Is it?' } }, state: [] }, { demo: 'p2j_try', questions: { a: { type: 'noul', instructions: 'Is it?' } }, state: { x: 'y'.repeat(8001) } }])
    assert.equal((await h({ request: make(body), env: env() })).status, 400);
  assert.equal(calls, 0);
  assert.equal(tryInput({ questions: Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`q${i}`, { type: 'noul', instructions: 'Is it?' }])), state: {} }), null);
});

test('parseDraft: forgiving about fences, wrapped objects, thinking and trailing commas; strict about ids', () => {
  const p = parseDraft('<think>```json\n{"nope": {"instructions": "x"}}\n```</think>```markdown\nT\n```\n```json\n{"questions": {"Outage": {"type": "Noul", "instructions": "Does it report an outage?",}, "bad id": {"type": "noul", "instructions": "x"}, "level": {"type": "score", "instructions": "How angry?", "criteria": ["calm", "angry"]}}}\n```\n```js\nfunction decide() {}\n```');
  assert.equal(p.table, 'T');
  assert.deepEqual(Object.keys(p.questions), ['outage', 'level']);
  assert.equal(p.questions.outage.type, 'noul');
  assert.equal(p.example, null);
  assert.equal(parseDraft('no blocks').error, 'no_questions');
});
