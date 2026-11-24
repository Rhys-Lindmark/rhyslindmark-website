// 20 Questions look for the race page: the category's list above the lanes (with a typed
// thing sorted in, and Jev's answers about it), the case controls (pick a secret, or type
// anything), the human's answers so far, and log rows like "Is it a bird? → no".
import { parseCase, cleanThing } from '../games/twenty.mjs';

const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GUESS = 'Guess: ';

// In place of the dropdown: one box to type anything (Jev works out what kind of thing it is),
// then every secret as a button that starts a race, by category.
export function picker({ data }) {
  const cats = Object.values(data.cats);
  return `<form class="typeany"><input type="text" maxlength="40" autocomplete="off" aria-label="Type anything"
      placeholder="Type anything: a hedgehog, a stapler, lasagna…"><button>Race</button></form>
    ${cats.map(c => `<div class="pickcat"><b>${esc(c.title)}</b>
      <button class="chip pick rand" data-case="${esc(c.id)}:random">3 random</button>
      ${c.items.map(i => `<button class="chip pick" data-case="${esc(c.id)}:one:${esc(i)}">${esc(i)}</button>`).join('')}</div>`).join('')}`;
}
export const typedCase = text => `any:type:${text}`;

// Next to the case dropdown: "Pick one secret…" gets a list, "Type anything…" a text box.
export function caseControls({ data, caseId }) {
  const { cat, kind } = parseCase(caseId);
  const c = data.cats[cat];
  if (kind === 'one') return `<select aria-label="Secret">${c.items.map(i => `<option>${esc(i)}</option>`).join('')}</select>`;
  if (kind === 'type') return `<input type="text" maxlength="40" size="22" aria-label="Your secret ${esc(c.noun)}" placeholder="any ${esc(c.noun)}, e.g. ${cat === 'foods' ? 'lasagna' : cat === 'animals' ? 'hedgehog' : 'stapler'}" autocomplete="off">`;
  return '';
}

export function fullCase({ caseId, el }) {
  const { kind } = parseCase(caseId);
  if (kind === 'one') return `${caseId}:${el.querySelector('select')?.value ?? ''}`;
  if (kind === 'type') return `${caseId}:${el.querySelector('input')?.value ?? ''}`;
  return caseId;
}

// Every thing the secret could be (a typed thing sorted in with the rest). Secrets are never
// shown, except a typed one, which the room typed. After Jev answers about it, its answers.
export function board({ data, caseId, extra, call }) {
  let { cat, kind, arg } = parseCase(caseId);
  const thing = kind === 'type' ? cleanThing(arg) : null;
  if (cat === 'any') cat = extra?.oracle?.cat ?? Object.values(data.cats).find(c => c.items.includes(thing))?.id;
  const c = data.cats[cat];
  if (!c) return '';
  const items = thing && !c.items.includes(thing) ? [...c.items, thing].sort((a, b) => a.localeCompare(b)) : c.items;
  let html = `<div class="muted" style="margin-bottom:4px">The secret is one of these ${items.length} ${esc(c.title.toLowerCase())}:</div>
    <div>${items.map(a => `<span class="chip">${esc(a)}</span>`).join('')}</div>`;
  const o = extra?.oracle;
  if (o) {
    const what = o.cat ? `which kind of thing it is (${c.noun}) and every category's questions about it` : `${Object.keys(o.row).length} yes/no questions`;
    const how = call ? ` (one request: ${what}; ${call.ms} ms, $${call.cost.toFixed(5)}${call.replayed ? ', recorded' : ''})` : '';
    html += `<details style="margin-top:8px"><summary class="muted">Jev's answers about <b>${esc(o.thing)}</b>${esc(how)}. Every racer hears these.</summary>
      <div style="margin-top:4px">${Object.entries(o.row).map(([q, a]) => `<span class="chip">${esc(q)} <span class="${a}">${a}</span></span>`).join('')}</div></details>`;
  }
  return html;
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
