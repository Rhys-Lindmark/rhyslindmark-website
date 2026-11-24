// GeoGuesser. Each round shows a street-level photo. A racer narrows it down in three
// picks, continent -> country -> city, from the legal options at each level, and scores
// GeoGuessr-style points from how far its city is from where the photo was taken.
// Pure module: the server and the browser (the "You" lane) both run it.

const LEVELS = ['continent', 'country', 'city'];
const ROUND_MAX = 5000;
const TOUR = 6;

const km = (a, b) => {
  const r = Math.PI / 180, R = 6371;
  const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const points = d => Math.round(ROUND_MAX * Math.exp(-d / 1492.7)); // GeoGuessr's world-map curve

export default {
  id: 'geo',
  title: 'GeoGuesser',
  blurb: 'A photo from somewhere on Earth. Pick the continent, then the country, then the nearest city. Points for how close you land.',
  steps: 'picks',
  // Racers play each photo together, like GeoGuessr rounds: a racer that finishes a photo
  // waits for the rest, so the page can show one photo above every lane. Waiting isn't
  // counted in anyone's time. s.r is the round.
  syncRounds: true,

  async load(readJson) {
    const [places, tree] = await Promise.all([readJson('geo/places.json'), readJson('geo/cities.json')]);
    return { places, tree };
  },

  // One photo per race (3 picks per racer). No place names: the room can see this list.
  // Tours ('tour-1' = photos 1–6 … and 'all') still work from the command line.
  cases: data => data.places.map((p, i) => ({ id: p.id, label: `Photo #${i + 1}` })),

  init(data, caseId) {
    const ids = data.places.map(p => p.id);
    const t = /^tour-(\d+)$/.exec(caseId);
    const rounds = caseId === 'all' ? ids : t ? ids.slice((t[1] - 1) * TOUR, t[1] * TOUR) : caseId === 'tour' ? ids.slice(0, TOUR) : [caseId];
    return { rounds, r: 0, path: {}, results: [] };
  },

  done: s => s.r >= s.rounds.length,

  turn(data, s) {
    const place = data.places.find(p => p.id === s.rounds[s.r]);
    const { tree } = data;
    const level = LEVELS[Object.keys(s.path).length];
    const ref = `photo-${s.r + 1}`; // opaque: the place id would give the answer away
    let question, options;
    if (level === 'continent') {
      question = 'On which continent was `photo` taken?';
      options = Object.values(tree.continents).map(name => ({ name }));
    } else if (level === 'country') {
      const cont = Object.entries(tree.continents).find(([, n]) => n === s.path.continent)[0];
      question = `In which country in ${s.path.continent} was \`photo\` taken?`;
      options = Object.values(tree.countries).filter(c => c.continent === cont).map(c => ({ name: c.name })).sort((a, b) => a.name.localeCompare(b.name));
    } else {
      const c = Object.values(tree.countries).find(c => c.name === s.path.country);
      question = `Which of these cities in ${s.path.country} is closest to where \`photo\` was taken?`;
      options = c.cities.map(([name]) => ({ name }));
    }
    return {
      level,
      state: { photo: ref, ...(Object.keys(s.path).length ? { your_picks_so_far: s.path } : {}) },
      question, options,
      image: { ref, path: `geo/${place.file}` },
    };
  },

  apply(data, s, move) {
    const t = this.turn(data, s);
    const pickName = t.options.some(o => o.name === move) ? move : t.options[0].name; // an unreadable reply takes the first option
    const path = { ...s.path, [t.level]: pickName };
    if (t.level !== 'city') return { s: { ...s, path }, note: `${t.level}: ${pickName}${pickName === move ? '' : ' (no valid pick)'}` };
    const place = data.places.find(p => p.id === s.rounds[s.r]);
    const [, lat, lon] = Object.values(data.tree.countries).find(c => c.name === path.country).cities.find(([n]) => n === pickName);
    const d = km({ lat, lon }, place);
    const res = { id: place.id, answer: place.place, guess: `${pickName}, ${path.country}`, km: Math.round(d), points: points(d), guessAt: { lat, lon } };
    return { s: { ...s, r: s.r + 1, path: {}, results: [...s.results, res] }, note: `city: ${pickName} → ${res.km.toLocaleString()} km off, ${res.points.toLocaleString()} pts`, round: res };
  },

  result(s) {
    const pts = s.results.reduce((a, r) => a + r.points, 0);
    return { score: pts, headline: `${pts.toLocaleString()} pts`, detail: s.results.map(r => `${r.guess}: ${r.km.toLocaleString()} km`).join(' · ') };
  },
};
