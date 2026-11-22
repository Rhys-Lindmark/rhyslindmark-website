// Question Linter (/jev/lint): Jev reviews a Jev question. Four judgments about the
// question's wording; the page flags any at 0.7 or above and adds code-only checks.
// Same questions as jev-lint in the jev repo (takehome/demos/a1-wrong-question/lint-rules.mjs).
export const LINT_IDS = ['decision', 'compound', 'hidden_rules', 'needs_math'];
export function lintQuestions() {
  return {
    decision: { type: 'noul', instructions: 'Does `question` ask what someone should do, rather than what is true?', criteria: {
      true: 'It asks for an action or a decision: should we escalate, which model should I use, what should the agent do next, should this be approved.',
      false: 'It asks about something a person can observe in the input: does the message mention a refund, is the user frustrated, which product is named.',
    } },
    compound: { type: 'noul', instructions: 'Does `question` ask about two or more separate conditions at once?', criteria: {
      true: 'It joins different conditions, for example "Is the user rude or drunk?" or "Is this spam and from a new account?".',
      false: 'It asks about one condition, even if the wording is long. A Choice that names its options, for example "Is this a billing issue, a bug, or something else?", is one question: picking one option is what a Choice is for.',
    } },
    hidden_rules: { type: 'noul', instructions: 'Does answering `question` depend on business rules or preferences that are not written in it?', criteria: {
      true: 'Two reasonable people would answer differently until they knew the company\'s policy: is this high priority, is this a good lead, should this be flagged.',
      false: 'Anyone reading the input would agree on the answer without knowing the company\'s rules.',
    } },
    needs_math: { type: 'noul', instructions: 'Does answering `question` require arithmetic, counting, or comparing dates or numbers?', criteria: {
      true: 'The answer depends on adding, counting items, or checking whether a number or date is above some limit.',
      false: 'The answer comes from reading and understanding, not from calculation.',
    } },
  };
}

const TYPES = ['noul', 'choice', 'score'];
const MAX_INSTRUCTIONS = 1000, MAX_OPTIONS = 16, MAX_NAME = 60, MAX_DESC = 400;

// The question to lint, normalized, or null when it isn't a plausible Jev question.
// It is only ever sent as quoted state, never as a question to Jev.
export function lintInput(q) {
  if (!q || typeof q !== 'object' || !TYPES.includes(q.type)) return null;
  if (typeof q.instructions !== 'string' || !q.instructions.trim() || q.instructions.length > MAX_INSTRUCTIONS) return null;
  const out = { type: q.type, instructions: q.instructions.trim() };
  if (Array.isArray(q.criteria)) {
    // A Score's levels, lowest first.
    if (q.type !== 'score' || q.criteria.length > MAX_OPTIONS || !q.criteria.every(v => typeof v === 'string' && v.length <= MAX_DESC)) return null;
    if (q.criteria.length) out.criteria = [...q.criteria];
  } else if (q.criteria !== undefined && q.criteria !== null) {
    if (typeof q.criteria !== 'object') return null;
    const entries = Object.entries(q.criteria);
    if (entries.length > MAX_OPTIONS) return null;
    for (const [k, v] of entries) {
      if (!k || k.length > MAX_NAME) return null;
      if (!(v === null || (typeof v === 'string' && v.length <= MAX_DESC))) return null;
    }
    if (entries.length) out.criteria = Object.fromEntries(entries);
  }
  return out;
}

const probability = v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;
// { decision: p, compound: p, hidden_rules: p, needs_math: p }, or null.
export function lintAnswers(answers) {
  if (!LINT_IDS.every(id => probability(answers?.[id]?.noul))) return null;
  return Object.fromEntries(LINT_IDS.map(id => [id, answers[id].noul]));
}
