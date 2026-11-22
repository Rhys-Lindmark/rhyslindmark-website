// Runs a Flash and a Frontier LLM over the same 700 human-labeled examples the
// Threshold Explorer shows for Jev, so the page can draw a four-level ladder:
// Jev -> Flash -> Frontier -> a person.
//
//   node --env-file=../.env run.mjs          # run (resumes from results.jsonl)
//   node --env-file=../.env run.mjs build    # write public/jev/threshold/ladder.js
//
// Each model gets the same question Jev got and the full label list, and
// replies with its answer and a self-reported confidence (LLMs give no
// calibrated probability of their own). Reads OPENROUTER_KEY_JEV_EVAL.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { DATA } from '../../public/jev/threshold/data.js';

const HERE = new URL('.', import.meta.url).pathname;
const RAW = HERE + 'results.jsonl', OUT = HERE + '../../public/jev/threshold/ladder.js';
const TIERS = {
  flash: { id: 'qwen/qwen3.7-flash', name: 'Qwen 3.7 Flash', price: { in: 0.03, out: 0.13 } },
  frontier: { id: 'qwen/qwen3.7-max', name: 'Qwen 3.7 Max', price: { in: 1.475, out: 4.425 } }
};
const BUDGET = 10, CONCURRENCY = 16;
const LABELS = [...new Set(DATA.banking77.rows.flatMap(r => [r[1], r[2]]))].sort();

function prompt(ds, row) {
  if (ds === 'banking77') return `A bank customer wrote this message:\n\n"${row[3]}"\n\nWhat does the bank customer want help with? Pick exactly one intent from this list:\n${LABELS.join('\n')}\n\nReply with JSON only, no other text: {"answer": "<one intent from the list, exactly as written>", "confidence": <your probability, 0 to 1, that this intent is the correct one>}`;
  return `Here is a tweet:\n\n"${row[2]}"\n\nIs this tweet ironic?\n\nReply with JSON only, no other text: {"answer": <true or false>, "confidence": <your probability, 0.5 to 1, that your answer is correct>}`;
}
function parse(ds, text) {
  const m = text.match(/\{[\s\S]*\}/); if (!m) return null;
  try {
    const j = JSON.parse(m[0]); let conf = Math.max(0, Math.min(1, Number(j.confidence)));
    if (!Number.isFinite(conf)) return null;
    if (ds === 'banking77') return LABELS.includes(j.answer) ? { answer: j.answer, conf } : { answer: String(j.answer), conf };
    const a = j.answer === true || j.answer === 'true'; return { answer: a, conf: Math.max(conf, 0.5) };
  } catch { return null; }
}

const done = () => existsSync(RAW) ? readFileSync(RAW, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
const spent = () => done().reduce((s, r) => s + r.cost_usd, 0);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function call(job) {
  const t = TIERS[job.tier];
  const body = { model: t.id, max_tokens: 1500, messages: [{ role: 'user', content: prompt(job.ds, DATA[job.ds].rows[job.i]) }], reasoning: { effort: 'low' }, usage: { include: true }, provider: { require_parameters: true } };
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.OPENROUTER_KEY_JEV_EVAL}`, 'Content-Type': 'application/json', 'X-Title': 'threshold-ladder' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(120000)
    }).catch(e => ({ ok: false, status: 0, text: async () => String(e) }));
    if (r.ok) {
      const data = await r.json(); if (data.error) throw new Error(JSON.stringify(data.error).slice(0, 200));
      const text = data.choices?.[0]?.message?.content ?? '', u = data.usage ?? {};
      const cost = u.cost ?? ((u.prompt_tokens || 0) * t.price.in + (u.completion_tokens || 0) * t.price.out) / 1e6;
      return { ...job, parsed: parse(job.ds, text), text: text.slice(0, 400), cost_usd: cost };
    }
    const msg = (await r.text()).slice(0, 200);
    if ([400, 401, 402].includes(r.status)) throw new Error(`HTTP ${r.status} ${msg}`);
    await sleep(2000 * 2 ** attempt);
  }
  throw new Error('gave up after retries');
}

async function run() {
  if (!process.env.OPENROUTER_KEY_JEV_EVAL) { console.error('OPENROUTER_KEY_JEV_EVAL is not set (evals/.env)'); process.exit(1); }
  const have = new Set(done().filter(r => r.parsed).map(r => `${r.tier}|${r.ds}|${r.i}`));
  const jobs = Object.keys(TIERS).flatMap(tier => Object.keys(DATA).flatMap(ds => DATA[ds].rows.map((_, i) => ({ tier, ds, i })))).filter(j => !have.has(`${j.tier}|${j.ds}|${j.i}`));
  console.log(`${jobs.length} requests to go; spent so far $${spent().toFixed(3)} of $${BUDGET}`);
  let next = 0, n = 0, total = spent();
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < jobs.length && total < BUDGET) {
      const job = jobs[next++];
      try { const r = await call(job); appendFileSync(RAW, JSON.stringify(r) + '\n'); total += r.cost_usd; if (!r.parsed) console.log(`  unparsed ${job.tier} ${job.ds} ${job.i}: ${r.text.slice(0, 80)}`); }
      catch (e) { console.log(`  ${job.tier} ${job.ds} ${job.i}: ${e.message}`); if (/HTTP 40[12]/.test(e.message)) next = jobs.length; }
      if (++n % 100 === 0) console.log(`  ${n}/${jobs.length} · $${total.toFixed(3)}`);
    }
  }));
  console.log(`done; spent $${total.toFixed(3)}`);
}

function build() {
  const rows = done(), out = {};
  for (const ds of Object.keys(DATA)) {
    out[ds] = {};
    for (const tier of Object.keys(TIERS)) {
      const mine = rows.filter(r => r.ds === ds && r.tier === tier && r.parsed);
      const byI = new Map(mine.map(r => [r.i, r])), cost = mine.reduce((s, r) => s + r.cost_usd, 0);
      const answers = DATA[ds].rows.map((_, i) => { const r = byI.get(i); return r ? [r.parsed.answer, +r.parsed.conf.toFixed(2)] : null; });
      out[ds][tier] = { model: TIERS[tier].name, cost_usd: +cost.toFixed(5), n: mine.length, answers };
      const truth = i => ds === 'banking77' ? DATA[ds].rows[i][2] : DATA[ds].rows[i][1];
      const acc = answers.filter((a, i) => a && a[0] === truth(i)).length / answers.length;
      console.log(`${ds} ${tier}: ${mine.length}/${answers.length} answered, accuracy ${(100 * acc).toFixed(1)}%, $${cost.toFixed(4)}`);
    }
  }
  writeFileSync(OUT, `// Flash and Frontier LLM answers on the same examples as data.js, from evals/threshold-ladder/run.mjs.\n// answers[i] = [answer, self-reported confidence] for data.js row i (null if the model gave no usable reply).\nexport const LADDER = ${JSON.stringify(out)};\n`);
  console.log(`wrote ${OUT}`);
}

process.argv[2] === 'build' ? build() : run();
