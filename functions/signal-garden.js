import worker from './_lib/signal-garden.js';
export function onRequest({request}) {
  const url = new URL(request.url);
  if (url.hostname !== 'ai.rhyslindmark.com' && !url.hostname.endsWith('.pages.dev')) return new Response('Not found', {status:404});
  url.pathname = '/';
  return worker.fetch(new Request(url, request));
}
