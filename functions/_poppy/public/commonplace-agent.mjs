import { discoverEdition } from './commonplace-client.mjs';

export const companyOrigin = 'https://ai.rhyslindmark.com';

function fetchDocument(url, options) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(6000) });
}

export async function readProposal(origin = companyOrigin, fetcher = fetchDocument) {
  const requests = [];
  const terms = await discoverEdition(origin, async (url) => {
    const response = await fetcher(url, {
      headers: { Accept: 'application/json' }, redirect: 'error',
    });
    requests.push({ method: 'GET', url, status: response.status });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new Error('Commonplace returned HTTP ' + response.status + '.');
    }
    return response.json();
  });
  const bytes = new TextEncoder().encode(JSON.stringify(terms));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const revision = btoa(String.fromCharCode(...hash)).replace(/=+$/, '').replaceAll('+', '-').replaceAll('/', '_');
  return { revision, terms, requests };
}
