import { examples } from './telegram-demo-data.mjs';

const examplePicker = document.querySelector('#demo-example');
const overview = document.querySelector('#demo-overview');
const axis = document.querySelector('#demo-axis');
const waterfall = document.querySelector('#demo-waterfall');
const stats = document.querySelector('#demo-stats');
const inspector = document.querySelector('#demo-inspector');
const spanTitle = inspector.querySelector('h3');
const evidence = inspector.querySelector('[data-evidence]');
const payloads = inspector.querySelectorAll('pre');
const duration = (ms) => ms < 1000 ? Math.round(ms) + ' ms' : (ms / 1000).toFixed(2) + ' s';
const kinds = { channel: 'Telegram', model: 'Model', tool: 'Tool', pap: 'PAP' };

function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function timing(spans, total) {
  const rail = element('span', undefined, 'demo-rail');
  rail.setAttribute('aria-hidden', 'true');
  for (const { start, end, kind } of spans) {
    const bar = element('span', undefined, 'demo-bar ' + kind);
    bar.style.left = start / total * 100 + '%';
    bar.style.width = (end - start) / total * 100 + '%';
    rail.append(bar);
  }
  return rail;
}

function inspect(span, active) {
  for (const button of waterfall.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button === active));
  }
  spanTitle.textContent = span.name;
  inspector.querySelector('[data-span-meta]').textContent =
    [kinds[span.kind], duration(span.start) + ' offset', duration(span.end - span.start)].join(' · ');
  evidence.hidden = !span.evidence;
  evidence.textContent = span.evidence ?? '';
  payloads[0].textContent = JSON.stringify(span.input, null, 2);
  payloads[1].textContent = JSON.stringify(span.output, null, 2);
}

function render(index) {
  const { spans } = examples[index];
  const total = spans[0].end;
  const tools = spans[0].output.tool_calls;
  const pap = spans.filter(({ kind }) => kind === 'pap').length;
  stats.textContent = [
    duration(total), spans.length + ' spans', tools + (tools === 1 ? ' tool call' : ' tool calls'),
    pap + ' PAP requests',
  ].join(' · ');

  overview.replaceChildren(...Object.entries(kinds).map(([kind, label]) => {
    const lane = element('div', undefined, 'demo-lane');
    lane.append(element('span', label), timing(spans.filter((span) => span.kind === kind), total));
    return lane;
  }));
  axis.replaceChildren(...[0, 0.25, 0.5, 0.75, 1].map((fraction) => element('span', duration(total * fraction))));

  let initial;
  waterfall.replaceChildren(...spans.map((span, position) => {
    const item = element('li');
    const button = element('button', undefined, 'demo-span');
    button.type = 'button';
    const name = element('span', span.name, 'demo-span-name depth-' + span.depth);
    if (span.kind === 'pap') name.append(' ', element('small', 'PAP'));
    button.append(name, timing([span], total), element('span', duration(span.end - span.start), 'demo-duration'));
    button.addEventListener('click', () => inspect(span, button));
    if (position === 0) initial = button;
    item.append(button);
    return item;
  }));
  inspect(spans[0], initial);
}

examplePicker.replaceChildren(...examples.map(({ title }, index) => new Option(title, String(index))));
examplePicker.addEventListener('change', () => render(Number(examplePicker.value)));
render(0);
document.querySelector('#demo-explorer').hidden = false;
