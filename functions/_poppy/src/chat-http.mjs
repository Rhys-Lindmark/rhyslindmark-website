import { companyOrigin, readProposal } from '../public/commonplace-agent.mjs';

export { companyOrigin };
const maxBody = 3072;
const revisionPattern = /^[\w-]{43}$/;
const help = 'I can find a free Commonplace reading edition, explain its terms, and prepare a backup for you to approve. Try “Find me a reading edition.”';

function json(payload, status = 200, extra = {}) {
  return Response.json(payload, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra,
  } });
}

async function readMessage(request) {
  if (Number(request.headers.get('content-length')) > maxBody) return { status: 413 };
  if (!request.body) return { status: 400 };
  const reader = request.body.getReader();
  const buffer = new Uint8Array(maxBody);
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (size + value.byteLength > maxBody) {
        await reader.cancel().catch(() => {});
        return { status: 413 };
      }
      buffer.set(value, size);
      size += value.byteLength;
    }
    const body = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, size)));
    if (!body || typeof body.message !== 'string') return { status: 400 };
    const message = body.message.trim();
    if (!message || message.length > 400 ||
        (body.revision !== undefined && (typeof body.revision !== 'string' || !revisionPattern.test(body.revision)))) {
      return { status: 400 };
    }
    return { message, revision: body.revision };
  } catch {
    return { status: 400 };
  } finally {
    reader.releaseLock();
  }
}

function identifyIntent(message) {
  const words = message.toLowerCase().normalize('NFKC');
  if (/\b(cost|price|priced|how much|charge|free)\b/.test(words)) return 'price';
  if (/\b(authors?|who (?:wrote|said)|sources?|what(?: is|'s|’s) (?:inside|in it))\b/.test(words)) return 'sources';
  if (/\b(format|dimensions|what size|how big)\b/.test(words)) return 'format';
  if (/\b(download|approv(?:e|al)|export|backup)\b/.test(words)) return 'review';
  if (/\b(edition|booklet|commonplace|quotes?|quotations?|something to read)\b/.test(words)) return 'proposal';
  return 'help';
}

function describe(intent, terms) {
  const title = terms.title;
  if (intent === 'price') return title + ' is free. The listed price is zero US dollars.';
  if (intent === 'format') return title + ' is a five-by-eight-inch reading edition with ' + terms.quotes.length + ' quotations.';
  if (intent === 'sources') {
    const authors = [...new Set(terms.quotes.map(({ author }) => author))];
    return title + ' includes quotations from ' + new Intl.ListFormat('en-US').format(authors) + '.';
  }
  if (intent === 'review') return 'Open the review to approve and download your free Commonplace backup for ' + title + '.';
  return 'I found ' + title + ', a free five-by-eight-inch Commonplace edition with ' +
    terms.quotes.length + ' quotations. You can review the edition and approve the download.';
}

export async function handleAgentMessage(request, fetcher = fetch) {
  if (request.method !== 'POST') return json({ reply: 'Send a JSON message with POST.' }, 405, { Allow: 'POST' });
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    return json({ reply: 'Send the message as JSON.' }, 415);
  }
  const parsed = await readMessage(request);
  if (parsed.status) return json({ reply: 'Enter a message of 1 to 400 characters.' }, parsed.status);
  const intent = identifyIntent(parsed.message);
  if (intent === 'help') return json({ kind: 'help', reply: help });

  const proposal = await readProposal(companyOrigin, fetcher).catch(() => null);
  if (!proposal) return json({ reply: 'I couldn’t read the Commonplace catalog. Try again in a moment.' }, 502);
  const changed = Boolean(parsed.revision && proposal.revision !== parsed.revision);
  const reply = (changed ? 'The edition details changed. Review the new terms. ' : '') + describe(intent, proposal.terms);
  return json({
    kind: 'edition', reply, proposal,
    review_url: companyOrigin + '/poppy/agent?review=' + proposal.revision,
  });
}
