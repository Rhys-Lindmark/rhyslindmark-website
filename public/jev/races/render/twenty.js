// 20 Questions look for the race page. Any noun: one pool of 100 things and 35 general
// questions. Every racer gets the same turn and is asked the same thing (askText); code answers
// from the table, crosses off what no longer fits, and guesses when one thing is left.
// Same game as github.com/Rhys-Lindmark/20-questions-workshop (games/twenty.mjs is its src/twenty.mjs).
import { askText, cleanThing, parseCase, GUESS } from '../games/twenty.mjs';

const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const EXAMPLES = ['frog', 'pizza', 'volcano', 'umbrella', 'guitar', 'moon', 'helicopter', 'cactus', 'light bulb', 'penguin'];

// In place of the dropdown: the one question every racer answers, a box to type anything,
// and ten example secrets, each a button that starts a race.
export function picker({ data }) {
  const ex = EXAMPLES.filter(x => data.items.includes(x));
  return `<div class="asked">Every racer is asked: <b>“${esc(askText)}”</b> <span class="muted">Code answers, crosses off what no longer fits, and guesses when one thing is left.</span></div>
    <form class="typeany"><input type="text" maxlength="40" autocomplete="off" aria-label="Type anything"
      placeholder="Type any noun: a hedgehog, lasagna, a teddy bear…"><button>Race</button></form>
    <div class="pickcat"><b>Or try</b>
      ${ex.map(x => `<button class="chip pick" data-case="one:${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
}
export const typedCase = text => `type:${text}`;

// Above the lanes, only for a typed thing: Jev's answers about it, which every racer hears.
export function board({ caseId, extra, call }) {
  const o = extra?.oracle;
  if (!o) return '';
  const { kind } = parseCase(caseId);
  if (kind !== 'type' || cleanThing(o.thing) !== o.thing) return '';
  const how = call ? ` (one request, ${Object.keys(o.row).length} yes/no questions; ${call.ms} ms, $${call.cost.toFixed(5)}${call.replayed ? ', recorded' : ''})` : '';
  return `<details><summary class="muted">Jev's answers about <b>${esc(o.thing)}</b>${esc(how)}. It joins the pool, and every racer hears these.</summary>
    <div style="margin-top:4px">${Object.entries(o.row).map(([q, a]) => `<span class="chip">${esc(q)} <span class="${a}">${a}</span></span>`).join('')}</div></details>`;
}

const answerChip = a => `<span class="chip ${a === 'yes' ? 'yes' : 'no'}">${esc(a)}</span>`;
const fits = turn => turn?.state?.still_possible ?? turn?.state?.stillPossible ?? null;

// Above each AI lane: what's still possible for it right now.
export function laneView({ turn }) {
  const left = fits(turn);
  if (!left) return '';
  return `<div class="muted" style="font-size:12px;margin-bottom:2px">${left.length} still fit</div>
    <div style="max-height:84px;overflow:hidden">${left.map(x => `<span class="chip" style="font-size:11px;padding:0 6px">${esc(x)}</span>`).join('')}</div>`;
}

export function youView({ s, turn }) {
  const answers = s.answers.map(a => `<div>${esc(a.question)} → ${answerChip(a.answer)}</div>`).join('');
  const left = fits(turn);
  return `<div class="muted">Secret ${s.r + 1} of ${s.secrets.length} · ${turn.state.turns_left ?? ''} turns left</div>
    ${answers || '<div class="muted">No answers yet.</div>'}
    ${left ? `<div class="muted" style="margin-top:4px">${left.length} still fit: ${left.map(esc).join(', ')}</div>` : ''}`;
}

export function stepHtml(e) {
  const out = /Out of turns/.test(e.note) ? ` <span class="no">${esc(e.note.slice(e.note.indexOf('Out of turns')))}</span>` : '';
  let body;
  if (e.move?.startsWith(GUESS)) {
    const hit = /Yes!/.test(e.note);
    body = `Guess <b>${esc(e.move.slice(GUESS.length))}</b> → <span class="chip ${hit ? 'yes' : 'no'}">${hit ? esc(e.note.replace(/^.*?\? /, '')) : 'no'}</span>${out}`;
  } else if (e.move && e.note?.startsWith(e.move)) {
    body = `${esc(e.move)} → ${answerChip(e.note.slice(e.move.length).trim())}`;
  } else {
    body = (e.move ? esc(e.move) : '') + (out || ` ${esc(e.note)}`);
  }
  const probs = e.probs ? `<div class="probs">${e.probs.map(([k, p]) => `${esc(k)} ${(p * 100).toFixed(0)}%`).join(' · ')}</div>` : '';
  return `<span class="n">${e.n}</span> ${body}${e.why ? `<div class="why">${esc(e.why)}</div>` : ''}${probs}`;
}
