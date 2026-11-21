// Asks Jev the exact questions the /jev page asks (imported from the API
// handler), once per task, on the bare prompt a user would type.
//   node --env-file-if-exists=.env run-jev.mjs
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { TASKS } from './tasks.mjs';
import { routerQuestions, antiQuestions, routerAnswers } from '../../functions/api/jev.js';
import { MODEL } from '../../functions/_lib/jev-access.js';

const OUT = new URL('./results/jev.json', import.meta.url);
mkdirSync(new URL('./results/', import.meta.url), { recursive: true });
const key = process.env.TYPESAFE_API_KEY;
if (!key) { console.error('Set TYPESAFE_API_KEY in evals/model-router/.env'); process.exit(1); }

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
