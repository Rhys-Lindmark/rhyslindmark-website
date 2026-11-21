// Runs every task on every arm (4 open models standing in for the router's 4
// tiers, x 2 reasoning-effort levels) through OpenRouter, grades each reply,
// and never spends past the budget.
//
//   node run-models.mjs plan   # print the plan, spend nothing
//   node run-models.mjs run    # probe, then full rounds while budget allows
// Reads OPENROUTER_KEY_JEV_EVAL from evals/.env.
//
// Spending is staged: a small probe first, then each round goes out in chunks
// of 15 tasks, each sent only if its projected cost (from what has actually
// been spent per arm) fits what is left. Results are appended to
// results/raw.jsonl as they arrive, so a run can be stopped and resumed.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { TASKS, RESULTS, EVAL_SET } from './eval-set.mjs';
import { grade } from './graders.mjs';

export const BUDGET_USD = Number(process.env.EVAL_BUDGET_USD || 25);
export const MAX_REPS = Number(process.env.EVAL_MAX_REPS || 3);
// The router's tiers keep their names (its truth table says haiku..fable);
// each is played by an open model, cheapest to strongest.
// v1 used a mixed ladder; v1 showed family quirks (GLM is weak at letter-level
// work) swamping tier differences, so v2 uses one family: Qwen.
const LADDERS = {
  v1: {
    models: { haiku: 'z-ai/glm-5.3-flash', sonnet: 'deepseek/deepseek-v4.1-flash-1017', opus: 'z-ai/glm-5.3', fable: 'deepseek/deepseek-v4-pro-0813' },
    names: { haiku: 'GLM 5.3 Flash', sonnet: 'DeepSeek V4.1 Flash', opus: 'GLM 5.3', fable: 'DeepSeek V4 Pro' }
  },
  v2: {
    // No Fable tier: these prompts never needed one, and Qwen 3.8 Max Prime was most
    // of the cost. The router's Fable picks map to the top tier here (Qwen 3.7 Max).
    models: { haiku: 'qwen/qwen3.7-flash', sonnet: 'qwen/qwen3.7-plus', opus: 'qwen/qwen3.7-max' },
    names: { haiku: 'Qwen 3.7 Flash', sonnet: 'Qwen 3.7 Plus', opus: 'Qwen 3.7 Max' }
  }
};
export const MODELS = LADDERS[EVAL_SET].models;
export const MODEL_NAMES = LADDERS[EVAL_SET].names;
// $ per million tokens from OpenRouter's model list (2026-11-21); used only if a
// response doesn't report its own cost.
export const PRICES = {
  'z-ai/glm-5.3-flash': { in: 0.04, out: 0.078 },
  'deepseek/deepseek-v4.1-flash-1017': { in: 0.15, out: 0.60 },
  'z-ai/glm-5.3': { in: 0.07, out: 1.40 },
  'deepseek/deepseek-v4-pro-0813': { in: 1.32, out: 3.96 },
  'qwen/qwen3.7-flash': { in: 0.03, out: 0.13 },
  'qwen/qwen3.7-plus': { in: 0.32, out: 1.28 },
  'qwen/qwen3.7-max': { in: 1.475, out: 4.425 },
  'qwen/qwen3.8-max-prime': { in: 4, out: 12 }
};
export const EFFORTS = ['low', 'high'];
export const ARMS = Object.keys(MODELS).flatMap(m => EFFORTS.map(e => `${m}:${e}`));
const MAX_TOKENS = { low: 8000, high: 16000 };
const CONCURRENCY = Number(process.env.EVAL_CONCURRENCY || 24);
const PROBE_TASKS = ['math-01', 'math-09', 'code-02', 'code-09', 'write-01', 'write-09', 'logic-03', 'logic-09', 'facts-01', 'facts-12'];

const DIR = RESULTS;
const RAW = new URL('raw.jsonl', DIR);
mkdirSync(DIR, { recursive: true });

export const cost = (model, usage) => typeof usage?.cost === 'number' ? usage.cost
  : ((usage?.prompt_tokens || 0) * PRICES[model].in + (usage?.completion_tokens || 0) * PRICES[model].out) / 1e6;
export const readRaw = () => existsSync(RAW) ? readFileSync(RAW, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const key = (task, arm, rep) => `${task}__${arm.replace(':', '_')}__r${rep}`;
const spent = () => readRaw().reduce((s, r) => s + r.cost_usd, 0);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const retries = {}; // HTTP status -> count, logged so slow runs explain themselves

function todo(rep, onlyTasks) {
  const done = new Set(readRaw().map(r => r.id));
  return TASKS.filter(t => !onlyTasks || onlyTasks.includes(t.id))
    .flatMap(t => ARMS.map(arm => ({ task: t, arm, rep, id: key(t.id, arm, rep) })))
    .filter(x => !done.has(x.id));
}

// Mean cost per request for each arm, from what has actually been spent.
function projected(jobs) {
  const by = {};
  for (const r of readRaw()) (by[r.arm] ||= []).push(r.cost_usd);
  const per = Object.fromEntries(Object.entries(by).map(([a, xs]) => [a, xs.reduce((s, x) => s + x, 0) / xs.length]));
  const fallback = Math.max(...Object.values(per), 0.02);
  return jobs.reduce((s, j) => s + (per[j.arm] ?? fallback), 0);
}

async function call(job) {
  const [tier, effort] = job.arm.split(':'), model = MODELS[tier];
  const body = {
    model, max_tokens: MAX_TOKENS[effort],
    messages: [{ role: 'user', content: `${job.task.prompt}\n\n${job.task.format}` }],
    reasoning: { effort },
    usage: { include: true },
    provider: { require_parameters: true } // only providers that honor the reasoning setting
  };
  const started = Date.now();
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENROUTER_KEY_JEV_EVAL}`, 'Content-Type': 'application/json', 'X-Title': 'model-router-eval' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(300000)
    }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }));
    if (r.ok) {
      const data = await r.json();
      if (data.error) throw new Error(`${job.id}: ${JSON.stringify(data.error).slice(0, 200)}`);
      const choice = data.choices?.[0], text = choice?.message?.content ?? '';
      const g = grade(job.task, text);
      return { id: job.id, task: job.task.id, arm: job.arm, rep: job.rep, model, served_by: data.provider ?? null, finish_reason: choice?.finish_reason ?? null, usage: data.usage ?? null, cost_usd: cost(model, data.usage), latency_ms: Date.now() - started, pass: g.pass, detail: g.detail, text };
    }
    const msg = (await r.text()).slice(0, 300);
    retries[r.status] = (retries[r.status] || 0) + 1;
    if (retries[r.status] === 1 || retries[r.status] % 25 === 0) console.log(`  retrying after HTTP ${r.status} (seen ${retries[r.status]}×): ${msg.replace(/\s+/g, ' ').slice(0, 140)}`);
    // A 402 about in-flight requests clears once they settle; any other 400/401/402 is final.
    if ([400, 401, 402].includes(r.status) && !/in_flight/.test(msg)) throw new Error(`${job.id}: HTTP ${r.status} ${msg}`);
    await sleep(2000 * 2 ** attempt);
  }
  throw new Error(`${job.id}: gave up after retries`);
}

// One continuous stream of requests, CONCURRENCY at a time: a slow request
// never holds up the others. Before each request the budget is checked against
// what has been spent plus what is in flight, so the run stops just short of it.
async function runJobs(jobs, label) {
  console.log(`${label}: ${jobs.length} requests, projected $${projected(jobs).toFixed(2)}`);
  let next = 0, done = 0, failed = 0, inFlight = 0, stopped = false;
  const worker = async () => {
    while (next < jobs.length && !stopped) {
      const job = jobs[next], need = projected([job]) * 1.15;
      if (spent() + inFlight + need > BUDGET_USD) { stopped = true; console.log(`  stopping: next request would pass the $${BUDGET_USD} budget`); break; }
      next++; inFlight += need;
      try { appendFileSync(RAW, JSON.stringify(await call(job)) + '\n'); done++; }
      catch (e) { failed++; console.log(`  ${e.message}`); if (/HTTP 40[12]/.test(e.message)) stopped = true; }
      finally { inFlight -= need; }
      if ((done + failed) % 40 === 0) console.log(`  ${done + failed}/${jobs.length} · spent $${spent().toFixed(3)}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  console.log(`  ${label}: ${done} ok, ${failed} failed (failed ones rerun next time). Spent $${spent().toFixed(3)} of $${BUDGET_USD}`);
}

async function main() {
  const cmd = process.argv[2] || 'plan';
  console.log(`${TASKS.length} tasks x ${ARMS.length} arms = ${TASKS.length * ARMS.length} requests per round; budget $${BUDGET_USD}; spent $${spent().toFixed(3)}`);
  if (cmd === 'plan') {
    for (const [t, m] of Object.entries(MODELS)) console.log(`  ${t.padEnd(7)} -> ${m}`);
    console.log(`stage 1: probe ${PROBE_TASKS.length} tasks x ${ARMS.length} arms; then up to ${MAX_REPS} full rounds as one stream, checking the budget before every request`);
    return;
  }
  if (cmd !== 'run') throw new Error(`unknown command ${cmd}`);
  try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch {}
  if (!process.env.OPENROUTER_KEY_JEV_EVAL) { console.error('OPENROUTER_KEY_JEV_EVAL is not set (add it to evals/.env). See README.'); process.exit(1); }
  // Every remaining (task, arm, repeat) as one stream: the probe tasks first, so
  // real per-arm costs are known early for the budget check, then everything
  // else, first repeats first. Nothing waits for a slow request to finish.
  const probeFirst = jobs => [...jobs.filter(j => PROBE_TASKS.includes(j.task.id)), ...jobs.filter(j => !PROBE_TASKS.includes(j.task.id))];
  await runJobs(Array.from({ length: MAX_REPS }, (_, rep) => probeFirst(todo(rep))).flat(), `rounds 1-${MAX_REPS}`);
  console.log(`done. Spent $${spent().toFixed(3)} of $${BUDGET_USD}.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e.message); process.exit(1); });
