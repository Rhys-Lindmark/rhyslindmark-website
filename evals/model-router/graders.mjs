// Graders: (task, reply text) -> { pass, detail }. All mechanical.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const norm = s => String(s).trim().toLowerCase()
  .replace(/^[`*"'“”‘’\s]+|[`*"'“”‘’.\s]+$/g, '')
  .replace(/^the\s+/, '');
// A number, optionally with $ in front and units after ("299,792,458 m/s",
// "206 bones", "22.2°C"). Anything else with digits in it ("300 or 331") is not a number.
const asNumber = s => { const m = String(s).trim().match(/^\$?\s*(-?\d[\d,]*(?:\.\d+)?)\s*[a-z°%/.\s]*$/i); return m ? Number(m[1].replace(/,/g, '')) : null; };
// Drop a trailing note in parentheses: "Tungsten (W)" -> "Tungsten".
const stripNote = s => String(s).replace(/\s*\([^)]*\)\s*\.?$/, '');

export function finalAnswer(text) {
  const lines = String(text).trim().split('\n').map(l => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].replace(/\*\*/g, '').match(/^ANSWER\s*:\s*(.+)$/i);
    if (m) return m[1].trim();
  }
  return null;
}

function gradeAnswer(g, text) {
  const got = finalAnswer(text);
  if (got == null) return { pass: false, detail: 'no ANSWER line' };
  if (g.list) {
    const set = x => norm(x).split(/\s*(?:,|\band\b)\s*/).map(norm).filter(Boolean).sort().join(',');
    return { pass: set(got) === set(g.answer), detail: got };
  }
  const want = [g.answer, ...(g.alts || [])];
  const gn = asNumber(got);
  for (const w of want) {
    const wn = asNumber(w);
    if (wn != null && gn != null && Math.abs(gn - wn) < 1e-9) return { pass: true, detail: got };
    if (norm(got) === norm(w) || norm(stripNote(got)) === norm(w)) return { pass: true, detail: got };
  }
  return { pass: false, detail: got };
}

export function extractPython(text) {
  const blocks = [...String(text).matchAll(/```(?:python|py)?\s*\n([\s\S]*?)```/g)].map(m => m[1]);
  // All blocks, in order: replies often put the function in one block and usage
  // examples in another, and the examples need the function defined first.
  return blocks.length ? blocks.join('\n\n') : null;
}

// Model-written code runs in a throwaway directory, isolated mode (-I), with a
// timeout and no network expectations. It is still untrusted: run this eval on
// a machine you are comfortable executing generated code on.
function gradePython(g, text) {
  const src = extractPython(text);
  if (!src) return { pass: false, detail: 'no python block' };
  const dir = mkdtempSync(join(tmpdir(), 'router-eval-'));
  try {
    const tests = g.tests.map((t, i) => `try:\n${t.split('\n').map(l => '    ' + l).join('\n')}\nexcept Exception as e:\n    print("FAIL", ${i}, type(e).__name__, e)\n    raise SystemExit(1)`).join('\n');
    writeFileSync(join(dir, 'solution.py'), `${src}\n\n${tests}\nprint("OK")\n`);
    const r = spawnSync('python3', ['-I', 'solution.py'], { cwd: dir, timeout: 10000, encoding: 'utf8', env: { PATH: process.env.PATH } });
    const out = (r.stdout || '') + (r.stderr || '');
    return { pass: r.status === 0 && /\bOK\b/.test(r.stdout || ''), detail: out.trim().split('\n').slice(-2).join(' | ').slice(0, 200) || (r.error ? String(r.error) : '') };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const words = s => s.match(/[A-Za-z’']+/g) || [];
const plainWords = s => (s.match(/[A-Za-z]+(?:['’][A-Za-z]+)*/g) || []);
const textLines = s => s.split('\n').map(l => l.trim()).filter(Boolean);
const sentences = s => s.split(/(?<=[.!?])\s+/).map(x => x.trim()).filter(Boolean);
const firstLetter = l => (l.replace(/^[^A-Za-z]+/, '')[0] || '').toUpperCase();

function gradeWriting(c, raw) {
  const text = String(raw).trim();
  switch (c.kind) {
    case 'wordCount': { const n = plainWords(text).length; return { pass: n === c.n && sentences(text).length === 1, detail: `${n} words` }; }
    case 'sortedLines': {
      const ls = textLines(text).map(l => l.replace(/^[-*\d.)\s]+/, ''));
      const sorted = [...ls].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
      return { pass: ls.length === c.n && ls.every((l, i) => l === sorted[i]), detail: ls.join(' / ') };
    }
    case 'linesEndWith': {
      const ls = textLines(text); const ok = ls.length === c.n && ls.every(l => (plainWords(l).pop() || '').toLowerCase() === c.word);
      return { pass: ok, detail: `${ls.length} lines` };
    }
    case 'acrostic': {
      const ls = textLines(text); const letters = ls.map(firstLetter).join('');
      const per = c.wordsPerLine ? ls.every(l => plainWords(l).length === c.wordsPerLine) : true;
      return { pass: letters === c.word && per, detail: `${letters}${c.wordsPerLine ? ' / ' + ls.map(l => plainWords(l).length).join(',') : ''}` };
    }
    case 'allStartWith': { const w = plainWords(text); return { pass: w.length >= c.min && w.every(x => x[0].toLowerCase() === c.letter), detail: `${w.length} words, bad: ${w.filter(x => x[0].toLowerCase() !== c.letter).slice(0, 3).join(' ')}` }; }
    case 'lipogram': {
      const w = plainWords(text); const bad = [...c.letters].filter(l => text.toLowerCase().includes(l));
      return { pass: w.length >= c.min && bad.length === 0, detail: `${w.length} words, contains: ${bad.join('') || 'none'}` };
    }
    case 'questions': { const s = sentences(text); return { pass: s.length === c.n && s.every(x => x.endsWith('?')), detail: `${s.length} sentences` }; }
    case 'lengths': { const w = plainWords(text); return { pass: w.length === c.lengths.length && w.every((x, i) => x.length === c.lengths[i]), detail: w.map(x => x.length).join(',') }; }
    case 'chain': {
      const w = plainWords(text).map(x => x.toLowerCase());
      return { pass: w.length === c.n && w.every((x, i) => i === 0 || x[0] === w[i - 1].at(-1)), detail: w.join(' ') };
    }
    case 'noRepeat': {
      const w = plainWords(text).map(x => x.toLowerCase());
      return { pass: w.length === c.n && new Set(w).size === w.length, detail: `${w.length} words, ${w.length - new Set(w).size} repeats` };
    }
    case 'alphaChain': {
      const w = plainWords(text).map(x => x.toLowerCase()), s = c.start.charCodeAt(0);
      return { pass: w.length === c.n && w.every((x, i) => x.charCodeAt(0) === s + i), detail: w.map(x => x[0]).join('') };
    }
    case 'maxWordLen': {
      const w = plainWords(text), long = w.filter(x => x.replace(/['’]/g, '').length > c.max);
      return { pass: w.length === c.n && !long.length, detail: `${w.length} words, too long: ${long.slice(0, 3).join(' ')}` };
    }
    default: throw new Error(`unknown writing check ${c.kind}`);
  }
}

export function grade(task, text) {
  const g = task.grader;
  if (g.type === 'answer') return gradeAnswer(g, text);
  if (g.type === 'python') return gradePython(g, text);
  if (g.type === 'writing') return gradeWriting(g.check, text);
  throw new Error(`unknown grader ${g.type}`);
}
