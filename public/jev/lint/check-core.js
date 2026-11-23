// check-core: score a Jev integration on your own labeled examples, and fit the numbers in
// its code. An integration is a set of Jev questions plus a decide(answers, state) function
// that turns Jev's answers into an action. Given Jev's answers for each example (fetched once),
// everything here is plain computation: decide() is rerun in memory for every value tried.
//
// Pure, no dependencies. The CLI (check.mjs) uses it in node, and jev-lint's "Check on your
// examples" uses a copy in the browser (rhyslindmark-website public/jev/lint/check-core.js).
// Keep the two files identical.

// Values tried for each number between 0 and 1 in decide(), plus the number's current value.
export const GRID = Array.from({ length: 19 }, (_, i) => +(0.05 * (i + 1)).toFixed(2));
// Suggest a new value only when its leave-one-out estimate beats the current score by at
// least this much. Set before the validation run (validate.mjs), not tuned on it.
export const MIN_GAIN = 0.05;
export const FEW = 8; // fewer examples than this for an action, and its share is noisy

const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const clone = v => JSON.parse(JSON.stringify(v ?? null));

// The numbers between 0 and 1 in the code: the cuts a decide() compares probabilities against.
export function literals(code) {
  const lines = code.split('\n'), out = [];
  for (const m of code.matchAll(/(?<![\w.$])0?\.\d+(?![\w.])/g)) {
    const value = parseFloat(m[0]);
    if (!(value > 0 && value < 1)) continue;
    const line = code.slice(0, m.index).split('\n').length;
    out.push({ i: out.length, start: m.index, end: m.index + m[0].length, text: m[0], value, line, context: lines[line - 1].trim() });
  }
  return out;
}
export const withValue = (code, lit, value) => code.slice(0, lit.start) + String(value) + code.slice(lit.end);

// decide() from source. Accepts `function decide`, `const decide = …`, with or without export.
export function compileDecide(code) {
  const body = code.replace(/^\s*export\s+(default\s+)?/gm, '').replace(/module\.exports[^\n]*/g, '');
  const f = new Function(`${body}\n;return typeof decide === 'function' ? decide : null;`)();
  if (!f) throw new Error('No decide(answers, state) function found.');
  return f;
}

export function decisions(decide, examples, answers) {
  return examples.map((ex, i) => {
    if (!answers[i]) return { action: null, error: 'Jev gave no answer for this example' };
    try {
      const a = decide(clone(answers[i]), clone(ex.state));
      return typeof a === 'string' ? { action: a } : { action: null, error: `decide() returned ${JSON.stringify(a)}, not an action name` };
    } catch (e) { return { action: null, error: String(e?.message || e).slice(0, 200) }; }
  });
}

// Balanced accuracy: for each wanted action, the share of its examples routed to it; then the
// mean over actions. Always picking one action scores 1 / (number of actions).
export function score(wants, acts, actions) {
  const per = actions.map(a => { const idx = wants.flatMap((w, i) => w === a ? [i] : []); return idx.length ? idx.filter(i => acts[i] === a).length / idx.length : null; }).filter(x => x != null);
  return per.length ? mean(per) : 0;
}

// Try every value for one number, then estimate by leave-one-out what fitting it is worth on
// examples you haven't labeled: for each example, fit the value on the others and decide that
// one with it. Ties go to the value nearest the current one.
function sweep(code, lit, examples, answers, actions, compile) {
  const grid = [...new Set([...GRID, lit.value])].sort((a, b) => a - b), here = grid.indexOf(lit.value);
  const wants = examples.map(e => e.want);
  const rows = grid.map(v => { try { return decisions(compile(withValue(code, lit, v)), examples, answers).map(d => d.action); } catch { return examples.map(() => null); } });
  const pick = scores => grid.reduce((b, v, k) => scores[k] > scores[b] + 1e-9 || (Math.abs(scores[k] - scores[b]) < 1e-9 && Math.abs(v - lit.value) < Math.abs(grid[b] - lit.value)) ? k : b, here);
  const curve = rows.map(r => score(wants, r, actions));
  const best = pick(curve);
  const top = grid.filter((_, k) => Math.abs(curve[k] - curve[best]) < 1e-9);
  const loo = wants.map((_, i) => {
    const rest = j => j !== i;
    return rows[pick(rows.map(r => score(wants.filter((_, j) => rest(j)), r.filter((_, j) => rest(j)), actions)))][i];
  });
  return { ...lit, curve: grid.map((value, k) => ({ value, score: curve[k] })), now: curve[here], best: { value: grid[best], score: curve[best], range: [Math.min(...top), Math.max(...top)] }, loo: score(wants, loo, actions) };
}

// The whole report. examples: [{ state, want }]; answers: Jev's answers, one per example.
export function check({ code, examples, answers, compile = compileDecide }) {
  const decide = compile(code);
  const actions = [...new Set(examples.map(e => e.want))];
  const wants = examples.map(e => e.want);
  const ds = decisions(decide, examples, answers), acts = ds.map(d => d.action);
  const now = score(wants, acts, actions);
  const per = actions.map(a => {
    const idx = wants.flatMap((w, i) => w === a ? [i] : []);
    const got = {}; for (const i of idx) { const k = acts[i] ?? 'error'; got[k] = (got[k] || 0) + 1; }
    return { action: a, n: idx.length, right: got[a] || 0, got };
  });
  const nums = actions.length > 1 ? literals(code).map(l => sweep(code, l, examples, answers, actions, compile)) : [];
  const top = nums.reduce((b, l) => !b || l.loo > b.loo + 1e-9 ? l : b, null);
  const suggest = top && top.best.value !== top.value && top.loo >= now + MIN_GAIN - 1e-9
    ? { line: top.line, context: top.context, from: top.value, to: top.best.value, range: top.best.range, fitted: top.best.score, expected: top.loo, now, code: withValue(code, top, top.best.value) } : null;
  const misses = ds.map((d, i) => ({ i, want: wants[i], got: d.action, error: d.error })).filter(m => m.got !== m.want);
  const notes = [];
  if (actions.length < 2) notes.push('Every example wants the same action, so there is nothing to compare. Add examples for the other actions.');
  for (const p of per) if (p.n < FEW) notes.push(`Only ${p.n} example${p.n === 1 ? '' : 's'} want ${p.action}, so its share moves ${Math.round(100 / Math.max(p.n, 1))} points per example.`);
  const stray = [...new Set(acts.filter(a => a != null && !actions.includes(a)))];
  if (stray.length) notes.push(`decide() returned ${stray.map(a => `"${a}"`).join(', ')}, which no example wants. Every such decision counts as wrong.`);
  const errors = ds.filter(d => d.error).length;
  if (errors) notes.push(`${errors} example${errors === 1 ? '' : 's'} failed: ${ds.find(d => d.error).error}`);
  return { n: examples.length, actions, score: now, chance: 1 / Math.max(actions.length, 1), per, numbers: nums, suggest, misses, errors, notes };
}

// Examples as pasted: JSON lines or a JSON array of { state, want } (record and label work too).
export function parseExamples(text) {
  const t = text.trim();
  if (!t) return [];
  let items;
  if (t.startsWith('[')) items = JSON.parse(t);
  else items = t.split('\n').map(l => l.trim()).filter(Boolean).map((l, k) => { try { return JSON.parse(l); } catch { throw new Error(`Example ${k + 1} is not valid JSON.`); } });
  return items.map((x, k) => {
    const state = x?.state ?? x?.record, want = x?.want ?? x?.label ?? x?.action;
    if (!state || typeof state !== 'object' || Array.isArray(state)) throw new Error(`Example ${k + 1} needs a "state" object.`);
    if (typeof want !== 'string' || !want) throw new Error(`Example ${k + 1} needs a "want": the action it should get.`);
    return { state, want };
  });
}
