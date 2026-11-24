// 20 Questions over any noun. A secret thing from one pool of ~100 concrete nouns (animals,
// plants, foods, household objects, tools, vehicles, buildings, materials, body parts, natural
// things…), and one bank of general yes/no questions that work for any of them ("Is it
// alive?", "Is it bigger than a breadbox?"). The answers are a lookup table, built once by Jev
// offline and spot-checked (scripts/build-table.js -> data/twenty/nouns.json). Code answers
// from the table, so every player hears the same truth. Fewest turns wins.
//
// Type anything: a thing that isn't in the pool ("hedgehog") gets its row of the table from
// Jev before the race (oracleTurn: one request, one Noul per question, yes at 0.5 or more).
// Then it's a lookup like any other. The thing and its row live in the game state
// (`s.custom`), so any turn can be rebuilt from `s` alone, and every player hears the same answers.
//
// Who decides what. Jev makes one judgment per turn; code does the rest:
//   code   crosses off things that don't fit the answers (`still_possible`, in every player's state)
//   code   guesses when exactly one thing is left (or, out of questions, the first still possible)
//   Jev    (one Choice) Which question splits what's left most evenly? (askText)
// When code decides alone, turn() returns `forced`: the move, with no model call.
//
// Pure module: no Node or browser APIs. The workshop's server, CLI and browser all run it, and
// it has the same shape as the race page's game modules (ai.rhyslindmark.com/jev/races).

export const MAX_TURNS = 20;
export const MISS_TURNS = MAX_TURNS + 5;
export const GUESS = 'Guess: ';

// The table as stored: { items: [...], questions: { 'Is it alive?': [things where yes] }, sets }.
export const prep = t => ({ ...t, yes: Object.fromEntries(Object.entries(t.questions).map(([q, list]) => [q, new Set(list)])) });

// A typed thing: trimmed, lower case, at most 40 characters, letters/digits/spaces and a
// little punctuation. null if it isn't usable.
export function cleanThing(x) {
  if (typeof x !== 'string') return null;
  const t = x.trim().toLowerCase().replace(/\s+/g, ' ');
  return t.length && t.length <= 40 && /^[\p{L}\p{N}][\p{L}\p{N} '’.&-]*$/u.test(t) ? t : null;
}

// The table this game plays: with a typed thing sorted into the pool.
export function tableFor(data, s) {
  if (!s.custom || data.items.includes(s.custom.thing)) return data;
  const { thing, row } = s.custom;
  const qs = Object.keys(data.questions);
  if (cleanThing(thing) !== thing || !row || typeof row !== 'object' || qs.some(q => row[q] !== 'yes' && row[q] !== 'no')) throw new Error('Bad answers for the typed thing');
  return { ...data, items: [...data.items, thing].sort((a, b) => a.localeCompare(b)), custom: { thing, row } };
}

export const answer = (t, thing, q) => (t.custom?.thing === thing ? t.custom.row[q] === 'yes' : t.yes[q].has(thing)) ? 'yes' : 'no';

// The things that fit every answer so far and haven't been guessed: crossing off on paper.
export const stillPossible = (t, s) => t.items.filter(x => !s.guessed.includes(x) && s.answers.every(a => answer(t, x, a.question) === a.answer));

// Two things with the same answers to every question can never be told apart.
export function clashes(t) {
  const qs = Object.keys(t.questions), sig = {};
  for (const x of t.items) (sig[qs.map(q => answer(t, x, q)[0]).join('')] ??= []).push(x);
  return Object.values(sig).filter(v => v.length > 1);
}

// Everything code knows on a turn. Players in the workshop get this as `game`.
export function view(data, s) {
  const t = tableFor(data, s);
  const asked = new Set(s.answers.map(a => a.question));
  const unasked = Object.keys(t.questions).filter(q => !asked.has(q));
  const unguessed = t.items.filter(x => !s.guessed.includes(x));
  return {
    things: t.items,                    // the whole pool
    answers: s.answers,                 // [{ question, answer: 'yes' | 'no' }] so far
    wrongGuesses: s.guessed,
    unasked,                            // questions not asked yet
    unguessed,                          // things not guessed yet
    stillPossible: stillPossible(t, s), // things that fit every answer and weren't guessed
    turnsLeft: MAX_TURNS - s.turns,
    secretNumber: s.r + 1,
    secretCount: s.secrets.length,
    moves: [...unasked, ...unguessed.map(x => GUESS + x)], // every legal move, as text
  };
}

// The state my player gives Jev, and the LLM lanes see.
export function stateFor(game) {
  return {
    game: 'I am thinking of one thing from `things`. Find it in as few turns as possible.',
    things: game.things,
    answers: game.answers.map(a => `${a.question} ${a.answer}`),
    ...(game.wrongGuesses.length ? { wrong_guesses: game.wrongGuesses } : {}),
    still_possible: game.stillPossible,
    turns_left: game.turnsLeft,
  };
}
// The one judgment, and the same turn for every racer (Jev, the LLMs, You): this question, the
// state above, and the unasked questions as the options.
export const askText = "Which question splits what's left most evenly?";

// Code's move, when code can decide alone: one thing left, or no questions left.
export function codeMove(game) {
  if (game.stillPossible.length === 1 || !game.unasked.length) return GUESS + game.stillPossible[0];
  return null;
}

// Jev as the oracle for a typed thing: one request, one Noul per question.
// (scripts/build-table.js builds the whole table with the same request, one per noun.)
export function oracleTurn(data, thing) {
  const qs = Object.keys(data.questions);
  return {
    jev: {
      state: { thing },
      questions: Object.fromEntries(qs.map((q, i) => ['q' + (i + 1), { type: 'noul', instructions: `About ${thing}: ${q}`,
        criteria: { true: `Yes, this is usually true of ${thing}.`, false: `No, this is usually not true of ${thing}.` } }])),
      // The "move" is the thing and its row, which init takes as extra.oracle.
      decide: a => ({ move: { thing, row: Object.fromEntries(qs.map((q, i) => [q, a['q' + (i + 1)].noul >= 0.5 ? 'yes' : 'no'])) },
        probs: Object.fromEntries(qs.map((q, i) => [q, a['q' + (i + 1)].noul])) }),
    },
  };
}

// The oracle request for a typed thing, or null if it needs none (it's in the pool) or isn't
// valid. The race page's move endpoint calls this with { oracle: { thing } }; the category
// argument is there for that page's older signature and is ignored.
export function oracleFor(data, _category, thing) {
  const t = cleanThing(thing);
  if (!t || data.items.includes(t)) return null;
  return { ask: { thing: t }, turn: oracleTurn(data, t) };
}

// Case ids: 'a' | 'b' | 'c' (three fixed secrets), 'random' (three random, settled by
// resolve()), 'one:<thing>', 'set:<x>|<y>|<z>', 'type:<anything>'.
export function parseCase(caseId) {
  const [kind, ...rest] = String(caseId).split(':');
  return { kind, arg: rest.join(':') };
}

export default {
  id: 'twenty',
  title: '20 Questions',
  blurb: 'A secret thing from 100 nouns, or anything you type. Ask yes/no questions; code crosses off what no longer fits and guesses when one is left. Fewest turns wins.',
  steps: 'turns',

  async load(readJson) { return prep(await readJson('twenty/nouns.json')); },

  cases: data => [
    ...Object.keys(data.sets).map(k => ({ id: k, label: `Three secrets (set ${k.toUpperCase()})` })),
    { id: 'random', label: '3 random secrets' },
    { id: 'one', label: 'Pick one secret…' },
    { id: 'type', label: 'Type anything…' },
  ],

  resolve(data, caseId) {
    if (caseId !== 'random') return caseId;
    const pool = [...data.items];
    return 'set:' + Array.from({ length: 3 }, () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0]).join('|');
  },

  oracle(data, caseId) {
    const { kind, arg } = parseCase(caseId);
    return kind === 'type' ? oracleFor(data, null, arg) : null;
  },
  oracleFor,

  // extra: { oracle: { thing, row } } for a typed thing (oracleTurn's move).
  init(data, caseId, extra) {
    const { kind, arg } = parseCase(caseId);
    const base = { r: 0, answers: [], guessed: [], turns: 0, results: [] };
    if (kind === 'type') {
      const thing = cleanThing(arg);
      if (!thing) throw new Error('Type a thing (letters and spaces, up to 40 characters)');
      if (data.items.includes(thing)) return { ...base, secrets: [thing] };
      if (extra?.oracle?.thing !== thing) throw new Error(`No answers yet for "${thing}"`);
      return { ...base, secrets: [thing], custom: { thing, row: extra.oracle.row } };
    }
    const secrets = kind === 'one' ? [arg] : kind === 'set' ? arg.split('|') : data.sets[kind];
    if (!secrets?.length || secrets.some(x => !data.items.includes(x))) throw new Error(`Unknown case "${caseId}"`);
    return { ...base, secrets };
  },

  done: s => s.r >= s.secrets.length,

  // A turn: the state, the question and the legal options every racer gets, my Jev request
  // (one Choice) and, when code decides alone, `forced` (play it with no model call).
  turn(data, s) {
    const game = view(data, s);
    const state = stateFor(game);
    const options = game.unasked.map(q => ({ name: q }));
    const forced = codeMove(game);
    const jev = {
      state,
      questions: { ask: { type: 'choice', instructions: askText, criteria: Object.fromEntries(game.unasked.map(q => [q, null])) } },
      decide: a => ({ move: a.ask.choice, probs: a.ask.probabilities, why: `${game.stillPossible.length} left → ask` }),
    };
    return { state, question: askText, options, jev, ...(forced ? { forced, why: game.stillPossible.length === 1 ? '1 left → code guesses' : 'no questions left → code guesses' } : {}) };
  },

  apply(data, s, move) {
    const t = tableFor(data, s);
    const secret = s.secrets[s.r];
    const turns = s.turns + 1;
    const next = (res, note) => ({ s: { ...s, r: s.r + 1, answers: [], guessed: [], turns: 0, results: [...s.results, res] }, note, round: res });
    let out;
    if (typeof move === 'string' && move.startsWith(GUESS)) {
      const g = move.slice(GUESS.length);
      if (g === secret) return next({ secret, turns, solved: true }, `${g}? Yes! (${turns} turns)`);
      out = { s: { ...s, turns, guessed: [...s.guessed, g] }, note: `${g}? No.` };
    } else if (typeof move === 'string' && Object.hasOwn(t.questions, move) && !s.answers.some(a => a.question === move)) {
      const a = answer(t, secret, move);
      out = { s: { ...s, turns, answers: [...s.answers, { question: move, answer: a }] }, note: `${move} ${a}` };
    } else {
      out = { s: { ...s, turns }, note: `not a legal move: ${String(move).slice(0, 60)}` };
    }
    if (turns >= MAX_TURNS) return next({ secret, turns: MISS_TURNS, solved: false }, `Out of turns. It was ${secret}. (counts as ${MISS_TURNS})`);
    return out;
  },

  result(s) {
    const turns = s.results.reduce((a, r) => a + r.turns, 0);
    return { score: -turns, turns, solved: s.results.filter(r => r.solved).length, headline: `${turns} turns`,
      detail: s.results.map(r => `${r.secret}: ${r.solved ? r.turns : 'missed'}`).join(' · ') };
  },
};
