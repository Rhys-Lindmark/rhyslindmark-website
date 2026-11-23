// Hire This Candidate? Jev judges; this file decides.
import { DATA } from './data.js?v=hire-3';

const J = DATA.judgments;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Notes on the rows that most need one.
const NOTES = {
  three_years: 'Five years as a CTO who wrote the code: does that count as “software engineer”? Jev can’t tell, and neither can a resume. A question for a person.',
  dev_following: '17k YouTube subscribers, but the channel is about evolution, not developers.',
  devrel_title: 'For the record only, not scored. Nobody has the title before their first DevRel job.',
  discord: 'Left out on purpose: reading Discord needs a bot TypeSafe would have to add.',
  four_hours: 'Flags never reject on their own. A person decides whether this is a red flag or the job.',
};
const NOT_SCORED = new Set(['devrel_title', ...DATA.flags]);
// The page judges the Developer Advocate role only. The recorder also asked a few
// Developer Educator questions (role 'E'); they stay in data.js but aren't shown or scored.
const ROLE = 'A';
const shown = k => J[k].role !== 'E';

const PRESETS = {
  rhys: { label: 'Rhys’s guess', w: { done: .25, did: .25, smart: .25, other: .25 }, note: 'A guess, not a study.' },
  sh98: { label: 'Schmidt & Hunter 1998', w: { done: .18, did: .54, smart: .51, other: .51 }, note: 'Years of experience .18, work sample .54, cognitive ability .51, structured interview .51, scaled to add up to 100%.' },
  s22: { label: 'Sackett et al. 2022', w: { done: .40, did: .33, smart: .31, other: .42 }, note: 'Job knowledge .40, work sample .33, cognitive ability .31, structured interview .42, scaled to add up to 100%.' },
};

const state = { preset: 'rhys', interview: 'pending', over: {} };
const prob = k => state.over[k] ?? J[k].p;
const read = p => p >= .7 ? 'yes' : p <= .3 ? 'no' : 'unsure';

// The whole hiring policy. Jev never sees any of this.
function policy({ p, role, weights, interview }) {
  const steps = [];
  const fits = k => J[k].role === role || J[k].role === 'both';
  const mean = ks => ks.reduce((s, k) => s + p(k), 0) / ks.length;
  const bucket = b => mean(DATA.buckets[b].keys.filter(k => fits(k) && !NOT_SCORED.has(k)));

  // 1. The job description's only hard requirement.
  const req = read(p('three_years'));
  if (req === 'no') return { verdict: 'No hire', why: 'Fails the one hard requirement: >3 years as a SWE or developer advocate.', steps };
  if (req === 'unsure') steps.push('Ask a person whether 5 years as a CTO count as “software engineer”.');
  // A bad structured interview vetoes, whatever the rest says: it's the best single predictor.
  if (interview === 'bad') return { verdict: 'No hire', why: 'The structured interview went badly. The best single predictor gets a veto.', steps: [] };

  // 2. A weighted score. Until the interview happens, it is a range, not a number.
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  const score = iv => Object.entries(weights).reduce((s, [b, w]) =>
    s + w / total * (b === 'other' ? (iv + bucket('other')) / 2 : bucket(b)), 0);
  const iv = { pending: [0, 1], good: [1, 1], bad: [0, 0] }[interview];
  const [lo, hi] = iv.map(score);

  // 3. Thresholds: hire at 0.80, pass below 0.60, and a person decides in between.
  let verdict;
  if (lo >= .80) verdict = 'Hire';
  else if (hi < .60) verdict = 'No hire';
  else if (interview === 'pending') { verdict = 'Ask a person'; steps.push('Run the structured interview. The score can land anywhere in the range.'); }
  else { verdict = 'Ask a person'; steps.push('The score is in the unsure band. A person decides.'); }
  if (verdict === 'Hire' && steps.length) verdict = 'Ask a person';

  // 4. Flags inform, never decide.
  if (read(p('four_hours')) === 'no') steps.push('Flag: did not keep it to about 4 hours. Red flag, or the job?');
  return { verdict, lo, hi, steps };
}

function renderAnti() {
  $('anti-q').textContent = DATA.anti.question;
  const r = read(DATA.anti.p);
  $('anti-p').textContent = DATA.anti.p.toFixed(2);
  $('anti-p').className = r;
  $('anti-read').textContent = `Jev: ${{ yes: 'probably yes', no: 'probably not', unsure: 'unsure' }[r]} (${DATA.anti.ms} ms)`;
}

function renderBuckets() {
  $('buckets').innerHTML = Object.entries(DATA.buckets).map(([b, v]) => `
    <div class="hr-bucket"><h3>${esc(v.label)} <span>${esc(v.sub)}</span></h3>
    ${v.keys.filter(shown).map(row).join('')}${b === 'other' ? interviewRow() : ''}</div>`).join('')
    + `<div class="hr-bucket"><h3>Flags <span>Read by the policy, never scored</span></h3>${DATA.flags.map(row).join('')}</div>`;
  for (const el of document.querySelectorAll('.hr-row[data-k]')) el.onclick = () => cycle(el.dataset.k);
}

function row(k) {
  const j = J[k], p = prob(k), r = read(p), over = k in state.over, tag = '';
  return `<button class="hr-row ${r}${over ? ' over' : ''}${NOT_SCORED.has(k) ? ' unscored' : ''}" data-k="${k}" aria-label="${esc(j.question)}: ${p.toFixed(2)}. Tap to overrule.">
    <span class="hr-p">${p.toFixed(2)}</span>
    <span class="hr-body"><span class="hr-jq">${esc(j.question)}</span>
      <span class="hr-jd">${esc(j.jd)}${tag ? ` <em>${tag}</em>` : ''}${over ? ` <em class="hr-was">Jev said ${j.p.toFixed(2)}</em>` : ''}</span>
      ${NOTES[k] ? `<span class="hr-note">${esc(NOTES[k])}</span>` : ''}</span>
    <span class="hr-read">${r}</span></button>`;
}

function interviewRow() {
  const r = { pending: 'unsure', good: 'yes', bad: 'no' }[state.interview];
  return `<div class="hr-row ${r} static"><span class="hr-p">${state.interview === 'pending' ? '?' : state.interview === 'good' ? '1' : '0'}</span>
    <span class="hr-body"><span class="hr-jq">Structured interview</span><span class="hr-jd">The best single predictor in 2022 (.42). Not a Jev question: it hasn’t happened. Set it below.</span></span>
    <span class="hr-read">${state.interview === 'pending' ? 'Tuesday' : state.interview}</span></div>`;
}

// Jev's answer → overruled yes → overruled no → Jev's answer.
function cycle(k) {
  if (!(k in state.over)) state.over[k] = read(J[k].p) === 'yes' ? 0 : 1;
  else if (state.over[k] === (read(J[k].p) === 'yes' ? 0 : 1)) state.over[k] = 1 - state.over[k];
  else delete state.over[k];
  render();
}

function renderControls() {
  $('presets').innerHTML = Object.entries(PRESETS).map(([k, v]) =>
    `<button class="chip${k === state.preset ? ' active' : ''}" role="radio" aria-checked="${k === state.preset}" data-k="${k}">${esc(v.label)}</button>`).join('');
  $('interview').innerHTML = ['pending', 'good', 'bad'].map(k =>
    `<button aria-pressed="${k === state.interview}" data-k="${k}">${{ pending: 'Not yet', good: 'Went well', bad: 'Went badly' }[k]}</button>`).join('');
  for (const b of $('presets').children) b.onclick = () => { state.preset = b.dataset.k; render(); };
  for (const b of $('interview').children) b.onclick = () => { state.interview = b.dataset.k; render(); };
  const w = PRESETS[state.preset].w, t = Object.values(w).reduce((a, b) => a + b, 0);
  $('preset-note').textContent = PRESETS[state.preset].note + ' Now: ' +
    Object.entries(w).map(([b, x]) => `${DATA.buckets[b].label.replace('?', '')} ${Math.round(100 * x / t)}%`).join(' · ') + '.';
}

// The score as a colored scale: red below 0.60 (pass), amber 0.60–0.80 (ask a person),
// green from 0.80 (hire). The dark band is where the score can land.
const MIN = 0.4, pos = x => `${(100 * (Math.max(MIN, Math.min(1, x)) - MIN) / (1 - MIN)).toFixed(2)}%`;
function scale(lo, hi) {
  const zones = [['no', MIN, .6, 'Pass'], ['unsure', .6, .8, 'Ask a person'], ['yes', .8, 1, 'Hire']];
  return `<div class="hr-scale" role="img" aria-label="Score ${lo.toFixed(2)} to ${hi.toFixed(2)}, on a scale where 0.60 to 0.80 means ask a person">
    ${zones.map(([c, a, b, l]) => `<span class="hr-zone ${c}" style="left:${pos(a)};width:calc(${pos(b)} - ${pos(a)})"><i>${l}</i></span>`).join('')}
    </div><div class="hr-track"><span class="hr-band" style="left:${pos(lo)};width:calc(${pos(hi)} - ${pos(lo)})"></span></div><div class="hr-ticks"><span style="left:${pos(.6)}">0.60</span><span style="left:${pos(.8)}">0.80</span></div>`;
}

function renderRoles() {
  const o = policy({ p: prob, role: ROLE, weights: PRESETS[state.preset].w, interview: state.interview });
  // Round down, so a 0.7996 never shows as a passing 0.80.
  const f = x => (Math.floor(x * 100) / 100).toFixed(2);
  const range = o.lo == null ? '' : f(o.lo) === f(o.hi) ? f(o.lo) : `${f(o.lo)}–${f(o.hi)}`;
  const cls = { 'Hire': 'yes', 'No hire': 'no', 'Ask a person': 'unsure' }[o.verdict];
  $('roles').innerHTML = `<div class="hr-role ${cls}"><span class="hr-k">Developer Advocate</span>
    <strong>${esc(o.verdict)}</strong>${range ? `<span class="hr-range">score ${range}</span>${scale(o.lo, o.hi)}` : ''}
    ${o.why ? `<p>${esc(o.why)}</p>` : ''}
    ${o.steps.length ? `<ol>${o.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}</div>`;
}

function render() { renderBuckets(); renderControls(); renderRoles(); }

renderAnti();
render();
$('policy-src').textContent = policy.toString();
$('cost').textContent = `Jev answered every judgment above in one call (${DATA.ms} ms, ${DATA.input_tokens.toLocaleString()} input tokens, about $${(DATA.input_tokens * 0.042 / 1e6).toFixed(5)}) on ${DATA.model}, recorded ${DATA.recorded}. Cheaper than the recruiter’s coffee.`;
