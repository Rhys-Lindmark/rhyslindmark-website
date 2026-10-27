import worker, { readBounded } from './signal-garden.js';

export const TOTAL_LIMIT = 100;
export const DAILY_IP_LIMIT = 5;
export const RESERVE_SQL = `INSERT OR IGNORE INTO signal_garden_spend (request_id, client_hash, day, created_at)
SELECT ?, ?, ?, ?
WHERE (SELECT COUNT(*) FROM signal_garden_spend) < 100
AND (SELECT COUNT(*) FROM signal_garden_spend WHERE client_hash = ? AND day = ?) < 5`;
const reply = (error, status) => Response.json({error}, {status, headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});

export async function handlePublicSearch({ request, env }) {
  const url = new URL(request.url);
  if (url.hostname !== 'ai.rhyslindmark.com') return reply('Not found.',404);
  if (request.method !== 'POST') return reply('Use POST.',405);
  if (request.headers.get('origin') !== url.origin) return reply('Same-origin requests only.',403);
  if (env.SIGNAL_GARDEN_ENABLED !== '1' || !env.SIGNAL_GARDEN_EXA_API_KEY || !env.SIGNAL_GARDEN_TURNSTILE_SECRET || !env.RHYSBOT_DB) return reply('Sponsored search is paused.',503);
  let body;
  try { body = await readBounded(request); } catch { return reply('Send valid JSON under 16 KB.',400); }
  if (typeof body.query !== 'string' || body.query.trim().length < 3 || body.query.length > 600 || !['research','practice','counterpoints'].includes(body.lens) || !['all','month','year'].includes(body.period)) return reply('Enter a topic and choose a valid search lens and date range.',400);
  if (typeof body.requestId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.requestId)) return reply('Invalid search request ID.',400);
  if (typeof body.turnstileToken !== 'string' || !body.turnstileToken || body.turnstileToken.length > 2048) return reply('Complete the human check before searching.',403);
  const ip = request.headers.get('cf-connecting-ip');
  if (!ip) return reply('Could not verify the request source.',403);
  let verification;
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method:'POST', headers:{'content-type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({secret:env.SIGNAL_GARDEN_TURNSTILE_SECRET,response:body.turnstileToken,remoteip:ip}),
      signal:AbortSignal.timeout(10000)
    });
    if (!r.ok) return reply('Human verification is unavailable. Please try again later.',503);
    verification = await readBounded(r);
  } catch { return reply('Human verification is unavailable. Please try again later.',503); }
  if (verification.success !== true || verification.hostname !== 'ai.rhyslindmark.com' || verification.action !== 'signal_garden_search') return reply('Human check failed or expired. Complete it again.',403);
  const hashBytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.SIGNAL_GARDEN_TURNSTILE_SECRET + ':' + ip));
  const clientHash = [...new Uint8Array(hashBytes)].map(b=>b.toString(16).padStart(2,'0')).join('');
  const now = new Date().toISOString();
  let reservation;
  try {
    // One atomic write decides all limits and deduplication. Reserve before the paid call.
    reservation = await env.RHYSBOT_DB.prepare(RESERVE_SQL).bind(body.requestId,clientHash,now.slice(0,10),now,clientHash,now.slice(0,10)).run();
    if (reservation.success !== true) return reply('Could not check the search budget. No search was started.',503);
  } catch { return reply('Could not check the search budget. No search was started.',503); }
  if (reservation.meta?.changes !== 1) return reply('This request was already used, or the search limit was reached (5 per IP daily; 100 total).',429);
  // Exactly one call. Failed/abandoned attempts consume their reservation; never auto-retry/refund.
  url.pathname='/api/search';
  const internal = new Request(url, {method:'POST',headers:{origin:url.origin,'content-type':'application/json'},body:JSON.stringify({query:body.query,lens:body.lens,period:body.period,apiKey:env.SIGNAL_GARDEN_EXA_API_KEY})});
  return worker.fetch(internal);
}
