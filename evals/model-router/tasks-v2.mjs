// v2 candidate pool: the 60 v1 prompts plus generated ones with a difficulty
// dial. Every answer is computed here (seeded, so the pool is identical on
// every run). A calibration run sorts candidates by how many of the 8
// model/effort arms fail them; select-v2.mjs then picks 100 easy, 50 medium
// and 25 hard.
import { TASKS as V1 } from './tasks.mjs';

const ANSWER_LINE = 'End your reply with a final line of the form `ANSWER: <value>`.';
const CODE_BLOCK = 'Reply with the complete Python function or class in one ```python code block. Use only the standard library.';
const TEXT_ONLY = 'Reply with only the requested text: no title, preamble or explanation.';

// seeded RNG (mulberry32) so the pool never changes between runs
let seed = 20261121;
const rnd = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = xs => xs[Math.floor(rnd() * xs.length)];

const WORDS = 'river stone harbor lantern meadow thistle copper willow ember orchard cobalt saffron pebble marrow tundra velvet quarry falcon juniper nettle bramble cinder hollow lagoon mosaic parsley quiver ribbon sapling timber umber vessel walnut yonder zephyr acorn basil cedar dahlia ermine fennel garnet hazel indigo jasper kettle lilac mango nutmeg olive pepper quill raisin sorrel tassel urchin violet wicker yarrow'.split(' ');
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dayAfter = (y, m, d, n) => WEEKDAYS[new Date(Date.UTC(y, m - 1, d) + n * 864e5).getUTCDay()];
const fmt = n => n.toLocaleString('en-US');

const out = [];
const add = (family, dial, task) => out.push({ ...task, family, dial, id: `${family}-${String(out.filter(t => t.family === family).length + 1).padStart(2, '0')}` });
const answer = (category, prompt, value, extra = {}) => ({ category, prompt, format: ANSWER_LINE, grader: { type: 'answer', answer: String(value), ...extra } });
const writing = (prompt, check) => ({ category: 'writing', prompt, format: TEXT_ONLY, grader: { type: 'writing', check } });
const code = (prompt, tests) => ({ category: 'code', prompt, format: CODE_BLOCK, grader: { type: 'python', tests } });

// ---- letter counting: from one word to a long sentence ----------------------------
for (const [dial, nWords, n] of [[1, 1, 6], [2, 4, 6], [3, 10, 6], [4, 18, 6]]) for (let i = 0; i < n; i++) {
  const phrase = Array.from({ length: nWords }, () => pick(WORDS)).join(' ');
  const letter = pick([...new Set(phrase.replace(/ /g, ''))]);
  add('letters', dial, answer('logic', `How many times does the letter "${letter}" appear in: "${phrase}"?`, [...phrase].filter(c => c === letter).length));
}
// ---- calendar: short hops to counting dates over decades ---------------------------
for (let i = 0; i < 6; i++) { const n = int(2, 12), wd = pick(WEEKDAYS); add('calendar', 1, answer('logic', `If today is ${wd}, what day of the week will it be ${n} days from now?`, WEEKDAYS[(WEEKDAYS.indexOf(wd) + n) % 7])); }
for (let i = 0; i < 6; i++) { const y = int(1990, 2030), m = int(1, 12), d = int(1, 28), n = int(200, 5000); add('calendar', 3, answer('logic', `What day of the week is ${fmt(n)} days after ${MONTHS[m - 1]} ${d}, ${y}?`, dayAfter(y, m, d, n))); }
for (let i = 0; i < 6; i++) {
  const y0 = int(1950, 2000), y1 = y0 + int(15, 40), wd = pick(WEEKDAYS), dom = pick([1, 13, 31]);
  let c = 0; for (let y = y0; y <= y1; y++) for (let m = 0; m < 12; m++) { const t = new Date(Date.UTC(y, m, dom)); if (t.getUTCMonth() === m && WEEKDAYS[t.getUTCDay()] === wd) c++; }
  add('calendar', 4, answer('logic', `How many months from January ${y0} through December ${y1} have a ${wd} that falls on day ${dom} of the month?`, c));
}
// ---- exact arithmetic: 2-digit to 6-digit products ----------------------------------
for (const [dial, digits, n] of [[1, 2, 6], [2, 3, 6], [3, 5, 6], [4, 7, 5]]) for (let i = 0; i < n; i++) {
  const a = BigInt(int(10 ** (digits - 1), 10 ** digits - 1)), b = BigInt(int(10 ** (digits - 1), 10 ** digits - 1));
  add('multiply', dial, answer('math', `What is ${a} × ${b}? Give the exact integer.`, (a * b).toString()));
}
// ---- counting integers with combined conditions (brute force) -----------------------
const digitSum = n => [...String(n)].reduce((s, c) => s + +c, 0);
for (const [dial, N, n] of [[1, 100, 5], [2, 5000, 6], [3, 200000, 6], [4, 3000000, 5]]) for (let i = 0; i < n; i++) {
  const a = int(3, 9), b = int(4, 13), s = int(5, 25);
  const conds = dial === 1 ? [[`divisible by ${a}`, k => k % a === 0]]
    : dial === 2 ? [[`divisible by ${a} or ${b}`, k => k % a === 0 || k % b === 0]]
    : [[`divisible by ${a} but not by ${b}`, k => k % a === 0 && k % b !== 0], [`have a digit sum of ${s}`, k => digitSum(k) === s]];
  let c = 0; for (let k = 1; k <= N; k++) if (conds.every(([, f]) => f(k))) c++;
  if (c > 0) add('count', dial, answer('math', `How many integers from 1 to ${fmt(N)} are ${conds.map(x => x[0]).join(' and ')}?`.replace('are have', 'have'), c));
}
// ---- string transforms: short to long --------------------------------------------
for (const [dial, nWords, n] of [[1, 3, 5], [2, 6, 5], [3, 12, 6], [4, 20, 5]]) for (let i = 0; i < n; i++) {
  const ws = Array.from({ length: nWords }, () => pick(WORDS)), k = int(1, 3);
  const res = [...ws].reverse().filter((_, j) => dial < 3 || j % 2 === 0).map(w => w[k - 1]).join('');
  const rule = dial < 3 ? `Reverse the order of the words, then take letter ${k} of each word and join them.` : `Reverse the order of the words, keep only every other word starting with the first one after reversing, then take letter ${k} of each kept word and join them.`;
  add('strings', dial, answer('logic', `Take this list of words: "${ws.join(' ')}". ${rule} What string do you get?`, res));
}
// ---- knights and knaves, generated and checked for a unique solution -----------------
const NAMES = ['Ava', 'Ben', 'Cal', 'Dee', 'Eli', 'Fay'];
function knights(n) {
  for (let tries = 0; tries < 500; tries++) {
    const ppl = NAMES.slice(0, n), st = ppl.map((p) => {
      const others = ppl.filter(q => q !== p), kind = int(0, 2);
      if (kind === 0) { const q = pick(others); return [`"${q} is a knave."`, k => !k[q]]; }
      if (kind === 1) { const q = pick(others), r = pick(others.filter(x => x !== q)); return [`"${q} and ${r} are the same kind."`, k => k[q] === k[r]]; }
      const c = int(1, n - 1); return [`"Exactly ${c} of us ${n} are knights."`, k => ppl.filter(x => k[x]).length === c];
    });
    const fits = [];
    for (let m = 0; m < 2 ** n; m++) { const k = Object.fromEntries(ppl.map((p, i) => [p, !!(m >> i & 1)])); if (ppl.every((p, i) => st[i][1](k) === k[p])) fits.push(ppl.filter(p => k[p])); }
    if (fits.length === 1) return { text: ppl.map((p, i) => `${p} says: ${st[i][0]}`).join(' '), answer: fits[0].join(', ') || 'none' };
  }
  throw new Error('no unique knights puzzle');
}
for (const [dial, n, count] of [[2, 3, 4], [3, 4, 4], [4, 6, 4]]) for (let i = 0; i < count; i++) {
  const p = knights(n);
  add('knights', dial, answer('logic', `On an island, knights always tell the truth and knaves always lie. ${p.text} Which of them are knights? Answer with their names separated by commas, or "none".`, p.answer, { list: true }));
}
// ---- constrained writing, checked by code --------------------------------------------
const TOPICS = ['the sea', 'a library', 'winter', 'a city bus', 'a garden', 'a thunderstorm', 'a bakery', 'mountains', 'a train station', 'the moon'];
for (const [dial, letters, min] of [[2, 'z', 30], [3, 'e', 40], [4, 'ea', 40], [4, 'eao', 30]]) for (let i = 0; i < 3; i++) add('lipogram', dial, writing(`Write at least ${min} words about ${pick(TOPICS)} without using the letter${letters.length > 1 ? 's' : ''} ${[...letters].map(l => `"${l}"`).join(', ')} anywhere.`, { kind: 'lipogram', letters, min }));
for (const [dial, len] of [[1, 3], [2, 5], [3, 8], [4, 11]]) for (let i = 0; i < 3; i++) { const lengths = Array.from({ length: len }, (_, j) => dial === 4 ? int(2, 9) : j + 1); add('wordlens', dial, writing(`Write a sentence of exactly ${len} words whose word lengths are ${lengths.join(', ')} letters, in that order.`, { kind: 'lengths', lengths })); }
for (const [dial, word, per] of [[1, 'SUN', null], [2, 'GARDEN', null], [3, 'WATERFALL', 6], [4, 'CONSTELLATION', 5]]) for (let i = 0; i < 2; i++) add('acrostic', dial, writing(`Write a ${word.length}-line acrostic poem whose lines start with the letters of ${word}${per ? `, where every line is exactly ${per} words long` : ''}.`, { kind: 'acrostic', word, wordsPerLine: per }));
for (const [dial, n] of [[1, 5], [2, 10], [3, 26]]) for (let i = 0; i < 2; i++) { const start = dial === 3 ? 'a' : pick('abcdefghij'.split('')); add('alphachain', dial, writing(`Write a sentence of exactly ${n} words where the words start with consecutive letters of the alphabet, beginning with "${start.toUpperCase()}".`, { kind: 'alphaChain', n, start })); }
for (const [dial, n, max] of [[1, 10, 6], [2, 30, 4], [3, 60, 3]]) for (let i = 0; i < 2; i++) add('shortwords', dial, writing(`Write exactly ${n} words about ${pick(TOPICS)} in which no word is longer than ${max} letters.`, { kind: 'maxWordLen', n, max }));

// ---- everyday facts (easy, stable) -----------------------------------------------
for (const [q, a, alts] of [
  ['What is the capital of Japan?', 'Tokyo'], ['What is the capital of Canada?', 'Ottawa'], ['What is the capital of Brazil?', 'Brasília', ['Brasilia']],
  ['What is the capital of Kenya?', 'Nairobi'], ['What is the capital of Norway?', 'Oslo'], ['What is the capital of Egypt?', 'Cairo'],
  ['What is the chemical symbol for sodium?', 'Na'], ['What is the chemical symbol for iron?', 'Fe'], ['What is the chemical symbol for potassium?', 'K'],
  ['How many sides does a hexagon have?', 6], ['How many minutes are in a day?', 1440], ['How many continents are there?', 7],
  ['What planet is known as the Red Planet?', 'Mars'], ['Who painted the Mona Lisa?', 'Leonardo da Vinci', ['da Vinci', 'Leonardo']],
  ['What is the freezing point of water in degrees Celsius?', 0], ['What gas do plants absorb from the air for photosynthesis?', 'Carbon dioxide', ['CO2']],
  ['How many legs does a spider have?', 8], ['What is the largest ocean on Earth?', 'Pacific Ocean', ['Pacific']],
  ['What language has the most native speakers?', 'Mandarin Chinese', ['Mandarin', 'Chinese']], ['How many players are on a soccer team on the field?', 11]
]) add('genfacts', 1, answer('facts', q, a, alts ? { alts } : {}));

// ---- code with tests computed from reference implementations -----------------------
const lis = a => { const t = []; for (const x of a) { let i = t.findIndex(v => v >= x); if (i < 0) t.push(x); else t[i] = x; } return t.length; };
const coins = (amt, cs) => { const d = Array(amt + 1).fill(Infinity); d[0] = 0; for (let v = 1; v <= amt; v++) for (const c of cs) if (c <= v) d[v] = Math.min(d[v], d[v - c] + 1); return d[amt] === Infinity ? -1 : d[amt]; };
const paths = g => { const R = g.length, C = g[0].length, d = g.map(r => r.map(() => 0)); for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) { if (g[i][j]) { d[i][j] = 0; continue; } d[i][j] = i === 0 && j === 0 ? 1 : (i ? d[i - 1][j] : 0) + (j ? d[i][j - 1] : 0); } return d[R - 1][C - 1]; };
const py = v => JSON.stringify(v).replace(/true/g, 'True').replace(/false/g, 'False').replace(/null/g, 'None');
const tests = (fn, cases) => cases.map(([args, want]) => `assert ${fn}(${args.map(py).join(', ')}) == ${py(want)}, ${py(String(args).slice(0, 40))}`);
const arr = n => Array.from({ length: n }, () => int(-20, 40));
add('gencode', 2, code('Write a Python function lis_length(nums) that returns the length of the longest strictly increasing subsequence of a list of integers.', tests('lis_length', [[[[]], 0], [[[5]], 1], ...Array.from({ length: 6 }, () => { const a = arr(int(5, 30)); return [[a], lis(a)]; })])));
add('gencode', 2, code('Write a Python function min_coins(amount, coins) that returns the fewest coins needed to make amount from unlimited coins of the given denominations, or -1 if it is impossible.', tests('min_coins', [[[0, [1, 2]], 0], [[3, [2]], -1], ...Array.from({ length: 6 }, () => { const cs = [...new Set(Array.from({ length: int(2, 4) }, () => int(2, 25)))]; const amt = int(10, 300); return [[amt, cs], coins(amt, cs)]; })])));
add('gencode', 3, code('Write a Python function count_paths(grid) for a grid of 0s (open) and 1s (blocked). Count the paths from the top-left to the bottom-right cell moving only right or down, never entering a blocked cell. Return 0 if the start or end is blocked.', tests('count_paths', Array.from({ length: 7 }, (_, i) => { const R = int(2, 9), C = int(2, 9); const g = Array.from({ length: R }, () => Array.from({ length: C }, () => +(rnd() < 0.2))); if (i < 5) { g[0][0] = 0; g[R - 1][C - 1] = 0; } return [[g], paths(g)]; }))));
const toWords = n => { const o = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'], t = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
  const h = x => x < 20 ? o[x] : x < 100 ? t[Math.floor(x / 10)] + (x % 10 ? '-' + o[x % 10] : '') : o[Math.floor(x / 100)] + ' hundred' + (x % 100 ? ' ' + h(x % 100) : '');
  if (n === 0) return 'zero'; const parts = []; for (const [v, w] of [[1e9, 'billion'], [1e6, 'million'], [1e3, 'thousand'], [1, '']]) { const q = Math.floor(n / v) % 1000; if (q) parts.push(h(q) + (w ? ' ' + w : '')); } return parts.join(' '); };
add('gencode', 4, code('Write a Python function to_words(n) that spells out a non-negative integer below 10 billion in lowercase American English, with no "and", hyphens between tens and ones ("forty-two"), and single spaces elsewhere. Examples: 0 -> "zero", 105 -> "one hundred five", 1000042 -> "one million forty-two".', tests('to_words', [[[0], 'zero'], [[105], 'one hundred five'], [[1000042], 'one million forty-two'], ...Array.from({ length: 6 }, () => { const n = int(0, 9999999999); return [[n], toWords(n)]; })])));
const spiral = m => { const r = []; let t = 0, b = m.length - 1, l = 0, rt = m[0].length - 1; while (t <= b && l <= rt) { for (let j = l; j <= rt; j++) r.push(m[t][j]); t++; for (let i = t; i <= b; i++) r.push(m[i][rt]); rt--; if (t <= b) { for (let j = rt; j >= l; j--) r.push(m[b][j]); b--; } if (l <= rt) { for (let i = b; i >= t; i--) r.push(m[i][l]); l++; } } return r; };
add('gencode', 3, code('Write a Python function spiral_order(matrix) that returns the elements of a non-empty rectangular matrix in clockwise spiral order, starting at the top-left.', tests('spiral_order', Array.from({ length: 6 }, () => { const R = int(1, 6), C = int(1, 6); const m = Array.from({ length: R }, () => Array.from({ length: C }, () => int(0, 99))); return [[m], spiral(m)]; }))));
const rle = s => s.replace(/(.)\1*/g, x => x.length + x[0]);
add('gencode', 1, code('Write a Python function rle(s) that run-length encodes a string of letters, writing each run as its length followed by the letter, e.g. "aaabcc" -> "3a1b2c".', tests('rle', [[[''], ''], ...Array.from({ length: 5 }, () => { const s = Array.from({ length: int(3, 15) }, () => pick('aab')).join(''); return [[s], rle(s)]; })])));

export const POOL = [...V1.map(t => ({ ...t, family: 'v1', dial: { easy: 1, medium: 2, hard: 3 }[t.difficulty] })), ...out];
if (new Set(POOL.map(t => t.id)).size !== POOL.length) throw new Error('duplicate ids');
// Until select-v2.mjs writes tasks-v2-final.mjs, a v2 run uses the whole pool (calibration).
export const TASKS_OR_POOL = POOL;
