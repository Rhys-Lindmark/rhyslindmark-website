const ui = document.querySelector('#simulation');
const select = ui.querySelector('select');
const run = ui.querySelector('[data-run]');
const pause = ui.querySelector('[data-pause]');
const next = ui.querySelector('[data-next]');
const chat = ui.querySelector('[data-chat]');
const events = ui.querySelector('[data-events]');
const status = ui.querySelector('[role="status"]');
let scenarios;
let scenario;
let index;
let timer;

function line(speaker, text) {
  const item = document.createElement('li');
  const name = document.createElement('strong');
  const message = document.createElement('p');
  name.textContent = speaker;
  message.textContent = text;
  item.append(name, message);
  chat.append(item);
}

function advance() {
  if (!scenario || index >= scenario.steps.length) return;
  const event = scenario.steps[index++];
  const li = document.createElement('li');
  const actor = document.createElement('p');
  const details = document.createElement('details');
  const summary = document.createElement('summary');
  const code = document.createElement('pre');
  actor.textContent = event.actor;
  summary.textContent = event.title;
  code.textContent = JSON.stringify({ request: event.request, response: event.response }, null, 2);
  details.append(summary, code);
  li.append(actor, details);
  events.append(li);
  status.textContent = `Step ${index} of ${scenario.steps.length}`;
  if (index === scenario.steps.length) {
    clearInterval(timer);
    timer = undefined;
    line('Poppy', scenario.reply);
    status.textContent = `Simulation complete · ${index} steps`;
    pause.disabled = true;
    next.disabled = true;
  }
}

function play() {
  clearInterval(timer);
  timer = setInterval(advance, 750);
  pause.textContent = 'Pause';
  next.disabled = true;
}

run.addEventListener('click', () => {
  scenario = scenarios.find((item) => item.id === select.value);
  if (!scenario) return;
  index = 0;
  chat.replaceChildren();
  events.replaceChildren();
  line('Training agent', scenario.prompt);
  pause.disabled = false;
  advance();
  play();
});

pause.addEventListener('click', () => {
  if (timer === undefined) return play();
  clearInterval(timer);
  timer = undefined;
  pause.textContent = 'Resume';
  next.disabled = false;
});
next.addEventListener('click', advance);

try {
  const response = await fetch('/poppy/agent-simulations.json', { redirect: 'error' });
  if (!response.ok) throw new Error('Simulation data unavailable');
  scenarios = (await response.json()).scenarios;
  run.disabled = false;
  status.textContent = 'Choose a scenario and run it.';
} catch {
  status.textContent = 'The simulation data could not load. Refresh to try again.';
}
