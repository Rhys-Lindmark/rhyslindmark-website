// Model Router policy: Jev's answers in, a Claude model and reasoning level out.
// Shared by the page (router.js) and the eval (evals/model-router), so the eval
// scores exactly the table the page ships. Edit the tables, not the questions.
// ---- Policy: everything a person would audit lives in this block ----------
export const YES = 0.7, NO = 0.3;            // Noul thresholds; the band between is "unsure"
export const UNSURE_COUNTS_AS = true;        // err toward more capability when Jev is unsure
export const DEPTH = ['none', 'few steps', 'plan', 'long'];
export const DEPTH_TEXT = ['None', 'A few steps', 'A multi-step plan', 'Long, careful reasoning'];
export const LEVELS = ['Off', 'Low', 'Medium', 'High'];
export const MODELS = { haiku: 'Claude Haiku', sonnet: 'Claude Sonnet', opus: 'Claude Opus', fable: 'Claude Fable' };
// Reasoning level: one row per (depth, high stakes). Every combination has an outcome.
export const REASONING_TABLE = [
  { depth: 0, stakes: false, level: 0 }, { depth: 0, stakes: true, level: 1 },
  { depth: 1, stakes: false, level: 1 }, { depth: 1, stakes: true, level: 2 },
  { depth: 2, stakes: false, level: 2 }, { depth: 2, stakes: true, level: 3 },
  { depth: 3, stakes: null,  level: 3 }
];
// Model level: ordered rules, first match wins. The last row always matches.
export const MODEL_RULES = [
  { when: 'Large piece of work', test: j => j.large_output, tier: 'fable' },
  { when: 'Depth is long', test: j => j.depth === 3, tier: 'fable' },
  { when: 'Expertise and depth is plan', test: j => j.expertise && j.depth >= 2, tier: 'opus' },
  { when: 'Expertise and high stakes', test: j => j.expertise && j.high_stakes, tier: 'opus' },
  { when: 'Expertise', test: j => j.expertise, tier: 'sonnet' },
  { when: 'Depth is plan', test: j => j.depth === 2, tier: 'sonnet' },
  { when: 'Nuanced writing', test: j => j.nuanced_writing, tier: 'sonnet' },
  { when: 'High stakes', test: j => j.high_stakes, tier: 'sonnet' },
  { when: 'Otherwise', test: () => true, tier: 'haiku' }
];
export const NOULS = {
  expertise: { label: 'Expertise', q: 'Does answering `prompt` well take specialist expertise?' },
  high_stakes: { label: 'High stakes', q: 'Could a wrong answer to `prompt` cause real harm or cost?' },
  large_output: { label: 'Large piece of work', q: 'Does `prompt` ask for a large piece of work?' },
  nuanced_writing: { label: 'Nuanced writing', q: 'Does `prompt` ask for writing where tone and style matter?' }
};
// ---- Reading Jev's answers --------------------------------------------------
export const read = (p, o = {}) => p >= (o.yes ?? YES) ? 'yes' : p <= (o.no ?? NO) ? 'no' : 'unsure';
const truthy = (p, o = {}) => { const r = read(p, o); return r === 'yes' || (r === 'unsure' && (o.unsureCountsAs ?? UNSURE_COUNTS_AS)); };
// The Score's `score` is a weighted mean and can sit between two peaks, so code
// reads the most likely level instead (ties go to the higher level).
const topLevel = probs => DEPTH.reduce((best, _, i) => probs[i] >= probs[best] ? i : best, 0);
export function judge(answers, o = {}) {
  const j = { depth: topLevel(DEPTH.map((_, i) => answers.reasoning_depth.probabilities[String(i)])) };
  for (const id of Object.keys(NOULS)) j[id] = truthy(answers[id].noul, o);
  return j;
}
export function decide(j) {
  const reasoningRow = REASONING_TABLE.findIndex(r => r.depth === j.depth && (r.stakes === null || r.stakes === j.high_stakes));
  const ruleRow = MODEL_RULES.findIndex(r => r.test(j));
  return { reasoningRow, reasoning: REASONING_TABLE[reasoningRow].level, ruleRow, tier: MODEL_RULES[ruleRow].tier };
}

