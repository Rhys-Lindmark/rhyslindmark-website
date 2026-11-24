// The race page. Every lane runs here in the browser on the same game module. An AI lane's
// move replays from recordings/ when there is one (paced at its recorded speed), and
// otherwise is POSTed to `move`, which calls Jev or OpenRouter on the server (server.mjs
// locally, a Pages function at /jev/races/move). All URLs are relative, so the same files
// work at localhost and at /jev/races/. Each game can add its own look in render/<game>.js:
//   board({ data, caseId, game, extra, call }), youView({ data, s, turn }), laneView({ data, s, turn }) (what an
//   AI lane is looking at right now), stepHtml(e)  (all optional, HTML strings);
//   caseControls({ data, caseId }) and fullCase({ caseId, el }): an extra control next to the
//   case dropdown, and the case id it makes (20 Questions: pick a secret, or type anything).
// A game module can also have resolve(data, caseId) (settle randomness once per race) and
// oracle(data, caseId) (one Jev request before the race; its move goes to init as extra.oracle).
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
$('#go').onclick = () => start();

// One AI move: the recording if there is one, else the server (body: what `move` needs to
// rebuild this request itself).
async function aiMove(laneId, turn, body, mode, pace = true) {
  if (mode !== 'live') {
    const r = await fetch('recordings/' + await recordingName(moveRequest(laneId, turn).key));
    if (r.ok) { const out = await r.json(); if (pace) await sleep(out.ms); return readMove(laneId, turn, { ...out, replayed: true }); }
    if (mode === 'replay') throw new Error('No recording for this move. Pick Auto or Live to play it live.');
  }
  const r = await fetch('move', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, mode }) });
  if (!r.ok) { const t = await r.text(); let msg; try { msg = JSON.parse(t).error; } catch {} throw new Error(msg || (r.status === 401 ? 'Log in to /jev to play live' : `Live move failed (${r.status})`)); }
  return readMove(laneId, turn, await r.json());
}

// The case as picked, with the game's own extra control (20 Questions: which secret, or a typed thing).
const pickedCase = render => render.fullCase?.({ caseId: $('#case').value, el: $('#casex') }) ?? $('#case').value;

// Before a race, once for every lane: a concrete case (20 Questions' 3 random secrets) and,
// for a typed thing, Jev's answers about it (the game's oracle request).
async function prepare(m, mode, picked = pickedCase(m.render)) {
  const { game, data } = m;
  const caseId = game.resolve?.(data, picked) ?? picked;
  const o = game.oracle?.(data, caseId);
  let extra, call;
  if (o) {
    $('#prepnote').textContent = `Asking Jev about “${o.ask.thing}”…`;
    call = await aiMove('jev', o.turn, { game: game.id, oracle: o.ask }, mode, false);
    extra = { oracle: call.move };
  }
  game.init(data, caseId, extra); // throws on a bad case, before any lane starts
  return { caseId, extra, call };
}

async function runLane(m, caseId, laneId, mode, myRun, extra) {
  const { game, data } = m;
  let s = game.init(data, caseId, extra);
  const totals = { steps: 0, ms: 0, cost: 0, replayed: 0 };
  const show = (args) => {
    const now = m.render.laneView?.({ data, ...args });
    if (now != null) { const el = document.querySelector(`#lane-${laneId} .now`); if (el && el.dataset.html !== now) { el.innerHTML = now; el.dataset.html = now; } }
  };
  let last = null; // the step just made: its probabilities and, at the end of a round, its result
  try {
    while (!game.done(s) && totals.steps < 80) {
      const turn = game.turn(data, s);
      show({ s, turn, last });
      const p = await aiMove(laneId, turn, { game: game.id, lane: laneId, s }, mode);
      if (myRun !== run) return;
      const out = game.apply(data, s, p.move);
      s = out.s;
      totals.steps++; totals.ms += p.ms; totals.cost += p.cost; totals.replayed += p.replayed ? 1 : 0;
      last = { ...p, level: turn.level, round: out.round };
      onEvent({ type: 'step', lane: laneId, n: totals.steps, level: turn.level, options: turn.options.length, ...p, note: out.note, round: out.round, totals: { ...totals } }, m);
      if (game.syncRounds && out.round) { // a photo done: show the result, wait for the others
        show({ s, turn: null, last });
        if (!game.done(s)) {
          const st = document.querySelector(`#lane-${laneId} .status`); if (st) st.textContent = 'done with this photo · waiting for the others';
          await arrive(laneId, s.r);
          if (myRun !== run) return;
          if (st) st.textContent = 'Thinking…';
        }
        last = { ...last, round: null };
      }
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
  // Cases with a `group` go under an <optgroup> (20 Questions: one per category).
  let html = '', group;
  for (const c of g.cases) {
    if (c.group !== group) { html += (group ? '</optgroup>' : '') + (c.group ? `<optgroup label="${esc(c.group)}">` : ''); group = c.group; }
    html += `<option value="${esc(c.id)}">${esc(c.label)}</option>`;
  }
  $('#case').innerHTML = html + (group ? '</optgroup>' : '');
  $('#case').onchange = caseChanged;
  $('#lanes').innerHTML = $('#scores').innerHTML = '';
  // A game with a picker (20 Questions) shows its secrets as buttons that each start a race,
  // and a box to type anything, in place of the dropdown and the Start button.
  const { render, data } = await load(id);
  const usePicker = !!render.picker;
  currentCase = null;
  $('#caselabel').hidden = $('#casex').hidden = $('#go').hidden = usePicker;
  $('#picker').innerHTML = usePicker ? render.picker({ data }) : '';
  $('#picker').onclick = e => { const b = e.target.closest('[data-case]'); if (b) start(b.dataset.case); };
  $('#picker').onsubmit = e => { e.preventDefault(); const v = e.target.querySelector('input')?.value.trim(); if (v) start(render.typedCase(v)); };
  caseChanged();
}

// A game can add a control next to the case (render.caseControls); it redraws the board as it changes.
async function caseChanged() {
  const { game, render, data } = await load(gameId);
  $('#casex').innerHTML = render.caseControls?.({ data, caseId: $('#case').value, game }) ?? '';
  $('#casex').oninput = () => drawBoard();
  $('#casex').onkeydown = e => { if (e.key === 'Enter' && !$('#go').disabled) start(); };
  $('#prepnote').textContent = '';
  drawBoard();
}

// prep: what prepare() settled for the race that's starting (its case, and a typed thing's answers).
async function drawBoard(prep) {
  const { game, render, data } = await load(gameId);
  const caseId = prep?.caseId ?? (render.picker ? currentCase?.caseId : pickedCase(render));
  $('#board').innerHTML = caseId == null ? '' : render.board?.({ data, caseId, game, round: shownRound, extra: prep?.extra ?? currentCase?.extra, call: prep?.call ?? currentCase?.call }) ?? '';
}

// Round gates (games with syncRounds): a racer that finishes round r waits here until every
// racer has finished it (or stopped), then the board moves on to the next photo.
let gates = {}, shownRound = 0;
function gate(r) { if (!gates[r]) { let open; const p = new Promise(x => (open = x)); gates[r] = { p, open }; } return gates[r]; }
function checkGates() {
  const ls = Object.values(lanes);
  for (const r of Object.keys(gates).map(Number).sort((a, b) => a - b)) {
    if (!ls.every(l => l.done || l.error || (l.at ?? 0) >= r)) break;
    gates[r].open();
    if (r > shownRound) { shownRound = r; drawBoard(); }
  }
}
function arrive(laneId, r) { if (lanes[laneId]) lanes[laneId].at = r; const g = gate(r); checkGates(); return g.p; }

function stop() { run++; gates = {}; shownRound = 0; Object.values(lanes).forEach(l => l.timer && clearInterval(l.timer)); lanes = {}; $('#go').disabled = false; drawTimeline(); }

let currentCase = null; // the race on screen: { caseId, extra, call }

async function start(caseArg) {
  stop();
  const m = await load(gameId);
  const picked = [...document.querySelectorAll('#lanepick input:checked')].map(i => i.value);
  if (!picked.length) return;
  $('#go').disabled = true;
  const myRun = run, mode = $('#mode').value;
  let prep;
  try { prep = await prepare(m, mode, caseArg); } catch (e) {
    if (myRun === run) { $('#prepnote').innerHTML = `<span class="no">${esc(e.message)}</span>`; $('#go').disabled = false; }
    return;
  }
  if (myRun !== run) return;
  $('#prepnote').textContent = '';
  const { caseId, extra } = prep;
  currentCase = prep;
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
  drawBoard(prep);

  for (const id of picked.filter(id => id !== 'you')) runLane(m, caseId, id, mode, run, extra);
  if (picked.includes('you')) playHuman(m, caseId, extra);
}

function onEvent(e, m) {
  const lane = lanes[e.lane]; if (!lane) return;
  const el = $('#lane-' + e.lane);
  if (e.type === 'error') { lane.done = true; lane.error = e.message; checkGates(); el.querySelector('.status').className = 'status err'; el.querySelector('.status').textContent = e.message; return maybeScores(); }
  if (e.type === 'step') {
    Object.assign(lane, { steps: e.totals.steps, ms: e.totals.ms, cost: e.totals.cost, replayed: e.totals.replayed });
    lane.ticks.push({ ms: lane.ms, bad: !e.move || /no valid/.test(e.note) });
    stats(el, lane);
    el.querySelector('.status').textContent = (e.replayed ? 'replaying recorded moves · ' : 'live · ') + `${e.options} options this step`;
    addRow(el, e, m);
  }
  if (e.type === 'done') {
    Object.assign(lane, { done: true, result: e.result });
    checkGates();
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
function playHuman(m, caseId, extra) {
  const { game, render, data } = m;
  const lane = lanes.you, el = $('#lane-you');
  let s = game.init(data, caseId, extra);
  // Your time counts only while it's your move (not while waiting for the others between rounds).
  let acc = 0, since = Date.now();
  const elapsed = () => acc + (since ? Date.now() - since : 0);
  lane.timer = setInterval(() => { lane.ms = elapsed(); stats(el, lane); }, 100);
  const draw = () => {
    if (game.done(s)) {
      clearInterval(lane.timer); lane.ms = elapsed(); stats(el, lane);
      lane.done = true; lane.result = game.result(s); checkGates();
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
    el.querySelector('.moves').onclick = async ev => {
      const i = ev.target.dataset.i; if (i == null) return;
      const move = turn.options[i].name;
      const out = game.apply(data, s, move);
      s = out.s; lane.steps++;
      lane.ms = elapsed();
      lane.ticks.push({ ms: lane.ms, bad: false });
      stats(el, lane);
      addRow(el, { n: lane.steps, move, level: turn.level, note: out.note, round: out.round }, m);
      if (game.syncRounds && out.round && !game.done(s)) {
        acc = elapsed(); since = 0;
        const myRun = run;
        el.querySelector('.play').innerHTML = `<div class="muted">${esc(out.note)}. Waiting for the others…</div>`;
        await arrive('you', s.r);
        if (myRun !== run) return;
        since = Date.now();
      }
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
