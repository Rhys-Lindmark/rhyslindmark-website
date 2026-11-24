// Race-page rendering for the Text Adventure Speedrun (games/adventure.mjs).
// Plain HTML strings; page CSS supplies .chip, .muted and .cmd.

const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// A tiny room map: a grid, north at the top; a cell like 'lamp+watch+base' is a stack of floors.
function map(world, at, small = false) {
  const cols = Math.max(...world.map.map(r => r.length));
  const cell = c => !c ? '<div></div>' : `<div style="display:flex;flex-direction:column;gap:2px">${c.split('+').map(r =>
    `<span class="chip" style="text-align:center;${small ? 'font-size:10px;padding:0 3px;margin:0;' : ''}${r === at ? 'outline:2px solid currentColor;font-weight:700' : ''}">${esc(world.names[r])}</span>`).join('')}</div>`;
  return `<div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:${small ? 3 : 6}px;align-items:end;max-width:520px">${world.map.flat().map(cell).join('')}</div>`;
}

export function board({ data, caseId }) {
  const w = data?.worlds?.[caseId];
  if (!w) return '';
  return `<div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start">
    <div style="flex:1 1 280px">
      <div style="font-size:1.3em;font-weight:700">${esc(w.label)}</div>
      <div style="margin:6px 0">${esc(w.goal)}</div>
      <div class="muted">Best route: ${w.best} moves · game over at ${w.max}</div>
    </div>
    <div style="flex:1 1 280px">${map(w, null)}</div>
  </div>`;
}

// Above each AI lane: the room it's in right now (its picture, name and what it carries), on the map.
export function laneView({ data, s, turn }) {
  const w = s && data?.worlds?.[s.world];
  const st = turn?.state;
  if (!w || !st) return '';
  return crt(w.art?.[s.room], st);
}

// An early-80s terminal: the room's ASCII picture and name in green phosphor.
function crt(art, st) {
  return `<div class="crt">${art ? `<pre>${esc(art.join('\n'))}</pre>` : ''}
    <div class="crt-room">${esc(st.room.name.toUpperCase())}</div>
    <div class="crt-inv">${st.inventory.length ? 'YOU CARRY: ' + esc(st.inventory.join(', ').toUpperCase()) : 'YOU CARRY NOTHING.'}</div></div>`;
}

export function youView({ data, s, turn }) {
  const st = turn?.state;
  if (!st) return '';
  const w = s && data?.worlds?.[s.world];
  const list = xs => xs?.length ? xs.map(x => `<span class="chip">${esc(x)}</span>`).join(' ') : '<span class="muted">nothing</span>';
  return `<div style="display:flex;flex-direction:column;gap:8px">
    ${crt(w?.art?.[s.room], st)}
    <div><b>${esc(st.room.name)}</b> <span class="muted">· ${st.moves_left} moves left</span></div>
    <div>${esc(st.room.description)}</div>
    ${st.last_result && !st.last_result.startsWith(st.room.name) ? `<div class="muted">${esc(st.last_result)}</div>` : ''}
    <div><span class="muted">Carrying:</span> ${list(st.inventory)}</div>
    ${st.still_needed?.length ? `<div><span class="muted">Still needed:</span> ${list(st.still_needed)}</div>` : ''}
    ${w ? map(w, s.room) : ''}
  </div>`;
}

export function stepHtml(e) {
  const result = String(e.note ?? '').split(' → ').slice(1).join(' → ');
  const won = /You win!/.test(result), lost = /Game over/.test(result);
  return `<div style="${won ? 'font-weight:700' : ''}">
    <span class="cmd">&gt; ${esc(e.move ?? '(no move)')}</span>
    ${e.why ? ` <span class="chip">${esc(e.why)}</span>` : ''}
    <div class="muted" style="${lost ? 'font-weight:700' : ''}">${esc(result || e.note)}</div>
  </div>`;
}
