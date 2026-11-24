// 20 Questions. A secret animal from a list of 35. Each turn a racer either asks one of the
// yes/no questions it hasn't asked yet, or guesses an animal it hasn't guessed yet. Code
// answers from a fixed table, so every racer hears the same truth. Fewest turns wins.
//
// Every racer (Jev, the LLMs, You) sees `still_possible`: the animals that fit every answer
// so far and haven't been guessed. Code already knows this from the answers, the way you'd
// cross animals off a sheet of paper, so it goes in the state instead of making each racer
// redo the bookkeeping. (Without it, Jev never became sure and missed a giraffe after 20
// questions.) What's left is the real skill: picking the question that splits what's left.
//
// Jev doesn't get "what's your next move?". It gets two judgments in one request, and code
// decides (the truth-table pattern):
//   ask   (Choice) Which question splits `still_possible` closest to half and half?
//   guess (Choice) Which animal in `still_possible` is it most likely to be?
//   -> 3 or fewer animals left: guess (guessing beats asking there, on average).
//      Otherwise: ask.  (No questions or turns left: guess.)

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
const YES = Object.fromEntries(Object.entries(QUESTIONS).map(([q, list]) => [q, new Set(list.split(' '))]));

const answer = (secret, q) => YES[q].has(secret) ? 'yes' : 'no';
// The animals that fit every answer so far and haven't been guessed yet.
const stillPossible = s => ANIMALS.filter(a => !s.guessed.includes(a) && s.answers.every(x => answer(a, x.question) === x.answer));
const MAX_TURNS = 20;
const SECRETS = { a: ['frog', 'giraffe', 'owl'], b: ['dolphin', 'ant', 'sheep'], c: ['kangaroo', 'eagle', 'goldfish'] };
const GUESS = 'Guess: ';

export const _table = { ANIMALS, YES, answer, stillPossible }; // for checking the table (every animal has its own answers)

export default {
  id: 'twenty',
  title: '20 Questions',
  blurb: 'A secret animal from a list of 35. Ask yes/no questions or guess. Fewest turns wins, three secrets per race.',
  steps: 'turns',

  load: async () => ({}),
  cases: () => [
    ...Object.entries(SECRETS).map(([id, list]) => ({ id, label: `Three secrets (set ${id.toUpperCase()})` })),
    ...ANIMALS.map(a => ({ id: 'one:' + a, label: `One secret: ${a}` })),
  ],

  init(_, caseId) {
    const secrets = caseId.startsWith('one:') ? [caseId.slice(4)] : SECRETS[caseId];
    return { secrets, r: 0, answers: [], guessed: [], turns: 0, results: [] };
  },

  done: s => s.r >= s.secrets.length,

  turn(_, s) {
    const asked = new Set(s.answers.map(a => a.question));
    const questions = Object.keys(QUESTIONS).filter(q => !asked.has(q));
    const animals = ANIMALS.filter(a => !s.guessed.includes(a));
    const possible = stillPossible(s);
    const state = {
      game: 'I am thinking of one animal from `animals`. Find it in as few turns as possible.',
      animals: ANIMALS,
      answers: s.answers.map(a => `${a.question} ${a.answer}`),
      ...(s.guessed.length ? { wrong_guesses: s.guessed } : {}),
      still_possible: possible,
      turns_left: MAX_TURNS - s.turns,
    };
    const options = [...questions.map(q => ({ name: q })), ...animals.map(a => ({ name: GUESS + a }))];
    const jev = {
      state,
      questions: {
        ask: { type: 'choice', instructions: 'Which yes/no question splits the animals in `still_possible` into two groups closest to equal size?',
          criteria: Object.fromEntries(questions.map(q => [q, null])) },
        guess: { type: 'choice', instructions: 'Which animal in `still_possible` am I most likely thinking of?', criteria: Object.fromEntries(possible.map(a => [a, null])) },
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

  apply(_, s, move) {
    const secret = s.secrets[s.r];
    const turns = s.turns + 1;
    const next = (res, note) => ({ s: { ...s, r: s.r + 1, answers: [], guessed: [], turns: 0, results: [...s.results, res] }, note, round: res });
    let out;
    if (move?.startsWith(GUESS)) {
      const g = move.slice(GUESS.length);
      if (g === secret) return next({ secret, turns, solved: true }, `${g}? Yes! (${turns} turns)`);
      out = { s: { ...s, turns, guessed: [...s.guessed, g] }, note: `${g}? No.` };
    } else if (move && QUESTIONS[move]) {
      const a = answer(secret, move);
      out = { s: { ...s, turns, answers: [...s.answers, { question: move, answer: a }] }, note: `${move} ${a}` };
    } else {
      out = { s: { ...s, turns }, note: 'no valid move' };
    }
    if (turns >= MAX_TURNS) return next({ secret, turns: MAX_TURNS + 5, solved: false }, `Out of turns. It was a ${secret}. (+5 penalty)`);
    return out;
  },

  result(s) {
    const turns = s.results.reduce((a, r) => a + r.turns, 0);
    return { score: -turns, headline: `${turns} turns`, detail: s.results.map(r => `${r.secret}: ${r.solved ? r.turns : 'missed'}`).join(' · ') };
  },
};
