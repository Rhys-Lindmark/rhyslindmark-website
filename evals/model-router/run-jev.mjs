// Asks Jev the exact questions the /jev page asks (imported from the API
// handler), once per task, on the bare prompt a user would type.
//   node run-jev.mjs        (reads TYPESAFE_KEY_JEV_EVAL from evals/.env)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { TASKS, RESULTS } from './eval-set.mjs';
import { routerQuestions, antiQuestions, routerAnswers } from '../../functions/api/jev.js';
import { MODEL } from '../../functions/_lib/jev-access.js';

const OUT = new URL('jev.json', RESULTS);
mkdirSync(RESULTS, { recursive: true });
try { process.loadEnvFile(new URL('../.env', import.meta.url)); } catch {}
const key = process.env.TYPESAFE_KEY_JEV_EVAL;
if (!key) { console.error('TYPESAFE_KEY_JEV_EVAL is not set (add it to evals/.env). See README.'); process.exit(1); }

const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
for (const t of TASKS) {
  if (out[t.id]) continue;
  const body = { model: MODEL, state: { prompt: t.prompt }, questions: { ...routerQuestions(), ...antiQuestions() } };
  const r = await fetch('https://api.typesafe.ai/v1/systemone', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) { console.error(`${t.id}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`); process.exit(1); }
  const data = await r.json();
  const answers = routerAnswers(data.answers);
  if (!answers) { console.error(`${t.id}: unexpected answer shape`, JSON.stringify(data).slice(0, 300)); process.exit(1); }
  out[t.id] = { model: data.model, answers, usage: data.usage ?? null };
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`${t.id}: depth ${answers.reasoning_depth.score.toFixed(2)}, choice ${answers.model_choice.choice}`);
}
console.log(`Jev answered ${Object.keys(out).length} of ${TASKS.length} tasks.`);
