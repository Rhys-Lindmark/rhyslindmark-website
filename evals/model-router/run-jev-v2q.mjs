// Asks Jev the Router v2 questions for every prompt in the v1 set and the v2
// pool (the pool contains v1's prompts too). Saves results/jev-v2q.json.
//   with-secrets --key TYPESAFE_KEY_JEV_EVAL -- node run-jev-v2q.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { POOL } from './tasks-v2.mjs';
import { routerV2Questions, V2_NOULS } from './router-v2-questions.mjs';
import { MODEL } from '../../functions/_lib/jev-access.js';

const OUT = new URL('./results/jev-v2q.json', import.meta.url);
const key = process.env.TYPESAFE_KEY_JEV_EVAL;
if (!key) { console.error('TYPESAFE_KEY_JEV_EVAL is not set. See README.'); process.exit(1); }
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
const probability = v => typeof v === 'number' && v >= 0 && v <= 1;
const todo = POOL.filter(t => !out[t.id]);
let i = 0;
async function worker() {
  while (i < todo.length) {
    const t = todo[i++];
    const r = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: MODEL, state: { prompt: t.prompt }, questions: routerV2Questions() }) });
    if (!r.ok) { console.error(`${t.id}: HTTP ${r.status}`); continue; }
    const a = (await r.json()).answers;
    if (!V2_NOULS.every(q => probability(a?.[q]?.noul))) { console.error(`${t.id}: unexpected answer`); continue; }
    out[t.id] = Object.fromEntries(V2_NOULS.map(q => [q, a[q].noul]));
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`answered ${Object.keys(out).length} of ${POOL.length}`);
for (const id of ['facts-01', 'write-10', 'logic-10', 'code-09', 'letters-20', 'multiply-20']) if (out[id]) console.log(id.padEnd(12), JSON.stringify(out[id]));
