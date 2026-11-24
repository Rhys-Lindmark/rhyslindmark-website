// POST /jev/races/move: one live move for the hosted race page (ai.rhyslindmark.com/jev/races).
// Source of truth: jev/takehome/races/pages-move.js; publish.sh copies it to the website's
// functions/jev/races/move.js. The /jev login in _middleware.js runs before this, so only
// logged-in viewers can spend the site's keys.
//
// Body: { game, lane, s } (the game's state). The function rebuilds the turn with the same
// pure game module the page runs, so the page can't send its own prompt, and returns the raw
// response the page reads with lanes.mjs (the same shape as a recording).
// Or { game: 'twenty', oracle: { category, thing } }: Jev's answers about a typed thing.
import { loadKey } from '../../_lib/jev-key.js';
import { databaseFor } from '../../_lib/jev-database.js';
import { LANES, moveRequest, withImage, keep } from '../../../public/jev/races/lanes.mjs';
import geo from '../../../public/jev/races/games/geo.mjs';
import twenty from '../../../public/jev/races/games/twenty.mjs';
import adventure from '../../../public/jev/races/games/adventure.mjs';

const GAMES = { geo, twenty, adventure };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
const asset = (env, request, path) => env.ASSETS.fetch(new URL('/jev/races/data/' + path, request.url));

function base64(buf) {
  const bytes = new Uint8Array(buf); let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export async function onRequestPost({ request, env }) {
  let input;
  try { input = await request.json(); } catch { return json({ error: 'bad JSON' }, 400); }
  const { game, oracle } = input || {};
  if (!Object.hasOwn(GAMES, game)) return json({ error: 'bad move' }, 400);
  const load = () => GAMES[game].load(p => asset(env, request, p).then(r => r.json()));

  // Body { game: 'twenty', oracle: { category, thing } }: 20 Questions' "Type anything". Jev
  // answers the category's questions about the thing (one Noul each), once per race.
  if (oracle) {
    let o;
    try { o = GAMES[game].oracleFor?.(await load(), oracle.category, oracle.thing); } catch {}
    if (!o) return json({ error: 'Type a thing: letters and spaces, up to 40 characters' }, 400);
    return call(env, request, 'jev', o.turn);
  }

  const { lane, s } = input;
  if (!Object.hasOwn(LANES, lane) || !s || typeof s !== 'object') return json({ error: 'bad move' }, 400);
  let turn;
  try {
    const data = await load();
    if (GAMES[game].done(s)) return json({ error: 'game over' }, 400);
    turn = GAMES[game].turn(data, s);
  } catch { return json({ error: 'bad state' }, 400); }
  return call(env, request, lane, turn);
}

async function call(env, request, lane, turn) {
  let key, why = '';
  try { key = LANES[lane].kind === 'jev' ? await loadKey({ ...env, JEV_DB: databaseFor(env) }) : env.OPENROUTER_API_KEY; } catch (e) { why = ` (${e.name}: ${String(e.message).slice(0, 80)})`; }
  if (!key) return json({ error: `${LANES[lane].label} isn't set up on this site${why}` }, 503);
  const req = moveRequest(lane, turn);
  const b64 = turn.image ? base64(await asset(env, request, turn.image.path).then(r => r.arrayBuffer())) : undefined;
  const extra = withImage(lane, turn, req.body, b64);

  const t0 = Date.now();
  const r = await fetch(req.url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, 'X-Title': 'jev-races', ...extra }, body: JSON.stringify(req.body) });
  const ms = Date.now() - t0;
  // A failed call is an error, never a move.
  if (!r.ok) return json({ error: `${LANES[lane].label} HTTP ${r.status}` }, 502);
  return json(keep(lane, await r.json(), ms));
}
