// Runs every task on every arm (4 Claude models x 2 effort levels) through the
// Message Batches API (50% off), grades each reply, and never spends past the
// budget.
//
//   node --env-file-if-exists=.env run-models.mjs plan   # print the plan, spend nothing
//   node --env-file-if-exists=.env run-models.mjs run    # probe, then full rounds while budget allows
//
// Spending is staged: a small probe batch first, then the measured cost per
// request is used to decide whether a full round fits in what is left. Every
// result is appended to results/raw.jsonl, so a run can be stopped and resumed.
import Anthropic from '@anthropic-ai/sdk';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { TASKS } from './tasks.mjs';
import { grade } from './graders.mjs';

export const BUDGET_USD = Number(process.env.EVAL_BUDGET_USD || 25);
export const MAX_REPS = 3;
// $ per million tokens, first-party rates; batches are billed at half.
export const PRICES = {
  'claude-haiku-5-5': { in: 0.10, out: 0.50 },
  'claude-sonnet-5-5': { in: 2, out: 10 },
  'claude-opus-5-5': { in: 4, out: 20 },
  'claude-fable-5-2': { in: 8, out: 40 }
};
export const MODELS = { haiku: 'claude-haiku-5-5', sonnet: 'claude-sonnet-5-5', opus: 'claude-opus-5-5', fable: 'claude-fable-5-2' };
export const EFFORTS = ['low', 'high'];
export const ARMS = Object.keys(MODELS).flatMap(m => EFFORTS.map(e => `${m}:${e}`));
const MAX_TOKENS = { low: 8000, high: 16000 };
const BATCH_DISCOUNT = 0.5;
const PROBE_TASKS = ['math-01', 'math-09', 'code-02', 'code-09', 'write-01', 'write-09', 'logic-03', 'logic-09', 'facts-01', 'facts-12'];

const DIR = new URL('./results/', import.meta.url);
const RAW = new URL('raw.jsonl', DIR), STATE = new URL('state.json', DIR);
mkdirSync(DIR, { recursive: true });

export const cost = (model, usage) => BATCH_DISCOUNT * ((usage.input_tokens || 0) * PRICES[model].in + (usage.output_tokens || 0) * PRICES[model].out) / 1e6;
export const readRaw = () => existsSync(RAW) ? readFileSync(RAW, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const loadState = () => existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : { pending: [] };
const saveState = s => writeFileSync(STATE, JSON.stringify(s, null, 2));
const key = (task, arm, rep) => `${task}__${arm.replace(':', '_')}__r${rep}`;
const spent = () => readRaw().reduce((s, r) => s + r.cost_usd, 0);

function request(task, arm, rep) {
  const [m, effort] = arm.split(':');
  return {
    custom_id: key(task.id, arm, rep),
    // Thinking is left at each model's default (adaptive); effort is the only knob.
    params: { model: MODELS[m], max_tokens: MAX_TOKENS[effort], output_config: { effort }, messages: [{ role: 'user', content: `${task.prompt}\n\n${task.format}` }] }
  };
}

function todo(rep, onlyTasks) {
  const done = new Set(readRaw().map(r => r.id));
  const pend = new Set(loadState().pending.flatMap(b => b.ids));
  return TASKS.filter(t => !onlyTasks || onlyTasks.includes(t.id))
    .flatMap(t => ARMS.map(a => ({ t, a, id: key(t.id, a, rep) })))
    .filter(x => !done.has(x.id) && !pend.has(x.id))
    .map(x => request(x.t, x.a, rep));
}

// Cost per request, by arm, from what has actually been spent so far.
function measuredCostPerArm() {
  const by = {};
  for (const r of readRaw()) (by[r.arm] ||= []).push(r.cost_usd);
  return Object.fromEntries(Object.entries(by).map(([a, xs]) => [a, xs.reduce((s, x) => s + x, 0) / xs.length]));
}
function projected(reqs) {
  const per = measuredCostPerArm(), fallback = Math.max(...Object.values(per), 0.05);
  return reqs.reduce((s, r) => { const [, arm] = r.custom_id.split('__'); return s + (per[arm.replace('_', ':')] ?? fallback); }, 0);
}

async function submitAndCollect(client, reqs, label) {
  if (!reqs.length) return;
  const batch = await client.messages.batches.create({ requests: reqs });
  const state = loadState(); state.pending.push({ id: batch.id, label, ids: reqs.map(r => r.custom_id) }); saveState(state);
  console.log(`submitted ${label}: ${reqs.length} requests as ${batch.id}`);
  await collect(client, batch.id);
}

async function collect(client, batchId) {
  let b;
  while ((b = await client.messages.batches.retrieve(batchId)).processing_status !== 'ended') {
    console.log(`  ${batchId}: ${JSON.stringify(b.request_counts)}`);
    await new Promise(r => setTimeout(r, 60000));
  }
  const byId = Object.fromEntries(TASKS.map(t => [t.id, t]));
  let n = 0, errors = 0;
  for await (const res of await client.messages.batches.results(batchId)) {
    const [taskId, armKey, repKey] = res.custom_id.split('__');
    const arm = armKey.replace('_', ':'), model = MODELS[arm.split(':')[0]];
    if (res.result.type !== 'succeeded') { errors++; console.log(`  ${res.custom_id}: ${res.result.type}`); continue; } // left undone; rerun picks it up
    const msg = res.result.message;
    const text = msg.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
    const g = msg.stop_reason === 'refusal' ? { pass: false, detail: 'refusal' } : grade(byId[taskId], text);
    appendFileSync(RAW, JSON.stringify({ id: res.custom_id, task: taskId, arm, rep: Number(repKey.slice(1)), model, stop_reason: msg.stop_reason, usage: msg.usage, cost_usd: cost(model, msg.usage), pass: g.pass, detail: g.detail, text }) + '\n');
    n++;
  }
  const state = loadState(); state.pending = state.pending.filter(p => p.id !== batchId); saveState(state);
  console.log(`  collected ${n} results (${errors} not succeeded). Spent so far: $${spent().toFixed(2)} of $${BUDGET_USD}`);
}

async function main() {
  const cmd = process.argv[2] || 'plan';
  const full = TASKS.length * ARMS.length;
  console.log(`${TASKS.length} tasks x ${ARMS.length} arms = ${full} requests per round; budget $${BUDGET_USD}; spent $${spent().toFixed(2)}`);
  if (cmd === 'plan') {
    console.log(`arms: ${ARMS.join(', ')}`);
    console.log(`stage 1: probe ${PROBE_TASKS.length} tasks x ${ARMS.length} arms = ${PROBE_TASKS.length * ARMS.length} requests`);
    console.log(`stage 2+: full rounds (up to ${MAX_REPS}), each submitted only if its projected cost fits the remaining budget`);
    return;
  }
  if (cmd !== 'run') throw new Error(`unknown command ${cmd}`);
  const client = new Anthropic();
  for (const p of loadState().pending) { console.log(`resuming ${p.id}`); await collect(client, p.id); }
  if (!readRaw().length) await submitAndCollect(client, todo(0, PROBE_TASKS), 'probe');
  // Each round goes out in chunks of 15 tasks, re-checking the budget before
  // each one, so a wrong projection can overshoot by at most one chunk.
  const CHUNK = 15 * ARMS.length;
  outer: for (let rep = 0; rep < MAX_REPS; rep++) {
    const round = todo(rep);
    if (!round.length) continue;
    console.log(`round ${rep + 1}: ${round.length} requests, projected $${projected(round).toFixed(2)}`);
    for (let i = 0; i < round.length; i += CHUNK) {
      const reqs = round.slice(i, i + CHUNK), need = projected(reqs), left = BUDGET_USD - spent();
      // 15% margin: a chunk can run longer than earlier results suggest.
      if (need * 1.15 > left) { console.log(`  stopping: next chunk projected $${need.toFixed(2)}, only $${left.toFixed(2)} left`); break outer; }
      await submitAndCollect(client, reqs, `round ${rep + 1}, chunk ${i / CHUNK + 1}`);
    }
  }
  console.log(`done. Spent $${spent().toFixed(2)} of $${BUDGET_USD}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(1); });
