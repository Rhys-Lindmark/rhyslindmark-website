// Types each command, then prints its recorded output line by line. ANSI bold/dim/colors
// from the scripts become spans.
import { STEPS } from './steps.js?v=replay-1';

const term = document.getElementById('rp-term'), $ = id => document.getElementById(id);
const SGR = { 1: 'b', 2: 'dim', 31: 'red', 32: 'green', 33: 'yellow', 36: 'cyan' };
let next = 0, busy = false, skip = false;
const sleep = ms => skip ? Promise.resolve() : new Promise(r => setTimeout(r, ms));

// Text with ANSI SGR codes -> a fragment of spans.
function ansi(text) {
  const frag = document.createDocumentFragment(); let cls = [];
  for (const part of text.split(/(\x1b\[[0-9;]*m)/)) {
    const m = part.match(/^\x1b\[([0-9;]*)m$/);
    if (m) { const codes = m[1].split(';').map(Number); cls = codes.includes(0) || !m[1] ? [] : [...cls, ...codes.map(c => SGR[c]).filter(Boolean)]; continue; }
    if (!part) continue;
    const span = document.createElement('span'); if (cls.length) span.className = cls.join(' '); span.textContent = part; frag.append(span);
  }
  return frag;
}
const scroll = () => { term.scrollTop = term.scrollHeight; };

async function run(i) {
  const s = STEPS[i];
  $('rp-say').textContent = s.say;
  const prompt = document.createElement('span'); prompt.className = 'prompt'; prompt.textContent = '$ ';
  term.append(prompt);
  for (const ch of s.cmd) { term.append(ch); scroll(); await sleep(45); }
  term.append('\n'); await sleep(350);
  for (const line of s.out.split('\n')) { term.append(ansi(line + '\n')); scroll(); await sleep(line.trim() ? 70 : 20); }
  $('rp-count').textContent = `${i + 1} / ${STEPS.length}`;
}
async function play() {
  if (busy || next >= STEPS.length) return;
  busy = true; $('rp-play').disabled = true;
  await run(next++);
  busy = false; $('rp-play').disabled = next >= STEPS.length;
  $('rp-play').textContent = next >= STEPS.length ? 'Done' : '▶ Run the next command';
}
async function all() { skip = true; while (busy) await new Promise(r => setTimeout(r, 20)); while (next < STEPS.length) await play(); skip = false; }
function reset() { skip = true; setTimeout(() => { skip = false; next = 0; busy = false; term.replaceChildren(); $('rp-say').textContent = ''; $('rp-count').textContent = `0 / ${STEPS.length}`; $('rp-play').disabled = false; $('rp-play').textContent = '▶ Run the next command'; }, 60); }

$('rp-play').addEventListener('click', play);
$('rp-all').addEventListener('click', all);
$('rp-reset').addEventListener('click', reset);
addEventListener('keydown', e => { if (e.key === ' ' && !e.target.closest('button,input,textarea')) { e.preventDefault(); play(); } });
$('rp-count').textContent = `0 / ${STEPS.length}`;
