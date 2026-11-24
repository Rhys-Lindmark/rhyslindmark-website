// Text adventure speedrun: small original adventures. Each turn a racer picks one command
// from the commands that make sense in the room (like the links on a WikiRace page). Fewest
// moves to reach the goal wins.
//
//   gull-rock  "The Lamp at Gull Rock": light the lighthouse before the ship hits the rocks.
//   wren-ridge "The Radio on Wren Ridge": radio the rescue team from the ridge in a snowstorm.
//   night-mail "The Brake on the Night Mail": free a stuck brake and signal the driver.
//   larkmoor   "The Valve at Larkmoor Glasshouse": get the sprinklers running before the sun scorches the seedlings.
//   hollin     "The Fuse at Hollin Museum": put the museum's lights back on before the alarm battery dies.
//
// The engine (memory, needs, what each racer sees) is shared; each world is just rooms,
// items and commands, plus a small ASCII picture per room for the race page.

const has = (s, i) => s.inv.includes(i);
const here = (s, i) => s.where[i] === s.room;
// A room picture written flush left between backticks; load() pads every line to the same width.
const pic = t => t.raw[0].replace(/^\n/, '').replace(/\n\s*$/, '').split('\n').map(l => l.trimEnd());

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
  art: {
    beach: pic`
      .        *       .
  ~~    ~~~      ~~~     ~~
~~~~~~~~~~~~~~~~~~~~~~~~~~~~
 ~  ~~~  ~   ~~   ~~~  ~  ~
  .  .  .  .  .  . _ .  .
 . .  .  . .  .  (_)  .  .
`,
    dock: pic`
          ___
  ~  ~    \__/   ~    ~
===|======|=====|======|===
 ~~|~~~~~~|~~~~~|~~~~~~|~~
  ~|  ~   |  ~  |   ~  | ~
 ~ |~   ~ | ~   |~   ~ |  ~
`,
    path: pic`
            /\
           |[]|
           |  |
     ___   |  |   _
    /   \__|__|__/ \_
   /  . . :: :: . .  \
  /  .  :::  :::  .   \
`,
    cottage: pic`
        __||_______
       /           \
      /_____________\
      |  []   _  [] |
      |      | |    |
      |______|_|____|
`,
    cellar: pic`
 _____________________
 |  o   []   o  o  [] |
 |====================|
 | []  o   o  []   o  |
 |====================|
 |   _|               |
 |__|_|_______________|
`,
    base: pic`
     |       /     |
     |      /___   |
     |      ___/   |
     |     /___    |
     |     ___/    |
   __|____/________|__
`,
    watch: pic`
  ______________________
 |  ~  ~   |  ~    ~   |
 |    ~    |     _|_   |
 | ~    ~  | ~~~ \__/ ~|
 |_________|___________|
     |  ===o   |
`,
    lamp: pic`
         _______
        /  \|/  \
       |  - O -  |
        \  /|\  /
         \_____/
       ___|___|___
`,
  },
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
  art: {
    cabin: pic`
   *        ____      *
       ____/    \____
  *   /==============\  *
      |=[]==|  |==[]=|
      |=====|  |=====|
 ~~~~~~~~~~~~~~~~~~~~~~~~~
`,
    yard: pic`
  *     *      ______    *
     *        /      \
  *      *    | |  | |  *
     *        | |-o| |
  ~~.~~.~~.~~.|_|__|_|.~~.
 ~~~~~~~~~~~~~~~~~~~~~~~~~~
`,
    shed: pic`
  _____________________
 |   ?    ?    ?    ?  |
 |   |    |    T    |  |
 |   /    =    |    ]  |
 |  [+-]       ##      |
 |_____________________|
`,
    trail: pic`
    /\        /\     /\
   /  \   |  /  \   /  \
  /____\  |_/____\ /____\
    ||    #   ||     ||
 ...||....|...||.....||...
`,
    summit: pic`
           |
          -+-
          /|\
      ___/_|_\___
     |  [o  o]   |
     |___________|
`,
  },
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

// ---------- World 3: The Brake on the Night Mail ----------

const nightMail = {
  label: 'The Brake on the Night Mail',
  goal: 'Get the stalled night train moving again before the morning express comes up the line behind it.',
  aim: 'getting the train moving again',
  best: 12, max: 35,
  items: {
    pillow: 'a feather pillow', timetable: 'a railway timetable', note: "the guard's note", key: 'a small brass key',
    teapot: 'a pot of tea', crank: 'an iron crank handle', flag: 'a red flag', lamp: 'a green signal lamp',
  },
  start: {
    room: 'compartment',
    where: { pillow: 'compartment', timetable: 'compartment', note: 'dining', key: 'dining', teapot: 'dining', crank: 'baggage', flag: 'van', lamp: 'van' },
    flags: { trunkOpen: false, lockerOpen: false, fitted: false, released: false },
  },
  // The train runs east to the engine; the compartment opens off the corridor.
  map: [['van', 'baggage', 'dining', 'corridor'], ['', '', '', 'compartment']],
  art: {
    compartment: pic`
  ______________________
 | ____________  |  _  |
 ||____________| | | | |
 | ____________  | |o| |
 ||____________| | |_| |
 |_______________|_____|
`,
    corridor: pic`
  _______________________
 | [__]  [__]  [__]  [__]|
 |                       |
 | |  |  |  |  |  |  |  ||
 |_|__|__|__|__|__|__|__||
   ==o====o=======o====o==
`,
    dining: pic`
  ______________________
 |  _    _    _    _    |
 | |_|  |_|  |_|  |_|   |
 |  Y    Y    Y    Y    |
 | =|=  =|=  =|=  =|=   |
 |______________________|
   ==o====o=======o====o==
`,
    baggage: pic`
  ______________________
 |  ___   _____   ___   |
 | |___| |     | |   |  |
 | |___| |_____| |___|  |
 | [##][##]   [=====]   |
 |______________________|
`,
    van: pic`
  ______________________
 |       ___        [ ] |
 |     /  |  \          |
 |    |---o---|    |>   |
 |     \__|__/     |    |
 |________|_____________|
`,
  },
  dark: () => false,
  room(s) {
    const f = s.flags;
    return {
      compartment: ['Sleeping Compartment', 'A narrow bunk, a dark window, frost on the glass. The train has stopped dead in the snow. The door out to the corridor is south.'],
      corridor: ['Corridor', 'A swaying corridor lit by a dim bulb. The engine cab is east. The dining car is west. Your compartment is north.'],
      dining: ['Dining Car', 'White tablecloths and an empty steward\'s counter. A hook by the counter. The baggage car is west. The corridor is east.'],
      baggage: ['Baggage Car', `Mail sacks and suitcases, and a big red trunk${f.trunkOpen ? ' (open)' : ' with a brass lock'}. The guard's van is west. The dining car is east.`],
      van: ["Guard's Van", `The last car. A brake wheel stands in the middle of the floor${f.released ? ', turned loose' : f.fitted ? ', its crank fitted' : ', with no handle on it'}. A steel locker${f.lockerOpen ? ' (open)' : ''} by the back window. The baggage car is east.`],
    }[s.room];
  },
  hidden: s => s.room === 'baggage' && !s.flags.trunkOpen ? ['crank'] : s.room === 'van' && !s.flags.lockerOpen ? ['lamp'] : [],
  commands(s, c, go) {
    const f = s.flags;
    switch (s.room) {
      case 'compartment': go('south', 'corridor'); c['go back to sleep'] = () => 'You doze. The train does not move.'; break;
      case 'corridor':
        go('north', 'compartment'); go('west', 'dining');
        go('east', 'cab', false, 'The cab door is bolted. The driver shouts through it: "The brake is stuck on at the back of the train! Free it, then show me a green light from the guard\'s van!"');
        break;
      case 'dining':
        go('east', 'corridor'); go('west', 'baggage');
        c['ring for the steward'] = () => 'The bell rings. Nobody comes.';
        if (has(s, 'teapot')) c['pour a cup of tea'] = () => 'Lukewarm. The train still does not move.';
        break;
      case 'baggage':
        go('east', 'dining'); go('west', 'van');
        if (!f.trunkOpen) c['unlock the trunk'] = has(s, 'key') ? st => { st.flags.trunkOpen = true; return 'The key turns. Inside the trunk: an iron crank handle.'; } : () => 'The trunk is locked. You have no key.';
        c['search the mail sacks'] = () => 'Letters, parcels, a lot of postcards. Nothing useful.';
        break;
      case 'van':
        go('east', 'baggage');
        if (!f.lockerOpen) c['open the locker'] = st => { st.flags.lockerOpen = true; return 'Inside the locker: a green signal lamp.'; };
        if (has(s, 'crank') && !f.fitted) c['fit the crank to the brake wheel'] = st => { st.flags.fitted = true; return 'The crank slots onto the wheel.'; };
        if (!f.released) c['turn the brake wheel'] = f.fitted ? st => { st.flags.released = true; return 'You heave the crank round and round. With a hiss, the brake lets go.'; } : () => "The wheel has no handle. It needs a crank.";
        if (has(s, 'flag')) c['wave the red flag out the window'] = () => 'Red means stop. The train stays stopped.';
        if (has(s, 'lamp')) c['wave the green lamp out the window'] = f.released
          ? st => { st.won = true; return 'The driver whistles twice. The Night Mail rolls on through the snow. You win!'; }
          : () => 'The driver whistles back. The engine strains, but the brake is still stuck on.';
        break;
    }
    if (has(s, 'note') || here(s, 'note')) c['read the note'] = () => 'It says: "Brake crank is locked in the red trunk in the baggage car. Trunk key on the hook by the counter. - Guard"';
    if (has(s, 'timetable')) c['read the timetable'] = () => 'The morning express is due on this line at dawn.';
    c['wait'] = () => 'Time passes. Somewhere behind you, the express is getting closer.';
  },
  needs: {
    brake: { text: 'freeing the stuck brake', when: /stuck on/, met: s => s.flags.released },
    green: { text: 'finding a green light', when: /green light/, met: s => has(s, 'lamp') },
    key: { text: 'finding the trunk key', when: /no key/, met: s => has(s, 'key') },
    crank: { text: 'finding a crank for the brake wheel', when: /needs a crank/, met: s => has(s, 'crank') || s.flags.fitted },
  },
};

// ---------- World 4: The Valve at Larkmoor Glasshouse ----------

const larkmoor = {
  label: 'The Valve at Larkmoor Glasshouse',
  goal: 'Get the glasshouse sprinklers running before the morning sun scorches the seedlings.',
  aim: 'getting the sprinklers running',
  best: 13, max: 35,
  items: {
    can: 'a watering can', calendar: "the gardener's calendar", trowel: 'a trowel', wrench: 'a pipe wrench', rake: 'a rake', seeds: 'a packet of seeds',
  },
  start: {
    room: 'yard',
    where: { can: 'potting', calendar: 'potting', trowel: 'potting', wrench: 'toolshed', rake: 'toolshed', seeds: 'glasshouse' },
    flags: { knowCode: false, shedOpen: false, loose: false, valveOpen: false },
  },
  map: [['', 'glasshouse+pit', ''], ['potting', 'yard', 'toolshed']],
  art: {
    yard: pic`
    ,    ,    ,    ,    ,
   \|/  \|/  \|/  \|/  \|/
  ~~~~~~~~~~~~~~~~~~~~~~~~~
    ,    ,    ,    ,    ,
   \|/  \|/  \|/  \|/  \|/
  ~~~~~~~~~~~~~~~~~~~~~~~~~
`,
    potting: pic`
  _____________________
 |   _     _     _     |
 |  (_)   (_)   (_)    |
 | ====================|
 |  |      [=]      |  |
 |__|_______________|__|
`,
    toolshed: pic`
        __________
       /          \
      /____________\
      |  |  ||  |  |
      |  |  |o--|  |
      |__|__||__|__|
`,
    glasshouse: pic`
      _________________
     /  /  /  /  /  / |
    /__/__/__/__/__/  |
    |  |  |  |  |  |  |
    | ,|, |,|, |,|,|  /
    |__|__|__|__|__|_/
`,
    pit: pic`
 =====|==========|=====
      |    _|_   |
      |   / | \  |
   ===|==(--+--)=|===
      |   \_|_/  |
 _____|__________|_____
`,
  },
  dark: () => false,
  room(s) {
    const f = s.flags;
    return {
      yard: ['Kitchen Garden', `Rows of cabbages, white with frost. The glasshouse is north. The potting shed is west. The tool shed is east${f.shedOpen ? ', its door open' : ', its door held by a padlock with three number dials'}.`],
      potting: ['Potting Shed', 'Clay pots stacked on a long bench. A calendar hangs on a nail. The garden is east.'],
      toolshed: ['Tool Shed', 'Tools hang on pegs in neat rows. The garden is west.'],
      glasshouse: ['Glasshouse', `Long tables of seedlings under the glass, and a sprinkler pipe overhead. A switch by the door reads SPRINKLERS. A hatch leads down to the valve pit. The garden is south. The sun is coming up.`],
      pit: ['Valve Pit', `A cold brick pit full of pipes. The main water valve has a big iron wheel${f.valveOpen ? ', turned open' : f.loose ? ', freed from the frost' : ', crusted with frost'}. A ladder leads up.`],
    }[s.room];
  },
  hidden: () => [],
  commands(s, c, go) {
    const f = s.flags;
    switch (s.room) {
      case 'yard':
        go('north', 'glasshouse'); go('west', 'potting'); go('east', 'toolshed', f.shedOpen, "The tool shed is padlocked. You'd need the code.");
        if (!f.shedOpen) {
          c['try random numbers on the padlock'] = () => "Click, click, click. It stays locked. You'd need the code.";
          if (f.knowCode) c['dial 3-1-7 on the padlock'] = st => { st.flags.shedOpen = true; return 'The padlock springs open. The tool shed door swings wide.'; };
        }
        break;
      case 'potting':
        go('east', 'yard');
        if (has(s, 'calendar') || here(s, 'calendar')) c['read the calendar'] = st => { st.flags.knowCode = true; return 'Under today\'s date, in pencil: "Shed lock 3-1-7. Main valve sticks in a frost - use the big wrench."'; };
        break;
      case 'toolshed': go('west', 'yard'); break;
      case 'glasshouse':
        go('south', 'yard'); go('down', 'pit');
        c['turn on the sprinklers'] = f.valveOpen
          ? st => { st.won = true; return 'The pipes shudder, then a fine rain falls over every table. The seedlings are saved. You win!'; }
          : () => 'The pipes knock. No water comes. The main valve in the pit must be shut.';
        if (has(s, 'can')) c['water the seedlings with the can'] = () => 'You water one table. There are forty more, and the can is empty.';
        break;
      case 'pit':
        go('up', 'glasshouse');
        if (!f.loose) c['loosen the valve with the wrench'] = has(s, 'wrench') ? st => { st.flags.loose = true; return 'You lean on the wrench. With a crack, the frost lets go of the wheel.'; } : () => 'You have no wrench.';
        if (!f.valveOpen) c['open the valve'] = f.loose ? st => { st.flags.valveOpen = true; return 'The wheel spins. Water rushes into the pipes.'; } : () => "The wheel is frozen stiff. It won't budge by hand.";
        break;
    }
    if (has(s, 'calendar') && s.room !== 'potting') c['read the calendar'] = st => { st.flags.knowCode = true; return 'Under today\'s date, in pencil: "Shed lock 3-1-7. Main valve sticks in a frost - use the big wrench."'; };
    if (has(s, 'seeds')) c['plant the seeds'] = () => 'You push a few seeds into a pot. They will not help today.';
    c['wait'] = () => 'Time passes. The sun climbs higher.';
  },
  needs: {
    shed: { text: 'getting into the tool shed', when: /tool shed is padlocked/, met: s => s.flags.shedOpen },
    code: { text: 'finding the padlock code', when: /need the code/, met: s => s.flags.knowCode || s.flags.shedOpen },
    valve: { text: 'opening the main water valve', when: /must be shut/, met: s => s.flags.valveOpen },
    loose: { text: 'freeing the frozen valve wheel', when: /won't budge/, met: s => s.flags.loose },
    wrench: { text: 'finding a wrench', when: /no wrench/, met: s => has(s, 'wrench') },
  },
};

// ---------- World 5: The Fuse at Hollin Museum ----------

const hollin = {
  label: 'The Fuse at Hollin Museum',
  goal: "Get the museum's lights back on before the alarm's backup battery runs out.",
  aim: 'getting the lights back on',
  best: 15, max: 40,
  items: {
    leaflet: 'a museum leaflet', umbrella: 'an umbrella', keyring: "the night guard's key ring", memo: "the curator's memo", thermos: 'a thermos of coffee',
    fuse: 'a spare fuse', bulb: 'an antique light bulb', key: 'an old basement key', bust: 'a small marble bust',
  },
  start: {
    room: 'lobby',
    where: { leaflet: 'lobby', umbrella: 'lobby', keyring: 'office', memo: 'office', thermos: 'office', fuse: 'gallery', bulb: 'gallery', key: 'study', bust: 'study' },
    flags: { caseOpen: false, coatSearched: false, doorOpen: false, fused: false },
  },
  map: [['study', ''], ['gallery', ''], ['lobby+basement', 'office']],
  art: {
    lobby: pic`
       _________________
      /_________________\
       | |   | |   | |
       | |   | |   | |
       | |   | |   | |
     __|_|___|_|___|_|__
`,
    office: pic`
  _____________________
 |  [====]      .--.   |
 |  |    |      |  |   |
 |  [====]    __|__|__ |
 |  ____________ c[]   |
 |_|____________|______|
`,
    gallery: pic`
  _____________________
 |  _____    _____     |
 | | /\  |  |  o  |    |
 | |/__\_|  |_/|\_|    |
 |   ___       ___     |
 |__|___|_____|___|____|
`,
    study: pic`
  _____________________
 |[|||][||||]  |  _\_  |
 |[||||][|||]  | (   ) |
 |[|||][||||]  | |   | |
 |[||||][|||]  | |___| |
 |_____________|_______|
`,
    basement: pic`
  _____________________
 |    _____________    |
 |   | [] [] [] X  |   |
 |   | [] [] [] [] |   |
 |   |______|______|   |
 |__________|__________|
`,
  },
  dark: () => false,
  room(s) {
    const f = s.flags;
    return {
      lobby: ['Museum Lobby', `Marble columns in the glow of the emergency lights. An alarm panel beeps: BACKUP BATTERY LOW. The guard's office is east. The gallery is north. A door marked BASEMENT${f.doorOpen ? ' stands open, stairs going down' : ' has a dead card reader, with an old keyhole under it'}.`],
      office: ["Guard's Office", 'A desk, a kettle, a wall of dark monitors. The lobby is west.'],
      gallery: ['Gallery of Electricity', `Glass cases of old switches, dials and bulbs. One case is labelled AGE OF THE FUSE${f.caseOpen ? ' (open)' : ' and locked'}. The curator's study is north. The lobby is south.`],
      study: ["Curator's Study", "Bookshelves, a leather chair, and the curator's coat on a stand. The gallery is south."],
      basement: ['Fuse Room', `A grey fuse box with one ${f.fused ? 'new fuse in place' : 'fuse black and blown'}. A big main switch beside it. The stairs go up.`],
    }[s.room];
  },
  hidden: s => s.room === 'gallery' && !s.flags.caseOpen ? ['fuse', 'bulb'] : s.room === 'study' && !s.flags.coatSearched ? ['key'] : [],
  commands(s, c, go) {
    const f = s.flags;
    switch (s.room) {
      case 'lobby':
        go('east', 'office'); go('north', 'gallery');
        go('down', 'basement', f.doorOpen, "The basement door's card reader is dead. The door won't open.");
        if (!f.doorOpen) c['unlock the basement door'] = has(s, 'key') ? st => { st.flags.doorOpen = true; return 'The old key turns. The basement door opens.'; } : () => 'You have no key for the old lock.';
        c['press the alarm panel'] = () => 'Beep. BACKUP BATTERY LOW.';
        break;
      case 'office':
        go('west', 'lobby');
        c['switch on the monitors'] = () => 'No power. They stay dark.';
        break;
      case 'gallery':
        go('south', 'lobby'); go('north', 'study');
        if (!f.caseOpen) c['open the AGE OF THE FUSE case'] = has(s, 'keyring') ? st => { st.flags.caseOpen = true; return 'A little key on the ring fits. Inside the case: a spare fuse and an antique light bulb.'; } : () => 'The case is locked. Its little lock needs a key from a key ring.';
        break;
      case 'study':
        go('south', 'gallery');
        if (!f.coatSearched) c['search the coat'] = st => { st.flags.coatSearched = true; return 'In the coat pocket: an old basement key.'; };
        c['sit in the leather chair'] = () => 'Comfortable. The alarm keeps beeping downstairs.';
        break;
      case 'basement':
        go('up', 'lobby');
        if (!f.fused) c['replace the fuse'] = has(s, 'fuse') ? st => { st.flags.fused = true; st.inv = st.inv.filter(i => i !== 'fuse'); st.where.fuse = 'box'; return 'You pull the blown fuse and push in the spare.'; } : () => 'You have no spare fuse.';
        c['throw the main switch'] = f.fused
          ? st => { st.won = true; return 'Clunk. Every light in the museum comes on and the alarm goes quiet. You win!'; }
          : () => 'Sparks, then nothing. The fuse is blown.';
        break;
    }
    if (has(s, 'memo') || here(s, 'memo')) c['read the memo'] = () => 'It says: "Out of spare fuses down in the basement, so I put one in the AGE OF THE FUSE case in the gallery. Basement key is in the pocket of my coat, on the stand in my study. - Curator"';
    if (has(s, 'leaflet')) c['read the leaflet'] = () => 'HOLLIN MUSEUM. Open 10 till 5. Gift shop on the left.';
    if (has(s, 'thermos')) c['drink the coffee'] = () => 'Hot and strong. You feel more awake.';
    c['wait'] = () => 'Time passes. The alarm beeps faster.';
  },
  needs: {
    door: { text: 'opening the basement door', when: /card reader is dead/, met: s => s.flags.doorOpen },
    key: { text: 'finding the basement key', when: /no key for the old lock/, met: s => has(s, 'key') || s.flags.doorOpen },
    case: { text: 'finding a key for the display case', when: /case is locked/, met: s => has(s, 'keyring') },
    fuse: { text: 'finding a spare fuse', when: /fuse is blown|no spare fuse/, met: s => has(s, 'fuse') || s.flags.fused },
  },
};

const WORLDS = { 'gull-rock': gullRock, 'wren-ridge': wrenRidge, 'night-mail': nightMail, larkmoor, hollin };

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
      art: Object.fromEntries(Object.entries(w.art).map(([r, lines]) => { const n = Math.max(...lines.map(l => l.length)); return [r, lines.map(l => l.padEnd(n))]; })),
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
