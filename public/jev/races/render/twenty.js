// 20 Questions look for the race page: the 35 animals above the lanes, the human's answers
// so far, and log rows like "Is it a bird? → no".
import { _table } from '../games/twenty.mjs';

const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GUESS = 'Guess: ';

// Every animal the secret could be. Secrets are never shown.
export function board() {
  return `<div class="muted" style="margin-bottom:4px">The secret is one of these ${_table.ANIMALS.length} animals:</div>
    <div>${_table.ANIMALS.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div>`;
}

const answerChip = a => `<span class="chip ${a === 'yes' ? 'yes' : 'no'}">${esc(a)}</span>`;

export function youView({ s, turn }) {
  const answers = s.answers.map(a => `<div>${esc(a.question)} → ${answerChip(a.answer)}</div>`).join('');
  const wrong = s.guessed.length ? `<div>Not: ${s.guessed.map(g => `<span class="chip no">${esc(g)}</span>`).join('')}</div>` : '';
  return `<div class="muted">Secret ${s.r + 1} of ${s.secrets.length} · ${turn.state.turns_left} turns left</div>
    ${answers || wrong ? answers + wrong : '<div class="muted">No answers yet. Ask a question or guess.</div>'}`;
}

export function stepHtml(e) {
  const out = /Out of turns/.test(e.note) ? ` <span class="no">${esc(e.note.slice(e.note.indexOf('Out of turns')))}</span>` : '';
  let body;
  if (e.move?.startsWith(GUESS)) {
    const hit = /Yes!/.test(e.note);
    body = `Guess <b>${esc(e.move.slice(GUESS.length))}</b> → <span class="chip ${hit ? 'yes' : 'no'}">${hit ? esc(e.note.replace(/^.*?\? /, '')) : 'no'}</span>${out}`;
  } else if (e.move && e.note.startsWith(e.move)) {
    body = `${esc(e.move)} → ${answerChip(e.note.slice(e.move.length).trim())}`;
  } else {
    body = (e.move ? esc(e.move) : '') + (out || ` ${esc(e.note)}`); // last question, or no valid move
  }
  const probs = e.probs ? `<div class="probs">${e.probs.map(([k, p]) => `${esc(k)} ${(p * 100).toFixed(0)}%`).join(' · ')}</div>` : '';
  return `<span class="n">${e.n}</span> ${body}${e.why ? `<div class="why">${esc(e.why)}</div>` : ''}${probs}`;
}
