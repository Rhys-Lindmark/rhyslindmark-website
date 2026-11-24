// GeoGuesser's look. Racers play the photos in rounds (games/geo.mjs syncRounds), so the
// board shows the round's one photo above every lane. Each lane gets a map that zooms in as
// it decides (world -> continent -> country -> its guess and the real spot), shaded by Jev's
// probabilities for its last pick. The You lane sees the same photo, never the answer.
import { loadWorld, mapHtml, continentBox, countryBox, pointsBox } from './geo-map.js';

await loadWorld();
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = p => `${Math.round(p * 100)}%`;
const WORLD = [-180, -60, 180, 80];

// Above the lanes: this round's photo, big.
export function board({ data, game, caseId, round = 0 }) {
  const rounds = game.init(data, caseId).rounds;
  const place = data.places.find(p => p.id === rounds[Math.min(round, rounds.length - 1)]);
  if (!place) return '';
  return `<div class="geo-board">
    <img src="data/geo/${esc(place.file)}" alt="Where in the world is this?">
    <div class="muted">Photo ${Math.min(round, rounds.length - 1) + 1} of ${rounds.length}. Every racer sees this photo, then picks a continent, a country and a city.</div>
  </div>`;
}

export function youView({ s }) {
  const picks = Object.values(s.path);
  return `<div class="muted">Photo ${s.r + 1} of ${s.rounds.length} (the one above)${s.results.length ? ` · ${s.results.reduce((a, r) => a + r.points, 0).toLocaleString()} pts so far` : ''}</div>
    ${picks.length ? `<div>${picks.map(p => `<span class="chip">${esc(p)}</span>`).join(' → ')}</div>` : ''}`;
}

const THINK = { continent: 'which continent?', country: 'which country?', city: 'which city?' };
const hmm = (picked, level) => `${picked ? `<b>${esc(picked)}</b> · ` : ''}<span class="hmm">hmm… ${THINK[level]}</span>`;

// What an AI lane is doing right now. turn: it's thinking about this pick. last: the step it
// just made (its probabilities shade the map; at the end of a photo, last.round is the result).
export function laneView({ data, s, turn, last }) {
  const { tree } = data;
  const dist = last?.dist;
  if (last?.round) { // the guess and the real spot
    const r = last.round, place = data.places.find(p => p.id === r.id);
    const country = Object.values(tree.countries).find(c => r.guess.endsWith(', ' + c.name));
    const guess = { ...r.guessAt, kind: 'guess', label: r.guess.split(', ')[0] }, truth = { lat: place.lat, lon: place.lon, kind: 'truth', label: 'here' };
    const cities = country ? country.cities.map(([name, lat, lon]) => ({ lat, lon, kind: 'city', size: dist ? 1.5 + 9 * (dist[name] ?? 0) : 2 })) : [];
    return mapHtml({
      from: country ? countryBox(tree, country.name) : WORLD, to: pointsBox([guess, truth]),
      focus: country ? [country.name] : [], dots: [...cities, guess, truth], line: [guess, truth],
      caption: `<b>${esc(r.guess)}</b> · ${r.km.toLocaleString()} km off · <b>${r.points.toLocaleString()} pts</b> <span class="muted">(it was ${esc(r.answer)})</span>`,
    });
  }
  if (!turn) return null;
  const { continent, country } = s.path;
  if (turn.level === 'continent') {
    const prev = s.results.at(-1);
    const from = prev ? pointsBox([prev.guessAt, data.places.find(p => p.id === prev.id)]) : WORLD;
    return mapHtml({ from, to: WORLD, caption: hmm(null, 'continent'), thinking: true });
  }
  if (turn.level === 'country') {
    const code = Object.entries(tree.continents).find(([, n]) => n === continent)?.[0];
    const members = Object.values(tree.countries).filter(c => c.continent === code).map(c => c.name);
    return mapHtml({ from: WORLD, to: continentBox(continent), focus: members, caption: hmm(continent, 'country'), thinking: true });
  }
  const c = Object.values(tree.countries).find(c => c.name === country);
  return mapHtml({
    from: continentBox(continent), to: countryBox(tree, country), focus: [country],
    shade: dist ?? {}, // Jev's probability for each country it could have picked
    dots: (c?.cities ?? []).map(([, lat, lon]) => ({ lat, lon, kind: 'city' })),
    caption: hmm(`${continent} → ${country}`, 'city'), thinking: true,
  });
}

// A log row: the pick, and for Jev its probabilities as bars.
export function stepHtml(e) {
  const bars = e.probs ? `<div class="pbars">${e.probs.map(([k, p]) =>
    `<div class="pbar"><span class="pbar-k">${esc(k)}</span><span class="pbar-v"><i style="width:${(p * 100).toFixed(1)}%"></i></span><span class="pbar-p">${pct(p)}</span></div>`).join('')}</div>` : '';
  const round = e.round ? `<div><b>${e.round.points.toLocaleString()} pts</b> <span class="muted">${e.round.km.toLocaleString()} km off · it was ${esc(e.round.answer)}</span></div>` : '';
  const level = e.level ? `<span class="muted">${esc(e.level)}:</span> ` : '';
  return `<span class="n">${e.n}</span> ${level}<b>${esc(e.move ?? '(no valid pick)')}</b>${round}${bars}`;
}
