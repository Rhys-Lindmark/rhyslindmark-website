import { editionBackup } from './commonplace-client.mjs';

const form = document.querySelector('#agent-form');
const input = form.elements.message;
const send = form.querySelector('button');
const messages = document.querySelector('#agent-messages');
const status = document.querySelector('#agent-status');
const review = document.querySelector('#agent-review');
const approve = document.querySelector('#agent-approve');
const reviewIntro = document.querySelector('#agent-edition-title');
const reviewTerms = document.querySelector('#agent-terms');
const reviewSources = document.querySelector('#agent-sources');
const reviewRequests = document.querySelector('#agent-requests');
let proposal;

function addMessage(speaker, message) {
  const row = document.createElement('li');
  const label = document.createElement('strong');
  const text = document.createElement('p');
  label.textContent = speaker;
  text.textContent = message;
  row.dataset.speaker = speaker;
  row.append(label, text);
  messages.append(row);
  messages.scrollTop = messages.scrollHeight;
}

function showProposal(next) {
  proposal = next;
  const { terms, requests } = proposal;
  reviewIntro.textContent = terms.title;
  reviewTerms.textContent = terms.quotes.length + ' quotations · 5 × 8 inches · USD 0.00';
  reviewSources.replaceChildren();
  for (const { author, source } of terms.quotes) {
    const item = document.createElement('li');
    item.textContent = author + ' — ' + source;
    reviewSources.append(item);
  }
  reviewRequests.replaceChildren();
  for (const { method, url, status } of requests) {
    const item = document.createElement('li');
    const route = document.createElement('code');
    route.textContent = method + ' ' + new URL(url).pathname;
    item.append(route, document.createTextNode(' · HTTP ' + status));
    reviewRequests.append(item);
  }
  review.hidden = false;
}

async function sendMessage(message, revision = proposal?.revision) {
  if (!message || send.disabled) return;
  send.disabled = true;
  approve.disabled = true;
  addMessage('You', message);
  status.textContent = 'Poppy is checking your request…';
  try {
    const response = await fetch('/poppy/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ message, revision }),
      signal: AbortSignal.timeout(9000),
    });
    const data = await response.json();
    if (typeof data.reply !== 'string') throw new Error('Missing reply');
    addMessage('Poppy', data.reply);
    if (response.ok && data.kind === 'edition') showProposal(data.proposal);
  } catch {
    addMessage('Poppy', 'I couldn’t reach the agent. Try sending your message again.');
  } finally {
    status.textContent = '';
    send.disabled = false;
    approve.disabled = false;
  }
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message || send.disabled) return;
  input.value = '';
  input.focus();
  void sendMessage(message);
});

approve.addEventListener('click', () => {
  if (!proposal) return;
  const { terms } = proposal;
  const backup = editionBackup(terms);
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const download = document.createElement('a');
  download.href = url;
  download.download = 'commonplace-' + terms.id + '.json';
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  addMessage('Poppy', 'Your backup for ' + terms.title + ' is ready. Open Commonplace and choose Restore to import it.');
});

const reviewRevision = new URLSearchParams(location.search).get('review');
if (reviewRevision && /^[\w-]{43}$/.test(reviewRevision)) {
  void sendMessage('Show me the Commonplace edition for review.', reviewRevision);
}
