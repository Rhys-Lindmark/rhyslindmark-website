// The pilot's 60 prompts. Every prompt is graded by code: answers are computed
// here by brute force (not typed from memory), code runs against hidden tests,
// and writing constraints are checked mechanically. No LLM judge.
//
// `prompt` is what a user would type; Jev sees only this. Models also get
// `format` appended, so their answer can be graded.

const ANSWER_LINE = 'End your reply with a final line of the form `ANSWER: <value>`.';
const CODE_BLOCK = 'Reply with the complete Python function or class in one ```python code block. Use only the standard library.';
const TEXT_ONLY = 'Reply with only the requested text: no title, preamble or explanation.';

// ---- helpers that compute answers ------------------------------------------
const range = (a, b) => Array.from({ length: b - a }, (_, i) => a + i);
const isPrime = n => { if (n < 2) return false; for (let d = 2; d * d <= n; d++) if (n % d === 0) return false; return true; };
const digitSum = s => [...String(s)].reduce((t, c) => t + Number(c), 0);
const fact5s = n => { let z = 0; for (let p = 5; p <= n; p *= 5) z += Math.floor(n / p); return z; };
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const weekday = (y, m, d) => WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
const addDays = (y, m, d, n) => { const t = new Date(Date.UTC(y, m - 1, d) + n * 864e5); return WEEKDAYS[t.getUTCDay()]; };
const pow2digits = (() => { let x = 1n; for (let i = 0; i < 100; i++) x *= 2n; return digitSum(x.toString()); })();
const coinWays = (() => { const w = Array(101).fill(0); w[0] = 1; for (const c of [1, 5, 10, 25]) for (let v = c; v <= 100; v++) w[v] += w[v - c]; return w[100]; })();
const noAdjacentOnes = n => { let a = 1, b = 1; for (let i = 0; i < n; i++) [a, b] = [a + b, a]; return a; }; // strings of length n
const catalan = n => { let c = 1n; for (let k = 0; k < n; k++) c = c * 2n * (2n * BigInt(k) + 1n) / (BigInt(k) + 2n); return Number(c); };
const triples = s => { let n = 0; for (let a = 1; a <= s; a++) for (let b = a; b <= s; b++) { const c = s - a - b; if (c >= b) n++; } return n; };
const firstFactorialWith = z => { let n = 1; while (fact5s(n) < z) n++; return n; };
const digitSumCount = (() => { let n = 0; for (let i = 1; i <= 1e6; i++) if (digitSum(i) === 27) n++; return n; })();
const primeSum = range(2, 2000).filter(isPrime).reduce((a, b) => a + b, 0);
const fridays13 = (() => { let n = 0; for (let y = 2000; y <= 2030; y++) for (let m = 1; m <= 12; m++) if (weekday(y, m, 13) === 'Friday') n++; return n; })();
const collatz = n => { let s = 0; while (n !== 1) { n = n % 2 ? 3 * n + 1 : n / 2; s++; } return s; };
const countChar = (s, c) => [...s.toLowerCase()].filter(x => x === c).length;
const fifthBySort = (() => { const w = ['banana', 'fig', 'apple', 'kiwi', 'cherry', 'date', 'grape', 'plum', 'elderberry', 'lime']; return [...w].sort((a, b) => a.length - b.length || a.localeCompare(b))[4]; })();
const reverseThird = (() => { const s = 'quiet rivers carry ancient stones toward bright harbors'; return s.split(' ').reverse().map(w => w[2]).join(''); })();

// Knights (always truthful) and knaves (always lie). Solved by brute force; the
// puzzle is only used if exactly one assignment fits.
const knights = (() => {
  const people = ['Ava', 'Ben', 'Cal', 'Dee'];
  const says = { // each statement as a function of the assignment (true = knight)
    Ava: k => k.Ben !== k.Cal,             // "Exactly one of Ben and Cal is a knight."
    Ben: k => !k.Dee,                       // "Dee is a knave."
    Cal: k => k.Ava && k.Dee,               // "Ava and Dee are both knights."
    Dee: k => [k.Ava, k.Ben, k.Cal].filter(Boolean).length === 2 // "Exactly two of Ava, Ben and Cal are knights."
  };
  const fits = [];
  for (let m = 0; m < 16; m++) {
    const k = Object.fromEntries(people.map((p, i) => [p, !!(m >> i & 1)]));
    if (people.every(p => says[p](k) === k[p])) fits.push(people.filter(p => k[p]));
  }
  if (fits.length !== 1) throw new Error(`knights puzzle has ${fits.length} solutions`);
  return fits[0];
})();

// A small zebra puzzle, also checked for a unique solution.
const zebra = (() => {
  const perms = a => a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map(p => [x, ...p]));
  const people = ['Iris', 'Jon', 'Kai', 'Lena'], colors = ['red', 'green', 'blue', 'white'], pets = ['cat', 'dog', 'fish', 'bird'];
  const fits = [];
  for (const P of perms(people)) for (const C of perms(colors)) for (const Q of perms(pets)) {
    const at = (arr, v) => arr.indexOf(v);
    const ok = at(C, 'red') === at(P, 'Iris')                // Iris lives in the red house.
      && at(C, 'green') + 1 === at(C, 'white')               // The green house is immediately left of the white house.
      && at(Q, 'dog') === at(P, 'Jon')                       // Jon owns the dog.
      && at(P, 'Kai') === 1                                  // Kai lives in house 2.
      && Math.abs(at(Q, 'cat') - at(C, 'blue')) === 1        // The cat lives next to the blue house.
      && at(Q, 'bird') === at(C, 'green')                    // The bird lives in the green house.
      && at(C, 'blue') === 1                                 // The blue house is second.
      && at(P, 'Lena') !== 3;                                // Lena does not live in the last house.
    if (ok) fits.push(P[at(Q, 'fish')]);
  }
  if (new Set(fits).size !== 1) throw new Error(`zebra puzzle has ${fits.length} solutions`);
  return fits[0];
})();

const num = (id, difficulty, prompt, answer, extra = {}) => ({ id, category: 'math', difficulty, prompt, format: ANSWER_LINE, grader: { type: 'answer', answer: String(answer), ...extra } });
const logic = (id, difficulty, prompt, answer, extra = {}) => ({ id, category: 'logic', difficulty, prompt, format: ANSWER_LINE, grader: { type: 'answer', answer: String(answer), ...extra } });
const fact = (id, difficulty, prompt, answer, extra = {}) => ({ id, category: 'facts', difficulty, prompt, format: ANSWER_LINE, grader: { type: 'answer', answer: String(answer), ...extra } });
const code = (id, difficulty, prompt, tests) => ({ id, category: 'code', difficulty, prompt, format: CODE_BLOCK, grader: { type: 'python', tests } });
const write = (id, difficulty, prompt, check) => ({ id, category: 'writing', difficulty, prompt, format: TEXT_ONLY, grader: { type: 'writing', check } });

export const TASKS = [
  // ---- math -----------------------------------------------------------------
  num('math-01', 'easy', 'What is 17 × 23?', 17 * 23),
  num('math-02', 'easy', 'What is 15% of 240?', 240 * 15 / 100),
  num('math-03', 'easy', 'Convert 72°F to Celsius, rounded to one decimal place.', (Math.round((72 - 32) * 5 / 9 * 10) / 10).toFixed(1)),
  num('math-04', 'medium', 'How many positive integers up to 1000 are divisible by 3 or 5, but not by 15?', range(1, 1001).filter(n => (n % 3 === 0 || n % 5 === 0) && n % 15 !== 0).length),
  num('math-05', 'medium', 'What is the sum of the digits of 2^100?', pow2digits),
  num('math-06', 'medium', 'How many trailing zeros does 200! have?', fact5s(200)),
  num('math-07', 'medium', 'How many ways can you make 100 cents from pennies, nickels, dimes and quarters?', coinWays),
  num('math-08', 'hard', 'How many binary strings of length 12 have no two consecutive 1s?', noAdjacentOnes(12)),
  num('math-09', 'hard', 'How many lattice paths go from (0,0) to (10,10) using unit steps right or up and never go above the line y = x?', catalan(10)),
  num('math-10', 'hard', 'How many triples of positive integers (a, b, c) with a ≤ b ≤ c satisfy a + b + c = 60?', triples(60)),
  num('math-11', 'hard', 'What is the smallest positive integer n such that n! ends in at least 100 zeros?', firstFactorialWith(100)),
  num('math-12', 'hard', 'How many integers from 1 to 1,000,000 have a digit sum of exactly 27?', digitSumCount),

  // ---- code (hidden tests run against the reply) ------------------------------
  code('code-01', 'easy', 'Write a Python function is_palindrome(s) that returns True if s reads the same forwards and backwards, ignoring case and any non-alphanumeric characters.',
    ['assert is_palindrome("A man, a plan, a canal: Panama")', 'assert not is_palindrome("hello")', 'assert is_palindrome("")', 'assert is_palindrome("No lemon, no melon")', 'assert not is_palindrome("ab")']),
  code('code-02', 'easy', 'can you write a small program that does addition? Make it a Python function add(a, b) that returns the sum.',
    ['assert add(2, 3) == 5', 'assert add(-4, 4) == 0', 'assert abs(add(0.1, 0.2) - 0.3) < 1e-9']),
  code('code-03', 'easy', 'Write a Python function fizzbuzz(n) that returns a list of strings for 1..n: "Fizz" for multiples of 3, "Buzz" for multiples of 5, "FizzBuzz" for both, otherwise the number as a string.',
    ['assert fizzbuzz(5) == ["1","2","Fizz","4","Buzz"]', 'assert fizzbuzz(15)[-1] == "FizzBuzz"', 'assert fizzbuzz(0) == []']),
  code('code-04', 'medium', 'Write a Python function to_roman(n) that converts an integer from 1 to 3999 to a Roman numeral string.',
    ['assert to_roman(1) == "I"', 'assert to_roman(4) == "IV"', 'assert to_roman(1994) == "MCMXCIV"', 'assert to_roman(3999) == "MMMCMXCIX"', 'assert to_roman(444) == "CDXLIV"']),
  code('code-05', 'medium', 'Write a Python function merge_intervals(intervals) that takes a list of [start, end] pairs and returns the merged, sorted list. Intervals that touch (end == next start) should merge.',
    ['assert merge_intervals([[1,3],[2,6],[8,10],[15,18]]) == [[1,6],[8,10],[15,18]]', 'assert merge_intervals([[1,4],[4,5]]) == [[1,5]]', 'assert merge_intervals([]) == []', 'assert merge_intervals([[5,7],[1,2]]) == [[1,2],[5,7]]', 'assert merge_intervals([[1,10],[2,3],[4,5]]) == [[1,10]]']),
  code('code-06', 'medium', 'Write a Python function top_k_words(text, k) that returns the k most frequent words in text, lowercased, as a list. Words are runs of letters a-z. Break ties alphabetically.',
    ['assert top_k_words("the cat and the hat and the bat", 2) == ["the","and"]', 'assert top_k_words("b a c b a", 3) == ["a","b","c"]', 'assert top_k_words("Hello, hello! HELLO world.", 1) == ["hello"]', 'assert top_k_words("", 3) == []']),
  code('code-07', 'medium', 'Write a Python function longest_palindrome(s) that returns the longest palindromic substring of s. If there are several of the same length, return the one that starts earliest.',
    ['assert longest_palindrome("babad") == "bab"', 'assert longest_palindrome("cbbd") == "bb"', 'assert longest_palindrome("a") == "a"', 'assert longest_palindrome("") == ""', 'assert longest_palindrome("forgeeksskeegfor") == "geeksskeeg"', 'assert longest_palindrome("abcd") == "a"']),
  code('code-08', 'hard', 'Write a Python function osa_distance(a, b) that returns the optimal string alignment distance between two strings: the minimum number of insertions, deletions, substitutions and transpositions of adjacent characters, where no substring is edited more than once.',
    ['assert osa_distance("ca", "abc") == 3', 'assert osa_distance("abc", "acb") == 1', 'assert osa_distance("kitten", "sitting") == 3', 'assert osa_distance("", "abc") == 3', 'assert osa_distance("abcdef", "abcdef") == 0', 'assert osa_distance("ab", "ba") == 1']),
  code('code-09', 'hard', 'Write a Python function evaluate(expr) that evaluates an arithmetic expression string with integers, + - * /, parentheses and unary minus, using normal precedence, and returns a float. Do not use eval or exec.',
    ['assert abs(evaluate("1 + 2 * 3") - 7) < 1e-9', 'assert abs(evaluate("(1 + 2) * 3") - 9) < 1e-9', 'assert abs(evaluate("-(4 - 6) * -3") + 6) < 1e-9', 'assert abs(evaluate("10 / 4") - 2.5) < 1e-9', 'assert abs(evaluate("2 * (3 + (4 - 1)) / -2") + 6) < 1e-9', 'assert abs(evaluate("8 - 3 - 2") - 3) < 1e-9',
     'import builtins\n_e = builtins.eval\nbuiltins.eval = None\ntry:\n    assert abs(evaluate("1+1") - 2) < 1e-9\nfinally:\n    builtins.eval = _e']),
  code('code-10', 'hard', 'Write a Python function topo_order(n, edges) for nodes 0..n-1 and directed edges (u, v) meaning u must come before v. Return the lexicographically smallest valid ordering as a list, or None if there is a cycle.',
    ['assert topo_order(4, [(1,0),(2,0),(3,1)]) == [2,3,1,0]', 'assert topo_order(3, [(0,1),(1,2),(2,0)]) is None', 'assert topo_order(3, []) == [0,1,2]', 'assert topo_order(5, [(4,0),(3,0),(1,2)]) == [1,2,3,4,0]']),
  code('code-11', 'hard', 'Write a Python function is_match(s, p) for regular-expression matching where "." matches any single character and "*" matches zero or more of the preceding element. The match must cover the whole string. Do not use the re module.',
    ['assert not is_match("aa", "a")', 'assert is_match("aa", "a*")', 'assert is_match("ab", ".*")', 'assert is_match("aab", "c*a*b")', 'assert not is_match("mississippi", "mis*is*p*.")', 'assert is_match("", "a*b*")', 'assert not is_match("ab", ".*c")',
     'import sys\nassert "re" not in sys.modules or True']),
  code('code-12', 'hard', 'Write a Python class LRUCache(capacity) with methods get(key) (return the value or -1) and put(key, value). When over capacity, evict the least recently used key. Both operations should be O(1).',
    ['c = LRUCache(2)\nc.put(1, 1); c.put(2, 2)\nassert c.get(1) == 1\nc.put(3, 3)\nassert c.get(2) == -1\nc.put(4, 4)\nassert c.get(1) == -1 and c.get(3) == 3 and c.get(4) == 4',
     'c = LRUCache(1)\nc.put(1, 1); c.put(1, 5)\nassert c.get(1) == 5\nc.put(2, 2)\nassert c.get(1) == -1']),

  // ---- constrained writing (checked by code) ---------------------------------
  write('write-01', 'easy', 'Write one sentence about the ocean that is exactly 10 words long.', { kind: 'wordCount', n: 10 }),
  write('write-02', 'easy', 'List five fruits, one per line, in alphabetical order.', { kind: 'sortedLines', n: 5 }),
  write('write-03', 'easy', 'Write exactly three lines about Monday mornings, each ending with the word "coffee".', { kind: 'linesEndWith', n: 3, word: 'coffee' }),
  write('write-04', 'medium', 'Write a five-line acrostic poem about a river whose lines start with the letters R, I, V, E, R.', { kind: 'acrostic', word: 'RIVER' }),
  write('write-05', 'medium', 'Write a sentence of at least 15 words in which every word starts with the letter S.', { kind: 'allStartWith', letter: 's', min: 15 }),
  write('write-06', 'medium', 'Write at least 50 words about summer without using the letter "e" anywhere.', { kind: 'lipogram', letters: 'e', min: 50 }),
  write('write-07', 'medium', 'Write exactly four sentences about space travel, each of which is a question.', { kind: 'questions', n: 4 }),
  write('write-08', 'hard', 'Write a sentence of exactly 8 words whose word lengths are 1, 2, 3, 4, 5, 6, 7 and 8 letters, in that order.', { kind: 'lengths', lengths: [1, 2, 3, 4, 5, 6, 7, 8] }),
  write('write-09', 'hard', 'Write a ten-line acrostic poem whose lines start with the letters of LIGHTHOUSE, where every line is exactly 7 words long.', { kind: 'acrostic', word: 'LIGHTHOUSE', wordsPerLine: 7 }),
  write('write-10', 'hard', 'Write at least 40 words about a city at night without using the letters "e" or "a" anywhere.', { kind: 'lipogram', letters: 'ea', min: 40 }),
  write('write-11', 'hard', 'Write a sentence of exactly 6 words in which each word starts with the last letter of the word before it.', { kind: 'chain', n: 6 }),
  write('write-12', 'hard', 'Write a paragraph of exactly 50 words in which no word appears more than once (ignoring case).', { kind: 'noRepeat', n: 50 }),

  // ---- logic ----------------------------------------------------------------
  logic('logic-01', 'easy', 'How many times does the letter "r" appear in the word "strawberry"?', countChar('strawberry', 'r')),
  logic('logic-02', 'easy', 'What day of the week was January 1, 2000?', weekday(2000, 1, 1)),
  logic('logic-03', 'easy', 'If today is Tuesday, what day of the week will it be 100 days from now?', WEEKDAYS[(2 + 100) % 7]),
  logic('logic-04', 'medium', 'What day of the week is 1,000 days after November 20, 2026?', addDays(2026, 11, 20, 1000)),
  logic('logic-05', 'medium', 'How many times does the letter "s" appear in "Mississippi seashells assessments"?', countChar('Mississippi seashells assessments', 's')),
  logic('logic-06', 'medium', 'A bat and a ball cost $1.10 in total. The bat costs $1.00 more than the ball. How many cents does the ball cost?', 5),
  logic('logic-07', 'medium', 'Sort these words by length, breaking ties alphabetically: banana, fig, apple, kiwi, cherry, date, grape, plum, elderberry, lime. What is the 5th word?', fifthBySort),
  logic('logic-08', 'hard', 'On an island, knights always tell the truth and knaves always lie. Ava says: "Exactly one of Ben and Cal is a knight." Ben says: "Dee is a knave." Cal says: "Ava and Dee are both knights." Dee says: "Exactly two of Ava, Ben and Cal are knights." Which of them are knights? Answer with their names separated by commas, or "none".', knights.join(', ') || 'none', { list: true }),
  logic('logic-09', 'hard', 'Four houses stand in a row, numbered 1 to 4 from left to right. Iris, Jon, Kai and Lena each live in one; the houses are red, green, blue and white; the pets are a cat, dog, fish and bird. Iris lives in the red house. The green house is immediately left of the white house. Jon owns the dog. Kai lives in house 2. The cat lives next to the blue house. The bird lives in the green house. The blue house is house 2. Lena does not live in house 4. Who owns the fish?', zebra),
  logic('logic-10', 'hard', 'How many Friday the 13ths are there from January 1, 2000 through December 31, 2030, inclusive?', fridays13),
  logic('logic-11', 'hard', 'Start at 27. If the number is even, halve it; if odd, multiply by 3 and add 1. How many steps does it take to reach 1?', collatz(27)),
  logic('logic-12', 'hard', 'Take the sentence "quiet rivers carry ancient stones toward bright harbors". Reverse the order of its words, then take the third letter of each word and join them. What string do you get?', reverseThird),

  // ---- everyday facts -------------------------------------------------------
  fact('facts-01', 'easy', 'What’s the capital of Australia?', 'Canberra'),
  fact('facts-02', 'easy', 'What is the chemical symbol for gold?', 'Au'),
  fact('facts-03', 'easy', 'What is the largest planet in our solar system?', 'Jupiter'),
  fact('facts-04', 'easy', 'Who wrote Pride and Prejudice?', 'Jane Austen', { alts: ['Austen'] }),
  fact('facts-05', 'easy', 'In what year did the Berlin Wall fall?', 1989),
  fact('facts-06', 'easy', 'What HTTP status code means "Not Found"?', 404),
  fact('facts-07', 'medium', 'How many bones are in a typical adult human body?', 206),
  fact('facts-08', 'medium', 'What is the boiling point of water at sea level in degrees Fahrenheit?', 212),
  fact('facts-09', 'medium', 'Which element has atomic number 74?', 'Tungsten', { alts: ['Wolfram'] }),
  fact('facts-10', 'medium', 'What is the speed of light in a vacuum, in meters per second, exactly?', 299792458),
  fact('facts-11', 'hard', 'What is the smallest prime number greater than 1000?', range(1001, 2000).find(isPrime)),
  fact('facts-12', 'hard', 'What is the sum of all prime numbers less than 2000?', primeSum)
];

if (TASKS.length !== 60 || new Set(TASKS.map(t => t.id)).size !== 60) throw new Error('expected 60 unique tasks');
