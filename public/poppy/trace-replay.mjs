const replay = document.querySelector('[data-delivery-replay]');
const requests = Array.from(replay.querySelectorAll('tbody tr'));
const controls = replay.querySelector('[data-replay-controls]');
const start = controls.querySelector('[data-replay-start]');
const navigation = controls.querySelector('[data-replay-navigation]');
const previous = navigation.querySelector('[data-replay-previous]');
const next = navigation.querySelector('[data-replay-next]');
const progress = controls.querySelector('[role="status"]');
let current = -1;

function renderStep(position) {
  current = position;
  const showingAll = position === -1;
  requests.forEach((row, index) => {
    row.hidden = !showingAll && index !== position;
    const details = row.querySelector('details');
    if (details) details.open = index === position;
  });
  start.hidden = !showingAll;
  navigation.hidden = showingAll;
  previous.disabled = position <= 0;
  next.disabled = position >= requests.length - 1;
  progress.textContent = showingAll
    ? 'Showing all ' + requests.length + ' requests.'
    : 'Request ' + (position + 1) + ' of ' + requests.length + '. ' +
      requests[position].querySelector('code').textContent + '. HTTP ' + requests[position].cells[2].textContent + '.';
}

start.addEventListener('click', () => {
  renderStep(0);
  next.focus();
});
previous.addEventListener('click', () => renderStep(current - 1));
next.addEventListener('click', () => renderStep(current + 1));
navigation.querySelector('[data-replay-restart]').addEventListener('click', () => renderStep(0));
navigation.querySelector('[data-replay-all]').addEventListener('click', () => {
  renderStep(-1);
  start.focus();
});
controls.hidden = false;
