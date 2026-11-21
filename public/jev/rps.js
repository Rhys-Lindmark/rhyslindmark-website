const $ = id => document.getElementById(id);
const THROWS = ['rock', 'paper', 'scissors'];
const NAMES = { rock: 'Rock', paper: 'Paper', scissors: 'Scissors' };
const ICONS = { rock: '✊', paper: '✋', scissors: '✌️' };
const BEATS = { rock: 'paper', paper: 'scissors', scissors: 'rock' };
const MAX_ROUNDS = 30;
const pct = n => `${Math.round(n * 100)}%`;
let history = [], widgetId, token = '', busy = false, rendered = false;
const score = { you: 0, jev: 0, tie: 0 };
const buttons = () => document.querySelectorAll('[data-throw]');
const setButtons = () => { for (const b of buttons()) b.disabled = busy || !token; };
const showError = message => { $('rps-error').textContent = message; $('rps-error').hidden = false; };
function outcome(player, jev) { return player === jev ? 'tie' : BEATS[jev] === player ? 'you' : 'jev'; }
function renderScore() { $('rps-score').textContent = `You ${score.you} · Jev ${score.jev} · Ties ${score.tie}`; }
function renderHistory() {
  const list = $('rps-history');
  list.replaceChildren(...history.map((r, i) => {
    const li = document.createElement('li');
    const result = { you: 'you won', jev: 'Jev won', tie: 'tie' }[outcome(r.player, r.jev)];
    li.textContent = `${i + 1}. You ${NAMES[r.player]}, Jev ${NAMES[r.jev]} (${pct(r.p)}): ${result}`;
    return li;
  }).reverse());
  $('rps-history-wrap').hidden = history.length === 0;
}
function render() {
  if (rendered || !window.turnstile) return;
  rendered = true;
  widgetId = window.turnstile.render('#rps-human-check', {
    sitekey: '0x4AAAAAAFoxX_DwyD2--6xP', action: 'jev_check', theme: 'light',
    callback: t => { token = t; setButtons(); },
    'expired-callback': () => { token = ''; setButtons(); },
    'error-callback': () => { token = ''; setButtons(); showError('Human verification unavailable. Reload to try again.'); }
  });
}
window.jevRenderRps = render;
render();
for (const button of buttons()) button.addEventListener('click', async () => {
  if (!token) { showError('Complete the human verification.'); return; }
  const player = button.dataset.throw;
  busy = true; setButtons(); $('rps-error').hidden = true;
  $('rps-status').textContent = 'Jev is throwing…';
  document.querySelector('#choice .results').setAttribute('aria-busy', 'true');
  try {
    // Only previous rounds are sent. Jev never sees the throw you just clicked.
    const response = await fetch('/api/jev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ demo: 'rps', history: history.slice(-MAX_ROUNDS).map(({ player, jev }) => ({ player, jev })), verification_token: token }), signal: AbortSignal.timeout(45000) });
    let data; try { data = await response.json(); } catch { throw new Error('The server returned an unreadable response. Please try again.'); }
    if (!response.ok) throw new Error(data.error || 'The round failed. Please try again.');
    const jev = data.throw, result = outcome(player, jev);
    score[result]++; history.push({ player, jev, p: data.probabilities[jev] });
    renderScore(); renderHistory();
    $('rps-empty').hidden = true; $('rps-output').hidden = false; $('rps-status').textContent = '';
    $('rps-you').textContent = `${ICONS[player]} ${NAMES[player]}`;
    $('rps-jev').textContent = `${ICONS[jev]} ${NAMES[jev]}`;
    $('rps-outcome').textContent = { you: 'You win', jev: 'Jev wins', tie: 'Tie' }[result];
    $('rps-bars').replaceChildren(...THROWS.map(id => {
      const row = document.createElement('div'); row.className = 'bar-row' + (id === jev ? ' picked' : '');
      const line = document.createElement('div'); line.className = 'bar-label';
      const title = document.createElement('span'); title.textContent = `${ICONS[id]} ${NAMES[id]}`;
      const amount = document.createElement('span'); amount.textContent = pct(data.probabilities[id]);
      line.append(title, amount);
      const track = document.createElement('div'); track.className = 'track';
      const fill = document.createElement('div'); fill.className = 'fill'; fill.style.width = pct(data.probabilities[id]);
      track.append(fill); row.append(line, track); return row;
    }));
    $('rps-confidence').textContent = data.confidence === null ? 'Not provided' : pct(data.confidence);
    $('rps-meta').textContent = `${data.model} · ${(data.elapsed_ms / 1000).toFixed(2)}s`;
  } catch (error) {
    $('rps-status').textContent = '';
    showError(error.name === 'TimeoutError' ? 'The request timed out. Please try again.' : error.message);
  } finally {
    busy = false; token = ''; setButtons();
    if (widgetId !== undefined) window.turnstile.reset(widgetId);
    document.querySelector('#choice .results').setAttribute('aria-busy', 'false');
  }
});
$('rps-reset').addEventListener('click', () => {
  history = []; Object.assign(score, { you: 0, jev: 0, tie: 0 });
  renderScore(); renderHistory();
  $('rps-output').hidden = true; $('rps-empty').hidden = false; $('rps-error').hidden = true;
});
renderScore();
