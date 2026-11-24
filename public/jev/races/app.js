// The race page. Every lane runs here in the browser on the same game module. An AI lane's
// move replays from recordings/ when there is one (paced at its recorded speed), and
// otherwise is POSTed to `move`, which calls Jev or OpenRouter on the server (server.mjs
// locally, a Pages function at /jev/races/move). All URLs are relative, so the same files
// work at localhost and at /jev/races/. Each game can add its own look in render/<game>.js:
//   board({ data, caseId, game }), youView({ data, s, turn }), laneView({ data, s, turn }) (what an
//   AI lane is looking at right now), stepHtml(e)  (all optional, HTML strings)
import { LANES, moveRequest, readMove, recordingName } from './lanes.mjs';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const money = x => x === 0 ? '$0' : x < 0.01 ? '$' + x.toFixed(4) : '$' + x.toFixed(3);
const secs = ms => (ms / 1000).toFixed(1) + 's';
const times = x => (x < 10 ? x.toFixed(1) : x.toFixed(0)) + '×';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const GAME_IDS = ['geo', 'twenty', 'adventure'];
let mods = {};
async function load(id) {
  if (mods[id]) return mods[id];
  const game = (await import(`./games/${id}.mjs`)).default;
  const render = await import(`./render/${id}.js`).catch(() => ({}));
  const data = await game.load(p => fetch('data/' + p).then(r => r.json()));
  return (mods[id] = { game, render, data });
}
const meta = { games: await Promise.all(GAME_IDS.map(async id => { const { game, data } = await load(id); return { id, title: game.title, blurb: game.blurb, steps: game.steps, cases: game.cases(data) }; })) };
let gameId = new URLSearchParams(location.search).get('game') || meta.games[0].id;
const LANE_ORDER = ['you', ...Object.keys(LANES)];
const laneInfo = id => id === 'you' ? { label: 'You', price: 'a human in the room' } : LANES[id];
let run = 0, lanes = {};

$('#lanepick').innerHTML = LANE_ORDER.map(id => `<label><input type="checkbox" value="${id}" ${id === 'you' ? '' : 'checked'}> ${esc(laneInfo(id).label)}</label>`).join('');
$('#tabs').innerHTML = meta.games.map(g => `<button data-id="${g.id}">${esc(g.title)}</button>`).join('');
$('#tabs').onclick = e => e.target.dataset.id && selectGame(e.target.dataset.id);
$('#go').onclick = start;

// One AI move: the recording if there is one, else the server.
async function aiMove(laneId, game, turn, s, mode) {
  if (mode !== 'live') {
    const r = await fetch('recordings/' + await recordingName(moveRequest(laneId, turn).key));
    if (r.ok) { const out = await r.json(); await sleep(out.ms); return readMove(laneId, turn, { ...out, replayed: true }); }
    if (mode === 'replay') throw new Error('No recording for this move. Pick Auto or Live to play it live.');
  }
  const r = await fetch('move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game, lane: laneId, s, mode }) });
  if (!r.ok) { const t = await r.text(); let msg; try { msg = JSON.parse(t).error; } catch {} throw new Error(msg || (r.status === 401 ? 'Log in to /jev to play live' : `Live move failed (${r.status})`)); }
  return readMove(laneId, turn, await r.json());
}

async function runLane(m, caseId, laneId, mode, myRun) {
  const { game, data } = m;
  let s = game.init(data, caseId);
  const totals = { steps: 0, ms: 0, cost: 0, replayed: 0 };
  try {
    while (!game.done(s) && totals.steps < 80) {
      const turn = game.turn(data, s);
      const now = m.render.laneView?.({ data, s, turn });
      if (now != null) { const el = document.querySelector(`#lane-${laneId} .now`); if (el && el.dataset.html !== now) { el.innerHTML = now; el.dataset.html = now; } }
      const p = await aiMove(laneId, game.id, turn, s, mode);
      if (myRun !== run) return;
      const out = game.apply(data, s, p.move);
      s = out.s;
      totals.steps++; totals.ms += p.ms; totals.cost += p.cost; totals.replayed += p.replayed ? 1 : 0;
      onEvent({ type: 'step', lane: laneId, n: totals.steps, level: turn.level, options: turn.options.length, ...p, note: out.note, round: out.round, totals: { ...totals } }, m);
    }
    onEvent({ type: 'done', lane: laneId, result: game.result(s), totals }, m);
  } catch (e) {
    if (myRun === run) onEvent({ type: 'error', lane: laneId, message: e.message }, m);
  }
}

async function selectGame(id) {
  gameId = id;
  history.replaceState(null, '', '?game=' + id);
  stop();
  const g = meta.games.find(g => g.id === id);
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  $('#blurb').textContent = g.blurb;
  $('#case').innerHTML = g.cases.map(c => `<option value="${esc(c.id)}">${esc(c.label)}</option>`).join('');
  $('#case').onchange = drawBoard;
  $('#lanes').innerHTML = $('#scores').innerHTML = '';
  drawBoard();
}

async function drawBoard() {
  const { game, render, data } = await load(gameId);
  $('#board').innerHTML = render.board?.({ data, caseId: $('#case').value, game }) ?? '';
}

function stop() { run++; Object.values(lanes).forEach(l => l.timer && clearInterval(l.timer)); lanes = {}; $('#go').disabled = false; drawTimeline(); }

async function start() {
  stop();
  const m = await load(gameId);
  const caseId = $('#case').value;
  const picked = [...document.querySelectorAll('#lanepick input:checked')].map(i => i.value);
  if (!picked.length) return;
  $('#go').disabled = true;
  $('#scores').innerHTML = '';
  $('#lanes').innerHTML = picked.map(id => `
    <div class="lane ${id === 'jev' ? 'jev' : id === 'you' ? 'you' : ''}" id="lane-${id}">
      <h2>${esc(laneInfo(id).label)} <small>${esc(laneInfo(id).price)}</small></h2>
      <div class="stats"><div class="stat"><b class="steps">0</b><span>${esc(meta.games.find(g => g.id === gameId).steps)}</span></div>
        <div class="stat"><b class="time">0.0s</b><span>time</span></div><div class="stat"><b class="cost">$0</b><span>cost</span></div></div>
      <div class="status">${id === 'you' ? 'Your move' : 'Thinking…'}</div>
      ${id === 'you' ? '<div class="play"></div>' : '<div class="now"></div>'}
      <div class="log"></div>
    </div>`).join('');
  for (const id of picked) lanes[id] = { id, steps: 0, ms: 0, cost: 0, done: false, ticks: [] };
  drawTimeline();
  drawBoard();

  for (const id of picked.filter(id => id !== 'you')) runLane(m, caseId, id, $('#mode').value, run);
  if (picked.includes('you')) playHuman(m, caseId);
}

function onEvent(e, m) {
  const lane = lanes[e.lane]; if (!lane) return;
  const el = $('#lane-' + e.lane);
  if (e.type === 'error') { lane.done = true; lane.error = e.message; el.querySelector('.status').className = 'status err'; el.querySelector('.status').textContent = e.message; return maybeScores(); }
  if (e.type === 'step') {
    Object.assign(lane, { steps: e.totals.steps, ms: e.totals.ms, cost: e.totals.cost, replayed: e.totals.replayed });
    lane.ticks.push({ ms: lane.ms, bad: !e.move || /no valid/.test(e.note) });
    stats(el, lane);
    el.querySelector('.status').textContent = (e.replayed ? 'replaying recorded moves · ' : 'live · ') + `${e.options} options this step`;
    addRow(el, e, m);
  }
  if (e.type === 'done') {
    Object.assign(lane, { done: true, result: e.result });
    const st = el.querySelector('.status'); st.className = 'status done'; st.textContent = e.result.headline;
    maybeScores();
  }
}

// The race at the bottom, like WikiRace's: one track per racer, the bar is its time so far,
// each tick is a move (red: a move it fumbled), all on one time scale.
function drawTimeline() {
  const all = Object.values(lanes);
  const box = $('#timeline');
  if (!all.length) { box.innerHTML = ''; return; }
  const max = Math.max(1000, ...all.map(l => l.ms)) * 1.04;
  const pct = ms => (100 * ms / max).toFixed(2) + '%';
  box.innerHTML = `<div class="tl-scale">${secs(max / 1.04)}</div>` + all.map(l => `
    <div class="tl-row ${l.id}">
      <div class="tl-name">${esc(laneInfo(l.id).label)}</div>
      <div class="tl-track"><div class="tl-bar" style="width:${pct(l.ms)}"></div>
        ${l.ticks.map(t => `<i class="${t.bad ? 'bad' : ''}" style="left:${pct(t.ms)}"></i>`).join('')}</div>
      <div class="tl-state ${l.done ? (l.error ? 'err' : 'done') : ''}">${l.error ? 'ERROR' : l.done ? 'FINISHED' : `${l.steps} ${l.id === 'you' ? '' : '·'} ${secs(l.ms)}`}</div>
    </div>`).join('');
}

function stats(el, lane) {
  drawTimeline();
  el.querySelector('.steps').textContent = lane.steps;
  el.querySelector('.time').textContent = secs(lane.ms);
  el.querySelector('.cost').textContent = money(lane.cost);
}

function addRow(el, e, m) {
  const custom = m.render.stepHtml?.(e);
  const probs = e.probs ? `<div class="probs">${e.probs.map(([k, p]) => `${esc(k)} ${(p * 100).toFixed(0)}%`).join(' · ')}</div>` : '';
  const html = custom ?? `<span class="n">${e.n}</span> ${esc(e.note)}${e.why ? `<div class="why">${esc(e.why)}</div>` : ''}${probs}`;
  const log = el.querySelector('.log');
  log.insertAdjacentHTML('beforeend', `<div class="row"><span class="t">${e.ms != null ? e.ms + ' ms' : ''}</span>${html}</div>`);
  log.scrollTop = log.scrollHeight;
}

// ---------- the human lane ----------
function playHuman(m, caseId) {
  const { game, render, data } = m;
  const lane = lanes.you, el = $('#lane-you');
  let s = game.init(data, caseId);
  const t0 = Date.now();
  lane.timer = setInterval(() => { lane.ms = Date.now() - t0; stats(el, lane); }, 100);
  const draw = () => {
    if (game.done(s)) {
      clearInterval(lane.timer); lane.ms = Date.now() - t0; stats(el, lane);
      lane.done = true; lane.result = game.result(s);
      el.querySelector('.play').innerHTML = '';
      const st = el.querySelector('.status'); st.className = 'status done'; st.textContent = lane.result.headline;
      return maybeScores();
    }
    const turn = game.turn(data, s);
    const view = render.youView?.({ data, s, turn }) ??
      `${turn.image ? `<img src="data/${esc(turn.image.path)}" alt="">` : ''}<pre>${esc(JSON.stringify(turn.state, null, 1))}</pre>`;
    const many = turn.options.length > 16;
    el.querySelector('.play').innerHTML = `<div class="youview">${view}<div><b>${esc(turn.question.replaceAll('`', ''))}</b></div></div>
      ${many ? '<input class="filter" placeholder="Type to filter…">' : ''}
      <div class="moves">${turn.options.map((o, i) => `<button data-i="${i}">${esc(o.name)}</button>`).join('')}</div>`;
    const f = el.querySelector('.filter');
    if (f) { f.oninput = () => el.querySelectorAll('.moves button').forEach(b => b.style.display = b.textContent.toLowerCase().includes(f.value.toLowerCase()) ? '' : 'none'); f.focus(); }
    el.querySelector('.moves').onclick = ev => {
      const i = ev.target.dataset.i; if (i == null) return;
      const move = turn.options[i].name;
      const out = game.apply(data, s, move);
      s = out.s; lane.steps++;
      lane.ticks.push({ ms: Date.now() - t0, bad: false });
      stats(el, lane);
      addRow(el, { n: lane.steps, move, note: out.note, round: out.round }, m);
      draw();
    };
  };
  draw();
}

// ---------- the scoreboard ----------
function maybeScores() {
  drawTimeline();
  const all = Object.values(lanes);
  if (!all.every(l => l.done)) return;
  $('#go').disabled = false;
  const ok = all.filter(l => l.result).sort((a, b) => b.result.score - a.result.score || a.ms - b.ms);
  const jev = lanes.jev?.result ? lanes.jev : null;
  const best = ok[0]?.result.score;
  $('#scores').innerHTML = `<table><tr><th>Racer</th><th>Result</th><th>Steps</th><th>Time</th><th>Cost</th>${jev ? '<th>vs Jev</th>' : ''}</tr>
    ${ok.map(l => `<tr><td class="${l.result.score === best ? 'win' : ''}">${esc(laneInfo(l.id).label)}</td><td>${esc(l.result.headline)}<div class="muted" style="font-size:13px">${esc(l.result.detail)}</div></td>
      <td class="num">${l.steps}</td><td class="num">${secs(l.ms)}</td><td class="num">${money(l.cost)}</td>
      ${jev ? `<td class="num">${l === jev || l.id === 'you' ? '' : `${times(l.ms / jev.ms)} slower, ${times(l.cost / jev.cost)} the cost`}</td>` : ''}</tr>`).join('')}</table>`;
}

selectGame(meta.games.some(g => g.id === gameId) ? gameId : meta.games[0].id);
