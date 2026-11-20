import { companyOrigin, handleAgentMessage } from '../../_poppy/src/chat-http.mjs';
import { companyDocuments } from '../../_poppy/company-documents.mjs';
import { poppyDiscovery } from '../../_lib/poppy-discovery.js';

export function onRequest(context) {
  if (new URL(context.request.url).origin !== companyOrigin) {
    return new Response(null, { status: 404 });
  }
  return handleAgentMessage(context.request, (url) => {
    if (url === companyOrigin + '/.well-known/poppy.json') return Response.json(poppyDiscovery);
    const path = new URL(url).pathname;
    return Object.hasOwn(companyDocuments, path)
      ? Response.json(companyDocuments[path])
      : new Response(null, { status: 404 });
  });
}
