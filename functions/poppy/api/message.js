import { companyOrigin, handleAgentMessage } from '../../_poppy/src/chat-http.mjs';
import { poppyDiscovery } from '../../_lib/poppy-discovery.js';

export function onRequest(context) {
  if (new URL(context.request.url).origin !== companyOrigin) {
    return new Response(null, { status: 404 });
  }
  return handleAgentMessage(context.request, (url, options) => {
    if (url === companyOrigin + '/.well-known/poppy.json') return Response.json(poppyDiscovery);
    return context.env.ASSETS.fetch(new Request(url, options));
  });
}
