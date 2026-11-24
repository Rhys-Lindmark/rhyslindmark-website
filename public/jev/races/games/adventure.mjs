// Text adventure speedrun: small original adventures. Each turn a racer picks one command
// from the commands that make sense in the room (like the links on a WikiRace page). Fewest
// moves to reach the goal wins.
//
//   gull-rock  "The Lamp at Gull Rock": light the lighthouse before the ship hits the rocks.
//   wren-ridge "The Radio on Wren Ridge": radio the rescue team from the ridge in a snowstorm.
//
// The engine (memory, needs, what each racer sees) is shared; each world is just rooms,
// items and commands.

const has = (s, i) => s.inv.includes(i);
const here = (s, i) => s.where[i] === s.room;

// ---------- World 1: The Lamp at Gull Rock ----------

const gullRock = {
  label: 'The Lamp at Gull Rock',
  goal: 'Light the great lamp at the top of the lighthouse before the ship hits the rocks.',
  aim: 'lighting the great lamp',
  best: 17, max: 40,
  items: {
    driftwood: 'a piece of driftwood', rope: 'a coil of rope', lantern: 'a brass lantern', matches: 'a box of matches',
    logbook: "the keeper's logbook", key: 'an iron key', oil: 'a can of lamp oil', pickles: 'a jar of pickles', spyglass: 'a spyglass',
  },
  start: {
    room: 'beach',
    where: { driftwood: 'beach', rope: 'dock', lantern: 'cottage', matches: 'cottage', logbook: 'cottage', key: 'cellar', oil: 'cellar', pickles: 'cellar', spyglass: 'watch' },
    flags: { drawer: false, lanternLit: false, doorOpen: false, lampOil: false },
  },
  // For the race page: a grid of map cells, north at the top. 'a+b' stacks floors, top first.
  map: [['', 'lamp+watch+base', ''], ['cottage+cellar', 'path', ''], ['', 'beach', 'dock']],
  dark: s => s.room === 'cellar' && !s.flags.lanternLit,
  room(s) {
    const f = s.flags;
    return {
      beach: ['Gull Rock Beach', 'Cold surf on grey sand. A path climbs north toward the cliffs. A wooden dock runs east.'],
      dock: ['The Dock', 'A rowboat with no oars knocks against the posts. The beach is west.'],
      path: ['Cliff Path', `The lighthouse stands to the north; its door is ${f.doorOpen ? 'open' : 'shut, with a heavy iron lock'}. The keeper's cottage is west. The beach is south.`],
      cottage: ["Keeper's Cottage", `A table with a drawer${f.drawer ? ' (open)' : ''}, a cold stove, and a trapdoor with steps going down. The door out is east.`],
      cellar: this.dark(s) ? ['Cellar', "Pitch black. You can't see a thing. The steps lead back up."] : ['Cellar', 'Shelves of jars and tools in the lantern light. The steps lead up.'],
      base: ['Lighthouse Base', 'An iron spiral stair winds up into the tower. The door is south.'],
      watch: ['Watch Room', "A window looks out on the storm. Far out, a ship's lights are heading for the rocks. The stair goes up and down."],
      lamp: ['Lamp Room', `The great lamp, taller than you. ${f.lampOil ? 'Its reservoir is full of oil.' : 'Its oil reservoir is dry.'} The stair goes down.`],
    }[s.room];
  },
  hidden: s => s.room === 'cottage' && !s.flags.drawer ? ['matches'] : [],
  commands(s, c, go) {
    switch (s.room) {
      case 'beach': go('north', 'path'); go('east', 'dock'); break;
      case 'dock': go('west', 'beach'); c['get in the rowboat'] = () => 'You sit in the rowboat. With no oars it goes nowhere. You climb out.'; break;
      case 'path':
        go('south', 'beach'); go('west', 'cottage'); go('north', 'base', s.flags.doorOpen, 'The lighthouse door is locked.');
        if (!s.flags.doorOpen) {
          c['knock on the lighthouse door'] = () => 'Nobody answers. The keeper is gone.';
          c['unlock the door with the key'] = has(s, 'key') ? st => { st.flags.doorOpen = true; return 'The lock turns. The door swings open.'; } : () => 'You have no key.';
        }
        break;
      case 'cottage':
        go('east', 'path'); go('down', 'cellar');
        if (!s.flags.drawer) c['open the drawer'] = st => { st.flags.drawer = true; return 'Inside the drawer: a box of matches.'; };
        c['light the stove'] = has(s, 'matches') ? () => 'The stove crackles. Warm, but the lighthouse is still dark.' : () => 'You have nothing to light it with.';
        break;
      case 'cellar':
        go('up', 'cottage');
        if (this.dark(s)) c['feel around in the dark'] = () => "You stub your toe on something. You still can't see.";
        break;
      case 'base': go('south', 'path'); go('up', 'watch'); break;
      case 'watch': go('down', 'base'); go('up', 'lamp'); c['look out the window'] = () => 'The ship is closer now.'; break;
      case 'lamp':
        go('down', 'watch');
        c['fill the lamp with oil'] = has(s, 'oil') ? st => { st.flags.lampOil = true; return 'You pour the oil in. The reservoir is full.'; } : () => 'You have no oil.';
        c['light the lamp'] = !has(s, 'matches') ? () => 'You have nothing to light it with.'
          : !s.flags.lampOil ? () => 'The wick flares and dies. The lamp has no oil.'
          : st => { st.won = true; return 'The great lamp blazes. The ship turns away from the rocks. You win!'; };
        break;
    }
    if (has(s, 'logbook') || (s.room === 'cottage' && here(s, 'logbook'))) c['read the logbook'] = () => 'Last entry: "Spare key and oil are in the cellar. Mind the dark."';
    if (has(s, 'lantern') && !s.flags.lanternLit) c['light the lantern'] = has(s, 'matches') ? st => { st.flags.lanternLit = true; return 'The lantern glows.'; } : () => 'You have nothing to light it with.';
    if (has(s, 'spyglass')) c['look through the spyglass'] = () => 'The ship is very close to the rocks.';
    c['wait'] = () => 'Time passes. The storm grows.';
  },
  // What's blocking you. A failed command says why ("You have no key."), so code keeps the
  // list and drops a need once it's met.
  needs: {
    door: { text: 'unlocking the lighthouse door', when: /door is locked/, met: s => s.flags.doorOpen },
    key: { text: 'finding a key', when: /no key/, met: s => has(s, 'key') },
    fire: { text: 'finding something to light things with', when: /nothing to light/, met: s => has(s, 'matches') },
    oil: { text: 'finding lamp oil', when: /no oil/i, met: s => has(s, 'oil') },
    light: { text: 'lighting your way in the dark cellar', when: /can't see|Pitch black/, met: s => s.flags.lanternLit },
  },
};

// ---------- World 2: The Radio on Wren Ridge ----------

const wrenRidge = {
  label: 'The Radio on Wren Ridge',
  goal: 'Radio the rescue team from the hut on top of Wren Ridge before the snow buries the trail.',
  aim: 'radioing the rescue team',
  best: 13, max: 35,
  items: {
    kettle: 'a tin kettle', note: 'a note pinned to the door', biscuits: 'a tin of biscuits', guitar: 'a guitar',
    shovel: 'a snow shovel', sled: 'a wooden sled', snowshoes: 'a pair of snowshoes', battery: 'a radio battery', axe: 'a splitting axe',
  },
  start: {
    room: 'cabin',
    where: { kettle: 'cabin', note: 'cabin', biscuits: 'cabin', guitar: 'cabin', shovel: 'yard', sled: 'yard', snowshoes: 'shed', battery: 'shed', axe: 'shed' },
    flags: { hot: false, shedOpen: false, wearing: false, powered: false },
  },
  map: [['', 'summit', ''], ['', 'trail', ''], ['', 'yard', 'shed'], ['', 'cabin', '']],
  dark: () => false,
  room(s) {
    const f = s.flags;
    return {
      cabin: ['Log Cabin', 'A stove burns low. Snow hisses at the window. The door out is north.'],
      yard: ['Snowy Yard', `A tool shed stands east; its door is ${f.shedOpen ? 'open' : 'frozen shut under a sheet of ice'}. The trail up the ridge starts north, buried in deep snow. The cabin is south.`],
      shed: ['Tool Shed', 'Cold and cramped, with hooks on every wall. The yard is west.'],
      trail: ['Ridge Trail', 'A steep trail through the pines, marked with red posts. The ridge top is north. The yard is south.'],
      summit: ['Radio Hut', `A tiny hut at the top of the ridge, under the radio mast. A radio sits on a shelf, ${f.powered ? 'its dial glowing' : 'dark and silent'}. The trail is south.`],
    }[s.room];
  },
  hidden: () => [],
  commands(s, c, go) {
    switch (s.room) {
      case 'cabin':
        go('north', 'yard');
        c['warm your hands at the stove'] = () => 'Your fingers tingle back to life.';
        if (has(s, 'kettle') && !s.flags.hot) c['heat the kettle on the stove'] = st => { st.flags.hot = true; return 'The kettle steams. The water is hot.'; };
        break;
      case 'yard':
        go('south', 'cabin'); go('east', 'shed', s.flags.shedOpen, 'The shed door is frozen shut.');
        go('north', 'trail', s.flags.wearing, 'The snow is waist-deep. You sink to your hips and climb back out.');
        if (!s.flags.shedOpen) {
          c['pour hot water on the shed door'] = has(s, 'kettle') && s.flags.hot
            ? st => { st.flags.shedOpen = true; st.flags.hot = false; return 'The ice cracks and slides off. The shed door swings open.'; }
            : () => 'You have no hot water.';
          if (has(s, 'shovel')) c['dig at the shed door with the shovel'] = () => 'The shovel skids off the ice. The door stays frozen.';
        }
        break;
      case 'shed': go('west', 'yard'); break;
      case 'trail': go('south', 'yard'); go('north', 'summit'); break;
      case 'summit':
        go('south', 'trail');
        if (!s.flags.powered) c['put the battery in the radio'] = has(s, 'battery') ? st => { st.flags.powered = true; return 'The radio crackles to life.'; } : () => 'You have no battery.';
        c['call the rescue team on the radio'] = s.flags.powered
          ? st => { st.won = true; return '"Rescue team here. We hear you. On our way." You win!'; }
          : () => 'The radio is dead. It has no battery.';
        break;
    }
    if (has(s, 'note') || here(s, 'note')) c['read the note'] = () => 'It says: "Gone up to fix the mast. Spare battery and snowshoes are in the shed. - M."';
    if (has(s, 'snowshoes') && !s.flags.wearing) c['put on the snowshoes'] = st => { st.flags.wearing = true; return 'You strap on the snowshoes.'; };
    if (has(s, 'biscuits')) c['eat a biscuit'] = () => 'Crumbly and good. Nothing else happens.';
    if (has(s, 'guitar')) c['play the guitar'] = () => 'A cold, out-of-tune chord. Nobody hears it.';
    c['wait'] = () => 'Time passes. The snow gets deeper.';
  },
  needs: {
    shed: { text: 'opening the frozen shed door', when: /frozen shut/, met: s => s.flags.shedOpen },
    hot: { text: 'getting hot water', when: /no hot water/, met: s => s.flags.hot || s.flags.shedOpen },
    snow: { text: 'getting through the deep snow', when: /waist-deep/, met: s => s.flags.wearing },
    battery: { text: 'finding a battery for the radio', when: /no battery/, met: s => has(s, 'battery') || s.flags.powered },
  },
};

const WORLDS = { 'gull-rock': gullRock, 'wren-ridge': wrenRidge };

// ---------- The engine ----------

const W = s => WORLDS[s.world];

function describe(s) {
  const w = W(s), [name, text] = w.room(s);
  const seen = w.dark(s) ? [] : Object.keys(w.items).filter(i => here(s, i) && !w.hidden(s).includes(i)).map(i => w.items[i]);
  return { name, description: text + (seen.length ? ' You see: ' + seen.join(', ') + '.' : '') };
}

// Every command that makes sense in this room, with what it does.
function commands(s) {
  const w = W(s), c = {};
  const go = (dir, room, ok = true, no) => { c['go ' + dir] = ok ? st => { st.room = room; } : () => no; };
  w.commands(s, c, go);
  if (!w.dark(s)) for (const i of Object.keys(w.items)) if (here(s, i) && !w.hidden(s).includes(i))
    c['take ' + i] = st => { st.inv.push(i); st.where[i] = 'you'; return `Taken: ${w.items[i]}.`; };
  return c;
}

const clone = s => ({ ...s, inv: [...s.inv], log: [...s.log], where: { ...s.where }, flags: { ...s.flags }, seen: { ...s.seen }, tried: { ...s.tried }, needs: [...s.needs] });

function updateNeeds(st, result) {
  const N = W(st).needs;
  for (const [id, n] of Object.entries(N)) if (n.when.test(result) && !st.needs.includes(id)) st.needs.push(id);
  st.needs = st.needs.filter(id => !N[id].met(st));
}

// What a player remembers, the same for every racer: the rooms seen so far, what each command
// did, and which commands were already tried in exactly this situation (same room, items, flags).
const fingerprint = s => JSON.stringify([s.room, s.inv, s.where, s.flags]);
const remember = s => { const d = describe(s); s.seen[d.name] = d.description; };

export default {
  id: 'adventure',
  title: 'Text Adventure Speedrun',
  blurb: 'A tiny original text adventure. Pick every command; fewest moves to the goal wins.',
  steps: 'moves',

  load: async () => ({ worlds: Object.fromEntries(Object.entries(WORLDS).map(([id, w]) =>
    [id, { label: w.label, goal: w.goal, best: w.best, max: w.max, map: w.map,
      names: Object.fromEntries(w.map.flat().flatMap(c => c ? c.split('+') : []).map(r => [r, w.room({ ...w.start, room: r, flags: { ...w.start.flags } })[0]])) }])) }),
  cases: () => Object.entries(WORLDS).map(([id, w]) => ({ id, label: `${w.label} (best ${w.best})` })),
  init: (_, caseId = 'gull-rock') => {
    const w = WORLDS[caseId] ? caseId : 'gull-rock';
    const s = { world: w, ...clone({ ...WORLDS[w].start, inv: [], log: [], seen: {}, tried: {}, needs: [] }), moves: 0, won: false, lost: false };
    remember(s); return s;
  },
  done: s => s.won || s.lost,

  turn(_, s) {
    const w = W(s), room = describe(s);
    const state = {
      goal: w.goal,
      room,
      inventory: s.inv.map(i => w.items[i]),
      rooms_seen: s.seen,
      ...(s.needs.length ? { still_needed: s.needs.map(id => w.needs[id].text) } : {}),
      // Every command so far and what it did, so a clue read ten moves ago (or a failure
      // that said why) is still in front of the player.
      ...(s.log.length ? { last_result: s.log[s.log.length - 1].result, history: s.log.map(l => `${l.cmd} → ${l.result}`) } : {}),
      moves_left: w.max - s.moves,
    };
    // Like WikiRace leaving out articles already visited: a command already tried in exactly
    // this situation would only do the same thing again, so it isn't offered. If that leaves
    // nothing, everything is offered again.
    const all = Object.keys(commands(s));
    const fresh = all.filter(name => !(fingerprint(s) + name in s.tried));
    const options = (fresh.length ? fresh : all).map(name => ({ name }));
    const question = `Which command gets you closest to ${w.aim}?`;

    // Jev gets judgments it can make at a glance, and code decides the move:
    //   want_<item> (Noul, one per item you could take here) Would someone after the goal pick it up?
    //   move (Choice) Which command gets you closest to the newest thing you still need (else the goal)?
    //   -> an item you'll need is here: take it (the likeliest). Otherwise: the move answer.
    // Picking up what's useful as you pass it is a decision, so it lives in code; whether an
    // item is useful is the judgment. Picking which need comes first is code too.
    const need = s.needs.length ? w.needs[s.needs[s.needs.length - 1]].text : null;
    const takeable = options.map(o => o.name).filter(n => n.startsWith('take ')).map(n => n.slice(5));
    const questions = {
      move: { type: 'choice', instructions: need ? `Which command gets you closest to ${need}?` : question, criteria: Object.fromEntries(options.map(o => [o.name, null])) },
      ...Object.fromEntries(takeable.map(i => ['want_' + i, { type: 'noul', instructions: `Would someone trying to reach \`goal\` pick up ${w.items[i]}?`,
        criteria: { true: `They would carry ${w.items[i]} because it helps with the goal.`, false: `They would leave ${w.items[i]} behind because it has nothing to do with the goal.` } }])),
    };
    const jev = { state, questions, decide(a) {
      const want = takeable.map(i => [i, a['want_' + i].noul]).filter(([, p]) => p >= 0.7).sort((x, y) => y[1] - x[1]);
      if (want.length) return { move: 'take ' + want[0][0], probs: Object.fromEntries(takeable.map(i => ['take ' + i, a['want_' + i].noul])), why: `needed: ${want[0][0]} ${want[0][1].toFixed(2)}` };
      return { move: a.move.choice, probs: a.move.probabilities, why: need ? `aiming at: ${need}` : undefined };
    } };
    return { state, question, options, jev };
  },

  apply(_, s, move) {
    const st = clone(s), w = W(s);
    const fn = commands(s)[move];
    const result = fn ? (fn(st) || describe(st).name + (w.dark(st) ? ': pitch black.' : '')) : 'no valid move';
    updateNeeds(st, result);
    st.moves++;
    st.tried[fingerprint(s) + move] = result;
    remember(st);
    st.log.push({ cmd: move ?? '(none)', result });
    if (!st.won && st.moves >= w.max) { st.lost = true; return { s: st, note: `${move} → ${result} Time's up. Game over.` }; }
    return { s: st, note: `${move ?? '(none)'} → ${result}` };
  },

  result(s) {
    const w = W(s);
    return { score: s.won ? -s.moves : -999, headline: s.won ? `${s.moves} moves` : 'Failed', detail: s.won ? `best possible: ${w.best}` : `gave up after ${s.moves}` };
  },
};
