// 20 Questions. A secret thing from one category's list: Animals (35, a hand-written table),
// Household objects or Foods (data/twenty/*.json, tables answered by Jev offline and
// spot-checked, see data/twenty/build.mjs). Each turn a racer either asks one of the yes/no
// questions it hasn't asked yet, or guesses a thing it hasn't guessed yet. Code answers from
// the table, so every racer hears the same truth. Fewest turns wins.
//
// Type anything: the person running the demo can type any thing ("toaster"). It joins the
// category's list (sorted in, so it doesn't stand out), and Jev answers the category's
// questions about it once, before the race (oracleTurn: one Noul per question, yes if >= 0.5).
// The thing and its answers live in the game state (`s.custom`), so the server can rebuild
// any turn from `s` alone. Every lane hears the same answers.
//
// Every racer (Jev, the LLMs, You) sees `still_possible`: the things that fit every answer
// so far and haven't been guessed. Code already knows this from the answers, the way you'd
// cross animals off a sheet of paper, so it goes in the state instead of making each racer
// redo the bookkeeping. (Without it, Jev never became sure and missed a giraffe after 20
// questions.) What's left is the real skill: picking the question that splits what's left.
//
// Jev doesn't get "what's your next move?". It gets two judgments in one request, and code
// decides (the truth-table pattern):
//   ask   (Choice) Which question splits `still_possible` closest to half and half?
//   guess (Choice) Which thing in `still_possible` is it most likely to be?
//   -> 3 or fewer left: guess (guessing beats asking there, on average).
//      Otherwise: ask.  (No questions or turns left: guess.)
//
// Pure module: the server, the browser and the /jev/races/move Pages function all run it.

const ANIMALS = ['dog', 'cat', 'horse', 'cow', 'pig', 'sheep', 'chicken', 'duck', 'eagle', 'owl', 'penguin', 'parrot',
  'shark', 'goldfish', 'salmon', 'dolphin', 'whale', 'lion', 'tiger', 'elephant', 'giraffe', 'zebra', 'gorilla',
  'kangaroo', 'bat', 'mouse', 'rabbit', 'frog', 'snake', 'crocodile', 'turtle', 'bee', 'butterfly', 'ant', 'spider'];

// Each question, and the animals for which the answer is yes. Everything else is no.
const QUESTIONS = {
  'Is it a mammal?': 'dog cat horse cow pig sheep dolphin whale lion tiger elephant giraffe zebra gorilla kangaroo bat mouse rabbit',
  'Is it a bird?': 'chicken duck eagle owl penguin parrot',
  'Is it a fish?': 'shark goldfish salmon',
  'Is it a reptile?': 'snake crocodile turtle',
  'Is it an insect?': 'bee butterfly ant',
  'Does it live in the ocean?': 'penguin shark salmon dolphin whale',
  'Can it fly?': 'duck eagle owl parrot bat bee butterfly',
  'Is an adult heavier than an adult human?': 'horse cow pig shark dolphin whale lion tiger elephant giraffe zebra gorilla crocodile',
  'Is it a common pet?': 'dog cat goldfish parrot rabbit',
  'Is it raised on farms?': 'horse cow pig sheep chicken duck',
  'Does it mostly eat other animals?': 'dog cat eagle owl penguin shark salmon dolphin whale lion tiger bat frog snake crocodile spider',
  'Does it have stripes or spots?': 'tiger zebra giraffe bee',
  'Does it live on the African savanna?': 'lion elephant giraffe zebra',
  'Does it walk on four legs?': 'dog cat horse cow pig sheep lion tiger elephant giraffe zebra gorilla mouse rabbit frog crocodile turtle',
  'Does it have hooves?': 'horse cow pig sheep giraffe zebra',
  'Is it mostly active at night?': 'owl bat mouse',
  'Does it lay eggs?': 'chicken duck eagle owl penguin parrot goldfish salmon frog snake crocodile turtle bee butterfly ant spider',
  'Could an adult fit in your hand?': 'goldfish mouse frog bee butterfly ant spider',
  'Does it have more than four legs?': 'bee butterfly ant spider',
  'Is it mostly black and white?': 'penguin zebra',
  'Does it move by hopping?': 'kangaroo rabbit frog',
  'Is it in the cat family?': 'cat lion tiger',
  'Do people ride it?': 'horse elephant',
  'Do people drink its milk?': 'cow sheep',
  'Is an adult longer than a bus?': 'whale',
};

// A category: `key` names its list in the racers' state, `noun` is one of them.
const ANIMAL_CAT = {
  id: 'animals', title: 'Animals', key: 'animals', noun: 'animal', items: ANIMALS,
  questions: Object.fromEntries(Object.entries(QUESTIONS).map(([q, list]) => [q, list.split(' ')])),
  sets: { a: ['frog', 'giraffe', 'owl'], b: ['dolphin', 'ant', 'sheep'], c: ['kangaroo', 'eagle', 'goldfish'] },
};
const FILES = ['objects', 'foods']; // data/twenty/<id>.json, same shape as ANIMAL_CAT
const MAX_TURNS = 20;
const GUESS = 'Guess: ';
const LEGACY = new Set(['a', 'b', 'c', 'one']); // animal case ids from before categories: 'a', 'one:frog'

// A typed thing: trimmed, lower case, at most 40 characters, letters/digits/spaces and a
// little punctuation. null if it isn't usable.
export function cleanThing(x) {
  if (typeof x !== 'string') return null;
  const t = x.trim().toLowerCase().replace(/\s+/g, ' ');
  return t.length && t.length <= 40 && /^[\p{L}\p{N}][\p{L}\p{N} '’.&-]*$/u.test(t) ? t : null;
}

// Case ids: '<cat>:<set>' (three fixed secrets), '<cat>:one:<item>', '<cat>:set:<a>|<b>|<c>'
// (3 random secrets, picked by the page), '<cat>:type:<thing>' (a typed thing; needs its
// answers from oracleTurn). Animals also keep their old ids: 'a', 'one:frog'.
export function parseCase(caseId) {
  const parts = String(caseId).split(':');
  const cat = LEGACY.has(parts[0]) ? 'animals' : parts.shift();
  const [kind, ...rest] = parts;
  return { cat, kind, arg: rest.join(':') };
}

const prepCat = c => ({ ...c, yes: Object.fromEntries(Object.entries(c.questions).map(([q, list]) => [q, new Set(list)])) });

// The category as this game plays it: with a typed thing sorted into the list.
function catFor(data, s) {
  const c = data.cats[s.cat ?? 'animals'];
  if (!c) throw new Error('unknown category');
  if (!s.custom) return c;
  const { thing, row } = s.custom;
  if (cleanThing(thing) !== thing || !row || typeof row !== 'object') throw new Error('bad typed thing');
  const qs = Object.keys(c.questions);
  if (Object.keys(row).length !== qs.length || qs.some(q => row[q] !== 'yes' && row[q] !== 'no')) throw new Error('bad answers for the typed thing');
  if (c.items.includes(thing)) return c;
  return { ...c, items: [...c.items, thing].sort((a, b) => a.localeCompare(b)), row, thing };
}

const answer = (c, secret, q) => (secret === c.thing ? c.row[q] === 'yes' : c.yes[q].has(secret)) ? 'yes' : 'no';
// The things that fit every answer so far and haven't been guessed yet.
const stillPossible = (c, s) => c.items.filter(a => !s.guessed.includes(a) && s.answers.every(x => answer(c, a, x.question) === x.answer));

// Jev as the oracle for a typed thing: one request, one Noul per question of the category.
// The offline tables (data/twenty/build.mjs) were made the same way.
export function oracleTurn(cat, thing) {
  const qs = Object.keys(cat.questions);
  return {
    jev: {
      state: { category: cat.title.toLowerCase(), thing },
      questions: Object.fromEntries(qs.map((q, i) => ['q' + (i + 1), { type: 'noul', instructions: `About ${thing}: ${q}`,
        criteria: { true: `Yes, this is usually true of ${thing}.`, false: `No, this is usually not true of ${thing}.` } }])),
      // The "move" is the thing and its answers, which init takes as extra.oracle.
      decide: a => ({ move: { thing, row: Object.fromEntries(qs.map((q, i) => [q, a['q' + (i + 1)].noul >= 0.5 ? 'yes' : 'no'])) } }),
    },
  };
}

// The oracle request for a typed thing in a category, or null if it needs none (it's already
// on the list) or isn't valid. The server calls this with what the page sent.
export function oracleFor(data, category, thing) {
  const c = typeof category === 'string' && Object.hasOwn(data.cats, category) ? data.cats[category] : null;
  const t = cleanThing(thing);
  if (!c || !t || c.items.includes(t)) return null;
  return { ask: { category, thing: t }, turn: oracleTurn(c, t) };
}

export const _table = { cats: () => ({ animals: prepCat(ANIMAL_CAT) }), answer, stillPossible, catFor }; // for checks

export default {
  id: 'twenty',
  title: '20 Questions',
  blurb: 'A secret animal, household object or food, or anything you type. Ask yes/no questions or guess. Fewest turns wins.',
  steps: 'turns',

  async load(readJson) {
    const cats = { animals: prepCat(ANIMAL_CAT) };
    for (const [id, c] of await Promise.all(FILES.map(async f => [f, await readJson(`twenty/${f}.json`)]))) cats[id] = prepCat(c);
    return { cats };
  },

  // The page shows these grouped by category. "Pick one" and "Type anything" get a second
  // control on the page (render/twenty.js) that completes the id.
  cases: data => Object.values(data.cats).flatMap(c => [
    ...Object.keys(c.sets).map(k => ({ id: c.id === 'animals' ? k : `${c.id}:${k}`, label: `Three secrets (set ${k.toUpperCase()})`, group: c.title })),
    { id: `${c.id}:random`, label: '3 random secrets', group: c.title },
    { id: `${c.id}:one`, label: 'Pick one secret…', group: c.title },
    { id: `${c.id}:type`, label: 'Type anything…', group: c.title },
  ]),

  // A concrete case id: '<cat>:random' becomes three random secrets. The page and the CLI
  // call this once per race, so every lane plays the same secrets.
  resolve(data, caseId) {
    const { cat, kind } = parseCase(caseId);
    if (kind !== 'random' || !data.cats[cat]) return caseId;
    const pool = [...data.cats[cat].items];
    const picks = Array.from({ length: 3 }, () => pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return `${cat}:set:${picks.join('|')}`;
  },

  // A typed thing needs Jev's answers before the race starts: { ask, turn } or null.
  oracle(data, caseId) {
    const { cat, kind, arg } = parseCase(caseId);
    return kind === 'type' ? oracleFor(data, cat, arg) : null;
  },
  oracleFor, // (data, category, thing): what the move endpoint calls with the page's { oracle: { category, thing } }

  // extra: { oracle: { thing, row } } for a typed thing (oracleTurn's answers).
  init(data, caseId, extra) {
    const { cat, kind, arg } = parseCase(caseId);
    const c = data.cats[cat];
    if (!c) throw new Error(`No category "${cat}"`);
    const base = { cat, r: 0, answers: [], guessed: [], turns: 0, results: [] };
    if (kind === 'type') {
      const thing = cleanThing(arg);
      if (!thing) throw new Error('Type a thing (letters and spaces, up to 40 characters)');
      if (c.items.includes(thing)) return { ...base, secrets: [thing] };
      if (extra?.oracle?.thing !== thing) throw new Error(`No answers yet for "${thing}"`);
      return { ...base, secrets: [thing], custom: { thing, row: extra.oracle.row } };
    }
    const secrets = kind === 'one' ? [arg] : kind === 'set' ? arg.split('|') : c.sets[kind];
    if (!secrets?.length || secrets.some(x => !c.items.includes(x))) throw new Error(`Unknown case "${caseId}"`);
    return { ...base, secrets };
  },

  done: s => s.r >= s.secrets.length,

  turn(data, s) {
    const c = catFor(data, s);
    const asked = new Set(s.answers.map(a => a.question));
    const questions = Object.keys(c.questions).filter(q => !asked.has(q));
    const things = c.items.filter(a => !s.guessed.includes(a));
    const possible = stillPossible(c, s);
    // Animals keep the exact state they had before categories, so their recordings still replay.
    const state = {
      game: `I am thinking of one ${c.noun} from \`${c.key}\`. Find it in as few turns as possible.`,
      [c.key]: c.items,
      answers: s.answers.map(a => `${a.question} ${a.answer}`),
      ...(s.guessed.length ? { wrong_guesses: s.guessed } : {}),
      still_possible: possible,
      turns_left: MAX_TURNS - s.turns,
    };
    const options = [...questions.map(q => ({ name: q })), ...things.map(a => ({ name: GUESS + a }))];
    const jev = {
      state,
      questions: {
        ask: { type: 'choice', instructions: `Which yes/no question splits the ${c.key} in \`still_possible\` into two groups closest to equal size?`,
          criteria: Object.fromEntries(questions.map(q => [q, null])) },
        guess: { type: 'choice', instructions: `Which ${c.noun} in \`still_possible\` am I most likely thinking of?`, criteria: Object.fromEntries(possible.map(a => [a, null])) },
      },
      decide(a) {
        const guessNow = possible.length <= 3 || !questions.length || state.turns_left <= 1;
        return guessNow
          ? { move: GUESS + a.guess.choice, probs: a.guess.probabilities, why: `${possible.length} left → guess` }
          : { move: a.ask.choice, probs: a.ask.probabilities, why: `${possible.length} left → ask` };
      },
    };
    return { state, question: 'What is your next move?', options, jev };
  },

  apply(data, s, move) {
    const c = catFor(data, s);
    const secret = s.secrets[s.r];
    const turns = s.turns + 1;
    const next = (res, note) => ({ s: { ...s, r: s.r + 1, answers: [], guessed: [], turns: 0, results: [...s.results, res] }, note, round: res });
    let out;
    if (move?.startsWith(GUESS)) {
      const g = move.slice(GUESS.length);
      if (g === secret) return next({ secret, turns, solved: true }, `${g}? Yes! (${turns} turns)`);
      out = { s: { ...s, turns, guessed: [...s.guessed, g] }, note: `${g}? No.` };
    } else if (move && Object.hasOwn(c.questions, move)) {
      const a = answer(c, secret, move);
      out = { s: { ...s, turns, answers: [...s.answers, { question: move, answer: a }] }, note: `${move} ${a}` };
    } else {
      out = { s: { ...s, turns }, note: 'no valid move' };
    }
    if (turns >= MAX_TURNS) return next({ secret, turns: MAX_TURNS + 5, solved: false }, `Out of turns. It was ${secret}. (+5 penalty)`);
    return out;
  },

  result(s) {
    const turns = s.results.reduce((a, r) => a + r.turns, 0);
    return { score: -turns, headline: `${turns} turns`, detail: s.results.map(r => `${r.secret}: ${r.solved ? r.turns : 'missed'}`).join(' · ') };
  },
};
