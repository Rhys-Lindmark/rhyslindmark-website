// Router v2 and Router v3, built from Eval 1's lessons and fit only on the
// 60 training prompts (v1's set). Eval 2 then scores them on prompts they
// never saw.
//
// Router v2: still "Jev judges, code decides", with four new judgments
// (router-v2-questions.mjs) and a new truth table. Eval 1 showed that failures
// come from exact, letter-level work and from long step-by-step procedures, not
// from "expertise" or "stakes", so the table spends effort there and saves it
// everywhere else.
//
// Router v3: the same Jev judgments (old and new) become inputs to a small
// model per arm that estimates the chance that arm passes. The router picks the
// arm with the best (chance of passing − λ × cost). λ is chosen on the training
// prompts only.

const yes = p => p >= 0.5;

// Tiers named as in the shipped router: haiku (cheapest) .. fable (strongest).
// TABLE is filled in from the training prompts' results (see analyze.mjs); the
// rows are the decision, in order, first match wins.
export const ROUTER_V2_TABLE = [
  { when: 'Exact letters/digits and a long procedure', test: j => j.exact_details && j.long_procedure, arm: 'opus:high' },
  { when: 'Exact letters, words or digits', test: j => j.exact_details, arm: 'sonnet:high' },
  { when: 'Long step-by-step procedure', test: j => j.long_procedure, arm: 'sonnet:high' },
  { when: 'Large piece of work', test: j => j.large_output, arm: 'opus:low' },
  { when: 'Writes code', test: j => j.writes_code, arm: 'sonnet:low' },
  { when: 'Quick recall', test: j => j.quick_recall, arm: 'haiku:low' },
  { when: 'Otherwise', test: () => true, arm: 'sonnet:low' }
];

export function judgeV2(old, extra) {
  return {
    exact_details: yes(extra.exact_details), quick_recall: yes(extra.quick_recall), writes_code: yes(extra.writes_code), long_procedure: yes(extra.long_procedure),
    large_output: yes(old.large_output.noul)
  };
}
export const routerV2 = (old, extra, table = ROUTER_V2_TABLE) => { const j = judgeV2(old, extra); return table.find(r => r.test(j)).arm; };

// ---- Router v3 ---------------------------------------------------------------
export const features = (old, extra) => [1,
  ...[0, 1, 2, 3].map(i => old.reasoning_depth.probabilities[String(i)]),
  ...['expertise', 'high_stakes', 'large_output', 'nuanced_writing'].map(k => old[k].noul),
  ...['exact_details', 'quick_recall', 'writes_code', 'long_procedure'].map(k => extra[k])];

export function fitLogistic(X, y, l2 = 1, steps = 3000, lr = 0.5) {
  let w = Array(X[0].length).fill(0);
  for (let s = 0; s < steps; s++) {
    const g = w.map((_, j) => j ? l2 * w[j] / X.length : 0);
    X.forEach((x, i) => { const p = 1 / (1 + Math.exp(-x.reduce((z, v, j) => z + v * w[j], 0))); x.forEach((v, j) => g[j] += (p - y[i]) * v / X.length); });
    w = w.map((v, j) => v - lr * g[j]);
  }
  return x => 1 / (1 + Math.exp(-x.reduce((z, v, j) => z + v * w[j], 0)));
}

// train: [{ x, runs: { arm: [pass...] }, cost: { arm: meanCost } }]
export function trainRouterV3(train, arms) {
  const models = {}, armCost = {};
  for (const a of arms) {
    const X = [], y = [];
    for (const t of train) for (const p of t.runs[a] || []) { X.push(t.x); y.push(p); }
    models[a] = fitLogistic(X, y);
    armCost[a] = train.reduce((s, t) => s + (t.cost[a] ?? 0), 0) / train.length;
  }
  const pick = (x, lambda) => arms.reduce((b, a) => { const v = models[a](x) - lambda * armCost[a]; return v > b.v ? { a, v } : b; }, { a: arms[0], v: -Infinity }).a;
  return { pick, models, armCost };
}

// Choose λ on the training prompts with leave-one-out predictions (so the
// choice isn't fit to prompts the model already saw): the cheapest λ whose
// pass rate is within 1 point of the best λ's.
export function chooseLambda(train, arms, lambdas) {
  const scored = lambdas.map(lambda => {
    let pass = 0, cost = 0;
    train.forEach((t, i) => {
      const r = trainRouterV3(train.filter((_, k) => k !== i), arms), a = r.pick(t.x, lambda);
      const runs = t.runs[a] || [];
      pass += runs.length ? runs.reduce((s, v) => s + v, 0) / runs.length : 0; cost += t.cost[a] ?? 0;
    });
    return { lambda, pass: pass / train.length, cost: cost / train.length };
  });
  const best = Math.max(...scored.map(s => s.pass));
  const ok = scored.filter(s => s.pass >= best - 0.01).sort((a, b) => a.cost - b.cost);
  return { lambda: ok[0].lambda, scored };
}
