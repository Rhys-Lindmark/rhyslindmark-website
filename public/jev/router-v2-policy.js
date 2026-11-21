// Router v2 policy: built from the eval on /jev. Shared by the page (router-v2.js)
// and the eval (evals/model-router), so the page shows exactly the table that
// was tested. Jev judges; this code decides.
//
// Rows were set from the 60 training prompts only (never the test prompts),
// in order, first match wins. What the eval showed:
// - Failures came from exact, letter-level work and long step-by-step procedures,
//   not from "expertise" or "stakes".
// - "Exact details" fires on most prompts, so depth splits it: with quick recall
//   or no reasoning, the cheapest tier at high effort passed 100%; otherwise the
//   middle tier at high effort passed 96-100% where the cheapest got 88%.
// - Exact details plus a long procedure: the middle tier at high effort matched
//   the top tier at a third of the cost.
// - Code: the cheapest tier at high effort passed 100% for a third of the cost.
// No row needs the Fable tier.
export const ROUTER_V2_TABLE = [
  { when: 'Exact details and a long procedure', test: j => j.exact_details && j.long_procedure, arm: 'sonnet:high' },
  { when: 'Exact details, quick recall or no reasoning', test: j => j.exact_details && (j.quick_recall || j.depth === 0), arm: 'haiku:high' },
  { when: 'Exact letters, words or digits', test: j => j.exact_details, arm: 'sonnet:high' },
  { when: 'Long step-by-step procedure', test: j => j.long_procedure, arm: 'sonnet:high' },
  { when: 'Large piece of work', test: j => j.large_output, arm: 'opus:low' },
  { when: 'Writes code', test: j => j.writes_code, arm: 'haiku:high' },
  { when: 'Quick recall', test: j => j.quick_recall, arm: 'haiku:low' },
  { when: 'Otherwise', test: () => true, arm: 'sonnet:low' }
];
export const V2_JUDGMENTS = {
  exact_details: 'Exact letters, words or digits',
  quick_recall: 'Quick recall',
  writes_code: 'Writes code',
  long_procedure: 'Long step-by-step procedure',
  large_output: 'Large piece of work'
};

const yes = p => (typeof p === 'number' ? p : p?.noul) >= 0.5;
// Most likely reasoning-depth level, as Router v1 reads it.
const depthOf = old => [0, 1, 2, 3].reduce((b, i) => old.reasoning_depth.probabilities[String(i)] >= old.reasoning_depth.probabilities[String(b)] ? i : b, 0);
// `old` holds the original answers; `extra` holds Router v2's four judgments,
// either as numbers or as Noul answers ({ noul }). On the page both come from one call.
export function judgeV2(old, extra = old) {
  return {
    exact_details: yes(extra.exact_details), quick_recall: yes(extra.quick_recall), writes_code: yes(extra.writes_code), long_procedure: yes(extra.long_procedure),
    large_output: yes(old.large_output), depth: depthOf(old)
  };
}
export function decideV2(j, table = ROUTER_V2_TABLE) { const row = table.findIndex(r => r.test(j)); return { row, arm: table[row].arm }; }
export const routerV2 = (old, extra, table = ROUTER_V2_TABLE) => decideV2(judgeV2(old, extra), table).arm;
