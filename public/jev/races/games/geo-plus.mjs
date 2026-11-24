// Jev++ for GeoGuesser: the same Jev, asked more and smarter questions about the SAME photo
// (no moving, like GeoGuessr's no-move mode; zooming in is fine), with every decision in code.
// Pure module: the page, the CLI and the /jev/races/move Pages function all build these requests,
// so a recording made on one replays on the others.
//
//   pick 1 (continent), two rounds of parallel requests:
//     prior   continent, plus "which country?" within every continent: P(continent) x P(country | continent)
//     clues   which side traffic drives on, the script and the language of any writing (each with a
//             Noul "can you tell?"), checked in code against data/geo/clues.json
//     box     where the most readable sign is
//   then, over the top candidate countries:
//     tile0-3 "which country?" again on each enlarged quarter of the photo
//     sign    "which country?" on the enlarged sign, when there is writing and the box matches the
//             pre-cut close-up (data/geo/zoom/, made by build-zoom.mjs from this same box request)
//   code multiplies it all: P(country) = prior x clues x sign x (geometric mean of the 4 tiles).
//   pick 2 (country): the top country, from the same numbers. No request.
//   pick 3 (city): "which region?" and "which city?" on the full photo, one request; code takes
//     the likeliest city inside the likeliest region (the 25-largest list is crowded with capital
//     suburbs, and asking for the region first stops that pulling every guess to the capital).
// Tested on the 20 photos in experiments/geo-clues.mjs and geo-city.mjs: 84,564 points vs 81,880
// for plain Jev (tuned on those same photos, so read it as optimistic).

const CANDIDATES = 8, EPS = 0.05;
export const VIEWS = ['full', 'tile0', 'tile1', 'tile2', 'tile3', 'sign'];

export async function loadPlus(readJson) {
  const [places, tree, clues, regions, zoom] = await Promise.all(['places', 'cities', 'clues', 'regions', 'zoom'].map(f => readJson(`geo/${f}.json`)));
  return { places, tree, clues, regions, zoom };
}

const choice = (instructions, options, describe = () => null) => ({ type: 'choice', instructions, criteria: Object.fromEntries(options.map(o => [o, describe(o)])) });
const noul = (instructions, t, f) => ({ type: 'noul', instructions, criteria: { true: t, false: f } });

// The questions for one request. part: { photo, kind, view?, cands?, country? }. Throws on anything invalid,
// so the server can build requests from what the page sends without trusting it.
export function plusQuestions(d, part) {
  const countries = Object.values(d.tree.countries);
  const conts = Object.entries(d.tree.continents);
  switch (part.kind) {
    case 'prior': {
      const q = { continent: choice('On which continent was `photo` taken?', conts.map(([, n]) => n)) };
      for (const [code, n] of conts) q['in_' + code] = choice(`In which country in ${n} was \`photo\` taken?`, countries.filter(c => c.continent === code).map(c => c.name));
      return q;
    }
    case 'clues': return {
      road_seen: noul('Does `photo` show which side of the road traffic keeps to?', 'Vehicles, lanes or road signs in the photo show which side traffic keeps to.', 'Nothing in the photo shows which side traffic keeps to.'),
      drive: { type: 'choice', instructions: 'On which side of the road does traffic drive in `photo`?', criteria: { left: 'Traffic keeps to the left side of the road.', right: 'Traffic keeps to the right side of the road.' } },
      text_seen: noul('Is there writing in `photo` that you can read?', 'Some words or letters in the photo can be read.', 'No writing in the photo can be read.'),
      script: choice('Which writing system is used for the writing in `photo`?', d.clues.scripts),
      language: choice('Which language is the writing in `photo` in?', [...d.clues.languages, 'another language']),
    };
    case 'box': return { sign: { type: 'box', instructions: 'Where is the most readable sign or piece of writing in `photo`?' } };
    case 'cands': {
      const names = new Set(countries.map(c => c.name));
      if (!Array.isArray(part.cands) || !part.cands.length || part.cands.length > CANDIDATES || part.cands.some(c => !names.has(c))) throw new Error('bad candidates');
      return { country: choice('In which country was `photo` photographed?', part.cands) };
    }
    case 'city': {
      const c = countries.find(c => c.name === part.country);
      if (!c) throw new Error('bad country');
      const reg = d.regions[c.name] ?? {};
      const regions = [...new Set(c.cities.map(([n]) => reg[n]).filter(Boolean))];
      const q = { city: choice(`If \`photo\` was taken in ${c.name}, which of these cities is it closest to?`, c.cities.map(([n]) => n), n => reg[n] ? `${n}, in ${reg[n]}` : null) };
      if (regions.length > 1) q.region = choice(`In which region of ${c.name} was \`photo\` taken?`, regions);
      return q;
    }
  }
  throw new Error('bad kind');
}

// The image a part looks at, as a path under data/.
export function plusImage(d, part) {
  const place = d.places.find(p => p.id === part.photo);
  if (!place) throw new Error('bad photo');
  const view = part.view ?? 'full';
  if (view === 'full') return `geo/${place.file}`;
  if (!VIEWS.includes(view) || (view === 'sign' && !d.zoom[place.id]?.sign)) throw new Error('bad view');
  return `geo/zoom/${place.id}-${view}.jpg`;
}

// One request's body (the image attached later as asset "photo"), and its recording key.
export function plusRequest(d, part, model) {
  const body = { model, state: { photo: 'photo' }, questions: plusQuestions(d, part) };
  return { body, key: { ...body, assets: plusImage(d, part) }, image: plusImage(d, part) };
}

const norm = o => { const t = Object.values(o).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v / t])); };
const best = o => Object.entries(o).sort((x, y) => y[1] - x[1])[0]?.[0];
const iou = (a, b) => {
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)), h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const u = (a.right - a.left) * (a.bottom - a.top) + (b.right - b.left) * (b.bottom - b.top) - w * h;
  return u > 0 ? (w * h) / u : 0;
};

// A Jev++ racer for one race. ask(part) -> { answers, input_tokens, ms, replayed } (a recording or a live call).
export function createPlusPlayer(d, ask) {
  const plans = {}; // photo id -> the country decision, made at the continent pick
  const tally = rs => ({ ms: rs.reduce((m, r) => Math.max(m, r.ms), 0), tokens: rs.reduce((s, r) => s + r.input_tokens, 0), replayed: rs.every(r => r.replayed) });

  async function plan(photo) {
    const countries = Object.values(d.tree.countries), conts = Object.entries(d.tree.continents);
    // Round 1: first impression, clues, sign box.
    const r1 = await Promise.all(['prior', 'clues', 'box'].map(kind => ask({ photo, kind })));
    const a = Object.assign({}, ...r1.map(r => r.answers));
    const prior = norm(Object.fromEntries(conts.flatMap(([code, n]) => Object.entries(a['in_' + code].probabilities).map(([c, p]) => [c, p * (a.continent.probabilities[n] ?? 0)]))));
    const cands = Object.entries(prior).sort((x, y) => y[1] - x[1]).slice(0, CANDIDATES).map(([c]) => c);
    const like = c => {
      const k = d.clues.countries[c] ?? { drive: 'R', langs: [], scripts: ['Latin'] };
      const road = a.road_seen.noul, text = a.text_seen.noul;
      const drive = (1 - road) + road * Object.entries(a.drive.probabilities).reduce((s, [side, p]) => s + p * ((side === 'left') === (k.drive === 'L') ? 1 : EPS), 0);
      // Latin letters turn up everywhere (brands, English), so they count for little against a country.
      const script = (1 - text) + text * Object.entries(a.script.probabilities).reduce((s, [sc, p]) => s + p * (k.scripts.includes(sc) ? 1 : sc === 'Latin' ? 0.4 : EPS), 0);
      const lang = (1 - text) + text * Object.entries(a.language.probabilities).reduce((s, [l, p]) => s + p * (l === 'another language' ? 0.5 : k.langs.includes(l) ? 1 : l === 'English' ? 0.3 : EPS), 0);
      return drive * script * lang;
    };
    // Round 2: the same question on each zoomed view.
    const z = d.zoom[photo]?.sign;
    const useSign = a.text_seen.noul >= 0.5 && a.sign?.box && z && iou(a.sign.box, z.box) > 0.5;
    const views = ['tile0', 'tile1', 'tile2', 'tile3', ...(useSign ? ['sign'] : [])];
    const r2 = await Promise.all(views.map(view => ask({ photo, kind: 'cands', view, cands })));
    const tiles = r2.slice(0, 4).map(r => r.answers.country.probabilities), sign = useSign ? r2[4].answers.country.probabilities : null;
    const post = norm(Object.fromEntries(cands.map(c => [c,
      prior[c] * like(c) * (sign ? Math.max(sign[c] ?? 0, EPS) : 1) * Math.exp(tiles.reduce((s, t) => s + Math.log(Math.max(t[c] ?? 0, 1e-4)), 0) / tiles.length)])));
    const contOf = c => d.tree.continents[countries.find(x => x.name === c)?.continent];
    const contDist = {}; for (const [c, p] of Object.entries(post)) contDist[contOf(c)] = (contDist[contOf(c)] ?? 0) + p;
    const t1 = tally(r1), t2 = tally(r2);
    const top = best(prior);
    return {
      post, contDist, ms: t1.ms + t2.ms, tokens: t1.tokens + t2.tokens, replayed: t1.replayed && t2.replayed,
      why: `${views.length + 3} looks: ${useSign ? 'sign close-up, ' : ''}4 zoomed quarters, clues · first guess ${top} ${Math.round(prior[top] * 100)}% → ${best(post)} ${Math.round(post[best(post)] * 100)}%`,
    };
  }

  return {
    // -> { move, probs: dist, why, ms, tokens, replayed }
    async move({ s, turn }) {
      const photo = s.rounds[s.r];
      if (turn.level === 'continent') {
        const p = plans[photo] = await plan(photo);
        return { move: best(p.contDist), dist: p.contDist, why: p.why, ms: p.ms, tokens: p.tokens, replayed: p.replayed };
      }
      if (turn.level === 'country') {
        const p = plans[photo] ?? (plans[photo] = await plan(photo));
        const options = new Set(turn.options.map(o => o.name));
        const dist = norm(Object.fromEntries(Object.entries(p.post).filter(([c]) => options.has(c))));
        return { move: best(dist) ?? turn.options[0].name, dist, why: 'from the same looks; no new question', ms: 0, tokens: 0, replayed: p.replayed };
      }
      const country = s.path.country;
      const r = await ask({ photo, kind: 'city', country });
      const reg = d.regions[country] ?? {};
      const cityP = r.answers.city.probabilities;
      const region = r.answers.region ? best(r.answers.region.probabilities) : null;
      const inRegion = Object.fromEntries(Object.entries(cityP).filter(([n]) => !region || reg[n] === region));
      const dist = norm(Object.keys(inRegion).length ? inRegion : cityP);
      return { move: best(dist), dist, why: region ? `region first: ${region} (${Math.round(r.answers.region.probabilities[region] * 100)}%)` : undefined, ms: r.ms, tokens: r.input_tokens, replayed: r.replayed };
    },
  };
}
