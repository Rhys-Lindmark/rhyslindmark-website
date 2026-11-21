// Turns results/raw.jsonl + results/jev.json into results/summary.json (read by
// the /jev page) and a printed report. Spends nothing.
//   node analyze.mjs
import { existsSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { TASKS, RESULTS, EVAL_SET } from './eval-set.mjs';
import { ARMS, MODELS, MODEL_NAMES, EFFORTS, readRaw, BUDGET_USD } from './run-models.mjs';
import { judge, decide } from '../../public/jev/router-policy.js';

const JEV = new URL('jev.json', RESULTS);
const SUMMARY = new URL('summary.json', RESULTS);
const PAGE_COPY = new URL(EVAL_SET === 'v2' ? '../../public/jev/eval-summary-v2.json' : '../../public/jev/eval-summary.json', import.meta.url);
import { grade } from './graders.mjs';
// Re-grade every stored reply, so grader fixes apply to past runs for free.
const byTask = Object.fromEntries(TASKS.map(t => [t.id, t]));
const raw = readRaw().map(r => ({ ...r, pass: r.finish_reason === 'length' && !r.text?.trim() ? false : grade(byTask[r.task], r.text ?? '').pass }));
const jev = existsSync(JEV) ? JSON.parse(readFileSync(JEV, 'utf8')) : {};

// ---- per task x arm: success rate and mean cost over repeats -----------------
const cell = {};
for (const r of raw) { const c = ((cell[r.task] ||= {})[r.arm] ||= { n: 0, pass: 0, cost: 0 }); c.n++; c.pass += r.pass ? 1 : 0; c.cost += r.cost_usd; }
const complete = TASKS.filter(t => cell[t.id] && ARMS.every(a => cell[t.id][a]) && jev[t.id]);
// Eval 2: the 60 v1 prompts are the training set (Router v2's table and Router
// v3's model are fit on them); every score below is on the other, held-out prompts.
const trainTasks = EVAL_SET === 'v2' ? complete.filter(t => t.family === 'v1') : [];
const tasks = EVAL_SET === 'v2' ? complete.filter(t => t.family !== 'v1') : complete;
if (!tasks.length) { console.error('No task has results for every arm plus Jev answers yet.'); process.exit(1); }
const S = (t, a) => cell[t.id][a].pass / cell[t.id][a].n;
const C = (t, a) => cell[t.id][a].cost / cell[t.id][a].n;
const reps = Math.min(...tasks.flatMap(t => ARMS.map(a => cell[t.id][a].n)));

// A policy maps each task to an arm. Score = mean success; cost = $ per 1,000 prompts.
const score = pick => {
  const arms = tasks.map(pick);
  return { pass: mean(tasks.map((t, i) => S(t, arms[i]))), cost: 1000 * mean(tasks.map((t, i) => C(t, arms[i]))), arms };
};
const mean = xs => xs.reduce((s, x) => s + x, 0) / xs.length;
const tierOfArm = a => a.split(':')[0];
const effortFor = level => level >= 2 ? 'high' : 'low'; // Off/Low -> low effort, Medium/High -> high
// A tier this eval doesn't have (Eval 2 has no Fable) falls back to the top tier it does have.
const TOP = Object.keys(MODELS).at(-1);
const tierOK = t => MODELS[t] ? t : TOP;

const policies = [];
const add = (name, kind, pick, extra = {}) => { const s = score(pick); policies.push({ name, kind, ...s, ...extra }); return s; };

const armName = a => { const [t, e] = a.split(':'); return `${MODEL_NAMES[t]} · ${e}`; };
for (const a of ARMS) add(`Always ${armName(a)}`, 'fixed', () => a);
const shipped = add('Router (shipped table)', 'router', t => { const d = decide(judge(jev[t.id].answers)); return `${tierOK(d.tier)}:${effortFor(d.reasoning)}`; });
for (const yes of [0.5, 0.6, 0.8, 0.9]) for (const unsure of [true, false]) {
  add(`Router · yes ≥ ${yes}, unsure = ${unsure ? 'yes' : 'no'}`, 'router-variant', t => { const d = decide(judge(jev[t.id].answers, { yes, no: 1 - yes, unsureCountsAs: unsure })); return `${tierOK(d.tier)}:${effortFor(d.reasoning)}`; });
}
for (const e of EFFORTS) add(`Choice (argmax) · ${e} effort`, 'choice', t => `${tierOK(jev[t.id].answers.model_choice.choice.toLowerCase())}:${e}`);

// ---- Eval 2: Router v2 (new judgments + table) and Router v3 (Jev + learned odds) ----
let v3info = null;
if (EVAL_SET === 'v2' && trainTasks.length) {
  const { routerV2, features, trainRouterV3, chooseLambda } = await import('./routers-v2.mjs');
  const extra = JSON.parse(readFileSync(new URL('./results/jev-v2q.json', import.meta.url), 'utf8'));
  add('Router v2 (new Jev judgments)', 'router-v2', t => routerV2(jev[t.id].answers, extra[t.id]));
  const runsOf = t => Object.fromEntries(ARMS.map(a => [a, raw.filter(r => r.task === t.id && r.arm === a).map(r => r.pass ? 1 : 0)]));
  const train = trainTasks.map(t => ({ x: features(jev[t.id].answers, extra[t.id]), runs: runsOf(t), cost: Object.fromEntries(ARMS.map(a => [a, C(t, a)])) }));
  const LAMBDAS = [0, 2, 5, 10, 20, 50, 100, 200, 500];
  const { lambda, scored } = chooseLambda(train, ARMS, LAMBDAS);
  const v3 = trainRouterV3(train, ARMS);
  add(`Router v3 (Jev + learned odds, λ=${lambda})`, 'router-v3', t => v3.pick(features(jev[t.id].answers, extra[t.id]), lambda), { lambda });
  v3info = { lambda, training_curve: scored, train_tasks: trainTasks.length };
}

// Oracle: per task, the cheapest arm among those with the best success rate.
const oraclePick = t => { const best = Math.max(...ARMS.map(a => S(t, a))); return ARMS.filter(a => S(t, a) === best).sort((x, y) => C(t, x) - C(t, y))[0]; };
add('Oracle (cheapest best arm)', 'oracle', oraclePick);

// ---- learned router: logistic regression per arm on Jev's judgments ----------
// features: depth level probabilities (4) + the four Noul probabilities
const NOULS = ['expertise', 'high_stakes', 'large_output', 'nuanced_writing'];
const feats = t => { const a = jev[t.id].answers; return [1, ...[0, 1, 2, 3].map(i => a.reasoning_depth.probabilities[String(i)]), ...NOULS.map(n => a[n].noul)]; };
function fitLogistic(X, y, l2 = 1, steps = 2000, lr = 0.5) {
  let w = Array(X[0].length).fill(0);
  for (let s = 0; s < steps; s++) {
    const g = w.map((_, j) => j ? l2 * w[j] / X.length : 0);
    X.forEach((x, i) => { const p = 1 / (1 + Math.exp(-x.reduce((z, v, j) => z + v * w[j], 0))); x.forEach((v, j) => g[j] += (p - y[i]) * v / X.length); });
    w = w.map((v, j) => v - lr * g[j]);
  }
  return x => 1 / (1 + Math.exp(-x.reduce((z, v, j) => z + v * w[j], 0)));
}
// Leave one category out: train on the other four, predict the held-out one, so
// the router cannot win by recognizing which category a prompt came from.
const cats = [...new Set(tasks.map(t => t.category))];
const predicted = {}; // task -> arm -> { p, cost }
for (const held of cats) {
  const train = tasks.filter(t => t.category !== held), test = tasks.filter(t => t.category === held);
  for (const a of ARMS) {
    const X = [], y = [];
    for (const t of train) { const c = cell[t.id][a]; for (let k = 0; k < c.n; k++) { X.push(feats(t)); y.push(k < c.pass ? 1 : 0); } }
    const f = fitLogistic(X, y), armCost = mean(train.map(t => C(t, a)));
    for (const t of test) (predicted[t.id] ||= {})[a] = { p: f(feats(t)), cost: armCost };
  }
}
const lambdas = [0, 0.5, 1, 2, 4, 8, 16, 32, 64, 128, 256];
const learnedCurve = lambdas.map(l => ({ lambda: l, ...score(t => ARMS.reduce((b, a) => { const v = predicted[t.id][a].p - l * predicted[t.id][a].cost; return v > b.v ? { a, v } : b; }, { a: ARMS[0], v: -Infinity }).a) }));
const oracleCurve = lambdas.map(l => ({ lambda: l, ...score(t => ARMS.reduce((b, a) => { const v = S(t, a) - l * C(t, a); return v > b.v ? { a, v } : b; }, { a: ARMS[0], v: -Infinity }).a) }));
for (const p of learnedCurve) policies.push({ name: `Learned router · λ=${p.lambda}`, kind: 'learned', pass: p.pass, cost: p.cost, arms: p.arms, lambda: p.lambda });

// ---- random-router shuffle test ----------------------------------------------
// Keep a policy's mix of arms but deal them to tasks at random, 10,000 times.
// A policy beats random if its pass rate is above the 95th percentile.
function shuffleBand(arms, n = 10000) {
  const xs = [];
  for (let k = 0; k < n; k++) {
    const a = [...arms]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    xs.push(mean(tasks.map((t, i) => S(t, a[i]))));
  }
  xs.sort((x, y) => x - y);
  return { p50: xs[Math.floor(n * 0.5)], p95: xs[Math.floor(n * 0.95)] };
}
for (const p of policies) if (!['fixed', 'oracle'].includes(p.kind)) { const b = shuffleBand(p.arms); p.random_p50 = b.p50; p.random_p95 = b.p95; p.beats_random = p.pass > b.p95; }

// ---- too weak / too expensive for the shipped router ---------------------------
const TIER_ORDER = ['haiku', 'sonnet', 'opus', 'fable'];
const cheapestSufficient = t => { const ok = ARMS.filter(a => S(t, a) >= 0.5).sort((x, y) => C(t, x) - C(t, y)); return ok[0] || null; };
const diagnosis = tasks.map((t, i) => {
  const arm = shipped.arms[i], need = cheapestSufficient(t), passRate = S(t, arm);
  const verdict = !need ? 'nothing passes' : passRate < 0.5 ? 'too weak' : C(t, arm) > C(t, need) * 1.05 ? 'more than needed' : 'right';
  return { task: t.id, category: t.category, difficulty: t.difficulty, prompt: t.prompt, router: arm, choice: jev[t.id].answers.model_choice.choice, cheapest_passing: need, router_pass: passRate, verdict };
});
const counts = diagnosis.reduce((m, d) => (m[d.verdict] = (m[d.verdict] || 0) + 1, m), {});

// ---- per-category pass rates for each arm ---------------------------------------
const byCategory = Object.fromEntries(cats.map(c => [c, Object.fromEntries(ARMS.map(a => [a, mean(tasks.filter(t => t.category === c).map(t => S(t, a)))]))]));

// ---- pass rate by measured difficulty (v2: tasks carry a calibration bucket) ----
const BUCKETS = ['easy', 'medium', 'hard'];
const hasBuckets = tasks.every(t => t.bucket);
const byBucket = hasBuckets ? policies.filter(p => ['fixed', 'router', 'router-v2', 'router-v3', 'choice', 'oracle'].includes(p.kind) || (p.kind === 'learned' && p.lambda === 8)).map(p => ({
  name: p.name, kind: p.kind,
  ...Object.fromEntries(BUCKETS.map(b => { const idx = tasks.map((t, i) => t.bucket === b ? i : -1).filter(i => i >= 0); return [b, idx.length ? { pass: mean(idx.map(i => S(tasks[i], p.arms[i]))), cost: 1000 * mean(idx.map(i => C(tasks[i], p.arms[i]))), n: idx.length } : null]; }))
})) : null;

const summary = {
  generated: new Date().toISOString(), partial: process.argv.includes('--partial'), tasks: tasks.length, reps, arms: ARMS,
  tiers: Object.fromEntries(Object.entries(MODELS).map(([t, id]) => [t, { id, name: MODEL_NAMES[t] }])), arm_names: Object.fromEntries(ARMS.map(a => [a, armName(a)])),
  spent_usd: raw.reduce((s, r) => s + r.cost_usd, 0), budget_usd: BUDGET_USD,
  jev_model: Object.values(jev)[0]?.model ?? null,
  policies: policies.map(({ arms, ...p }) => p), learned_curve: learnedCurve.map(({ arms, ...p }) => p), oracle_curve: oracleCurve.map(({ arms, ...p }) => p),
  router_diagnosis: { counts, tasks: diagnosis }, by_category: byCategory, by_bucket: byBucket, router_v3: v3info, train_tasks: trainTasks.length,
  bucket_counts: hasBuckets ? Object.fromEntries(BUCKETS.map(b => [b, tasks.filter(t => t.bucket === b).length])) : null
};
writeFileSync(SUMMARY, JSON.stringify(summary, null, 2));
copyFileSync(SUMMARY, PAGE_COPY);

// ---- replay: every run, so the page can play the eval back prompt by prompt ----
// For each task: the prompt, what Jev judged, and every recorded run on every
// arm (pass, cost, a short excerpt of the answer). Policies list which arm each
// router picked per task, so the page can replay any of them.
const REPLAY = new URL(EVAL_SET === 'v2' ? '../../public/jev/eval-replay-v2.json' : '../../public/jev/eval-replay.json', import.meta.url);
const { finalAnswer } = await import('./graders.mjs');
const runsBy = {};
for (const r of raw) (runsBy[`${r.task}|${r.arm}`] ||= []).push(r);
const excerpt = (t, text = '') => {
  if (t.grader.type === 'answer') return finalAnswer(text) ?? '(no ANSWER line)';
  if (t.grader.type === 'python') return /```/.test(text) ? '(Python code)' : '(no code block)';
  return text.trim().replace(/\s+/g, ' ').slice(0, 110) || '(empty)';
};
const replayPolicies = policies.filter(p => ['router', 'choice', 'router-v2', 'router-v3'].includes(p.kind) || (p.kind === 'learned' && p.lambda === 8));
const replay = {
  generated: summary.generated, arm_names: summary.arm_names, tiers: summary.tiers,
  policies: replayPolicies.map(p => ({ name: p.name, kind: p.kind, arms: p.arms })),
  tasks: tasks.map(t => {
    const a = jev[t.id].answers, j = judge(a);
    return {
      id: t.id, category: t.category, bucket: t.bucket ?? null, prompt: t.prompt,
      answer: t.grader.answer ?? null,
      jev: { depth: j.depth, expertise: j.expertise, high_stakes: j.high_stakes, large_output: j.large_output, nuanced_writing: j.nuanced_writing, choice: a.model_choice.choice },
      runs: Object.fromEntries(ARMS.map(arm => [arm, (runsBy[`${t.id}|${arm}`] || []).sort((x, y) => x.rep - y.rep).map(r => [r.pass ? 1 : 0, +r.cost_usd.toFixed(6), excerpt(t, r.text)])]))
    };
  })
};
writeFileSync(REPLAY, JSON.stringify(replay));

const fmt = p => `${(p.pass * 100).toFixed(1).padStart(5)}%  $${p.cost.toFixed(2).padStart(7)}/1k${p.random_p95 != null ? `  random p95 ${(p.random_p95 * 100).toFixed(1)}% ${p.beats_random ? 'BEATS' : 'does not beat'}` : ''}`;
console.log(`${tasks.length} tasks, ${reps} repeat(s) each, spent $${summary.spent_usd.toFixed(2)} of $${BUDGET_USD}\n`);
for (const p of policies.filter(p => p.kind !== 'learned' && p.kind !== 'router-variant')) console.log(`${p.name.padEnd(34)} ${fmt(p)}`);
console.log('\nlearned router (leave-one-category-out):'); for (const p of learnedCurve) console.log(`  λ=${String(p.lambda).padEnd(4)} ${fmt(p)}`);
console.log('\nshipped router verdicts:', counts);
if (byBucket) { console.log('\npass rate by measured difficulty:'); for (const p of byBucket) console.log(`  ${p.name.padEnd(34)} ${BUCKETS.map(b => p[b] ? `${b} ${(p[b].pass * 100).toFixed(0)}%` : '').join('  ')}`); }
console.log(`\nwrote ${SUMMARY.pathname} and the page copy public/jev/eval-summary.json`);
