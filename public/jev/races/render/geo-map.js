// A lane-sized world map that zooms like a slippy map while a racer thinks: the world while
// it picks a continent, then the continent while it picks a country, then the country
// (with its 25 cities as dots) while it picks a city, then the guess and the real spot.
// Plain SVG from data/geo/world.json (Natural Earth shapes, x = lon*10, y = -lat*10), no tiles,
// so it works offline. Each render animates from the previous view to the new one (CSS
// keyframes between two transforms), so swapping the HTML still looks like one smooth zoom.

const U = 10; // map units per degree
const VB = { w: 3600, h: 1800 };
const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Where each continent sits (degrees: west, south, east, north). Hand-set: a box around every
// country's shapes would stretch Europe to Vladivostok and France to South America.
const CONTINENT_BOX = {
  Africa: [-20, -36, 54, 38], Asia: [25, -11, 150, 56], Europe: [-25, 34, 45, 71],
  'North America': [-128, 6, -58, 62], Oceania: [110, -48, 180, 2], 'South America': [-84, -56, -33, 13],
};
const WORLD = [-180, -60, 180, 80];

let world = null;
// Load the shapes once and put them in the page as one hidden symbol every lane map reuses.
export async function loadWorld() {
  if (world) return world;
  world = await fetch('data/geo/world.json').then(r => r.json());
  const all = [...Object.entries(world.countries).map(([n, d]) => `<path data-c="${esc(n)}" d="${d}"/>`), ...world.other.map(d => `<path d="${d}"/>`)].join('');
  document.body.insertAdjacentHTML('beforeend', `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><g id="gm-world">${all}</g></defs></svg>`);
  return world;
}

const pad = ([w, s, e, n], f = 0.12, min = 3) => { const dx = Math.max((e - w) * f, min), dy = Math.max((n - s) * f, min); return [w - dx, s - dy, e + dx, n + dy]; };
const boxOf = pts => [Math.min(...pts.map(p => p.lon)), Math.min(...pts.map(p => p.lat)), Math.max(...pts.map(p => p.lon)), Math.max(...pts.map(p => p.lat))];
export const countryBox = (tree, name) => {
  const c = Object.values(tree.countries).find(c => c.name === name);
  return c ? pad(boxOf(c.cities.map(([, lat, lon]) => ({ lat, lon }))), 0.15, 1.5) : WORLD;
};
export const continentBox = name => CONTINENT_BOX[name] ?? WORLD;
export const pointsBox = pts => pad(boxOf(pts), 0.25, 2.5);

// The transform that fits a box (degrees) into the map, and how many map units a screen pixel is.
function fit([w, s, e, n]) {
  const cx = (w + e) / 2 * U, cy = -(s + n) / 2 * U;
  const k = Math.min(VB.w / ((e - w) * U), VB.h / ((n - s) * U));
  return { k, t: `scale(${k.toFixed(4)}) translate(${(-cx).toFixed(1)}px, ${(-cy).toFixed(1)}px)` };
}

// from, to: boxes in degrees. shade: { countryName: 0..1 } (Jev's probabilities, or a focus).
// dots: [{ lon, lat, label?, kind: 'city'|'guess'|'truth', size? }]. line: [a, b] points.
export function mapHtml({ from = WORLD, to = WORLD, shade = {}, focus = [], dots = [], line, caption = '', thinking = false }) {
  const a = fit(from), b = fit(to);
  const px = 1 / (b.k * 0.085); // map units per screen pixel at the end of the zoom (lane maps are ~300px wide)
  const d = n => world?.countries[n];
  const focusPaths = focus.filter(d).map(n => `<path class="gm-focus" d="${d(n)}"/>`).join('');
  const shadePaths = Object.entries(shade).filter(([n, p]) => d(n) && p > 0.004)
    .map(([n, p]) => `<path class="gm-shade" style="fill-opacity:${Math.min(0.9, 0.15 + p * 0.85).toFixed(2)}" d="${d(n)}"/>`).join('');
  const xy = p => `cx="${(p.lon * U).toFixed(1)}" cy="${(-p.lat * U).toFixed(1)}"`;
  const dotsSvg = dots.map(p => `<circle class="gm-${p.kind}" ${xy(p)} r="${((p.size ?? (p.kind === 'city' ? 2.2 : 4.5)) * px).toFixed(1)}"/>`).join('');
  const labels = dots.filter(p => p.label).map(p => `<text class="gm-label gm-${p.kind}-t" x="${(p.lon * U + 6 * px).toFixed(1)}" y="${(-p.lat * U - 4 * px).toFixed(1)}" style="font-size:${(11 * px).toFixed(1)}px">${esc(p.label)}</text>`).join('');
  const lineSvg = line ? `<line class="gm-line" x1="${(line[0].lon * U).toFixed(1)}" y1="${(-line[0].lat * U).toFixed(1)}" x2="${(line[1].lon * U).toFixed(1)}" y2="${(-line[1].lat * U).toFixed(1)}" style="stroke-width:${(1.5 * px).toFixed(2)}"/>` : '';
  return `<div class="gm">
    <svg viewBox="${-VB.w / 2} ${-VB.h / 2} ${VB.w} ${VB.h}" preserveAspectRatio="xMidYMid meet">
      <g class="gm-zoom" style="--from:${a.t};--to:${b.t}">
        <use href="#gm-world" class="gm-land"/>${focusPaths}${shadePaths}${lineSvg}${dotsSvg}${labels}
      </g>
    </svg>
    <div class="gm-cap${thinking ? ' thinking' : ''}">${caption}</div>
  </div>`;
}
