// GeoGuesser's look. The You lane sees the photo and its own picks, never the answer.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function youView({ s, turn }) {
  const picks = Object.values(s.path);
  return `<div class="muted">Photo ${s.r + 1} of ${s.rounds.length}${s.results.length ? ` · ${s.results.reduce((a, r) => a + r.points, 0).toLocaleString()} pts so far` : ''}</div>
    <img src="data/${esc(turn.image.path)}" alt="">
    ${picks.length ? `<div>${picks.map(p => `<span class="chip">${esc(p)}</span>`).join(' → ')}</div>` : ''}`;
}

// What an AI lane is looking at: the same photo the model gets, and its picks so far.
export function laneView({ s, turn }) {
  const picks = Object.values(s.path);
  return `<div class="muted" style="font-size:13px">Photo ${s.r + 1} of ${s.rounds.length}</div>
    <img src="data/${esc(turn.image.path)}" alt="" style="width:100%;border-radius:6px;display:block">
    <div style="min-height:24px">${picks.map(p => `<span class="chip">${esc(p)}</span>`).join(' → ')}</div>`;
}

export function stepHtml(e) {
  const probs = e.probs ? `<div class="probs">${e.probs.map(([k, p]) => `${esc(k)} ${(p * 100).toFixed(0)}%`).join(' · ')}</div>` : '';
  const round = e.round ? `<div><b>${e.round.points.toLocaleString()} pts</b> <span class="muted">${e.round.km.toLocaleString()} km off · it was ${esc(e.round.answer)}</span></div>` : '';
  return `<span class="n">${e.n}</span> ${esc(e.move)}${round}${probs}`;
}
