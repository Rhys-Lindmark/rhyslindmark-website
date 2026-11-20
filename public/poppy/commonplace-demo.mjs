const start = document.querySelector('#start');
const approve = document.querySelector('#approve');
const status = document.querySelector('#status');
const terms = document.querySelector('#terms');
const trace = document.querySelector('#trace-body');
const review = document.querySelector('#review');
let edition;

async function get(path) {
  const url = new URL(path, location.origin);
  if (url.origin !== location.origin || url.username || url.password) throw new Error('Unexpected store URL.');
  const row = trace.insertRow();
  row.insertCell().textContent = 'GET ' + url.pathname;
  const cell = row.insertCell();
  cell.textContent = 'Waiting';
  try {
    const response = await fetch(url, { redirect: 'error' });
    cell.textContent = response.status;
    if (!response.ok) throw new Error('The store returned HTTP ' + response.status + '.');
    return await response.json();
  } catch (error) {
    if (cell.textContent === 'Waiting') cell.textContent = 'Unavailable';
    throw error;
  }
}

start.addEventListener('click', async () => {
  start.disabled = true;
  review.hidden = true;
  trace.replaceChildren();
  status.textContent = 'Discovering Commonplace…';
  try {
    const discovery = await get('/.well-known/poppy.json');
    if (discovery.protocol_version !== '1.0' || discovery.organization?.domain !== location.host) {
      throw new Error('Commonplace discovery did not match this host.');
    }
    const description = discovery.apis.find((api) => api.type === 'openapi');
    const openAPI = await get(description.url);
    const [endpoint] = Object.entries(openAPI.paths).find(([, operation]) =>
      operation.get?.operationId === 'getCommonplaceEdition');
    const proposal = await get(endpoint);
    if (proposal.store !== 'Commonplace' || proposal.format !== '5x8' ||
        proposal.price !== '0.00' || proposal.currency !== 'USD' ||
        typeof proposal.title !== 'string' || !Array.isArray(proposal.quotes) ||
        !proposal.quotes.every(({ id }) => /^press-[\w-]+$/.test(id))) {
      throw new Error('The edition terms did not match the requested free draft.');
    }
    edition = proposal;
    document.querySelector('#edition-title').textContent = proposal.title;
    terms.textContent = proposal.quotes.length + ' quotations. 5 × 8 inches. USD 0.00.';
    const sources = document.querySelector('#edition-sources');
    sources.replaceChildren();
    for (const label of new Set(proposal.quotes.map(({ author, source }) => author + ' — ' + source))) {
      const item = document.createElement('li');
      item.textContent = label;
      sources.append(item);
    }
    review.hidden = false;
    status.textContent = 'Edition ready for review.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    start.disabled = false;
  }
});

approve.addEventListener('click', () => {
  if (!edition) return;
  const approved = edition;
  const backup = {
    version: 1,
    exported: new Date().toISOString(),
    state: {
      selected: approved.quotes.map(({ id }) => id), favorites: [], custom: [], ratings: {}, shelf: [],
      book: { title: approved.title, author: '', format: approved.format, theme: 'forest', sources: true },
    },
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
  const download = document.createElement('a');
  download.href = url;
  download.download = 'commonplace-' + approved.id + '.json';
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  status.textContent = 'Commonplace edition downloaded.';
});
