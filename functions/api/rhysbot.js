// Pages route /api/rhysbot. Source-only until the operator configures verified
// checkpoints, Turnstile, and a Modal proxy token. No cookies, retries, or fallback.
// Rate/spend limits live in the authenticated Modal backend's persistent ledger:
// 3/client/hour, 6/client/day, 25/global/day, shared $200 cap; not isolate memory.
const ORIGIN = 'https://ai.rhyslindmark.com';
const HOSTNAME = 'ai.rhyslindmark.com';
const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const ENCODER = new TextEncoder();
const BODY_LIMIT = 8192;
const RESPONSE_LIMIT = 65536;
const PROMPT_LIMIT = 1600;
const TOKEN_LIMIT = 64;
const DEFAULT_TOKENS = 32;
const ALLOWED_MODELS = ['nanochat', 'qwen'];

class Failure extends Error {
  constructor(status, code) { super(code); this.status = status; this.code = code; }
}

function json(body, status = 200, cors = false, extra = {}) {
  return Response.json(body, { status, headers: {
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin', ...(cors ? { 'Access-Control-Allow-Origin': ORIGIN } : {}), ...extra,
  } });
}

function configured(env) {
  try {
    const models = String(env.RHYSBOT_ENABLED_MODELS || '').split(',').map(x => x.trim());
    if (!models.length || new Set(models).size !== models.length || models.some(x => !ALLOWED_MODELS.includes(x))) return null;
    const url = new URL(env.RHYSBOT_MODAL_URL);
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.modal\.run$/.test(url.hostname)
        || url.port || url.username || url.password || url.search || url.hash
        || !['/', '/generate'].includes(url.pathname)) return null;
    url.pathname = '/generate';
    for (const name of ['MODAL_PROXY_KEY', 'MODAL_PROXY_SECRET', 'RHYSBOT_CLIENT_SALT', 'RHYSBOT_TURNSTILE_SECRET', 'RHYSBOT_TURNSTILE_SITE_KEY']) {
      const value = env[name];
      if (typeof value !== 'string' || !value.trim() || value.length > 4096 || /[\r\n]/.test(value)) return null;
    }
    if (ENCODER.encode(env.RHYSBOT_CLIENT_SALT).length < 32 || !/^[A-Za-z0-9_-]{1,256}$/.test(env.RHYSBOT_TURNSTILE_SITE_KEY)) return null;
    return { models, url: url.href, sitekey: env.RHYSBOT_TURNSTILE_SITE_KEY };
  } catch { return null; }
}

function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', abort);
    const abort = () => { cleanup(); reject(signal.reason); };
    signal.addEventListener('abort', abort, { once: true });
    // Observe rejection even when the signal was already aborted, so a cancelled
    // stream/fetch cannot leave an unhandled promise behind.
    Promise.resolve(promise).then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
    if (signal.aborted) abort();
  });
}

async function deadline(milliseconds, callback) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('deadline')), milliseconds);
  try { return await callback(controller.signal); } finally { clearTimeout(timer); }
}

// Content-Length alone is never trusted. Count streamed bytes before decoding.
async function boundedJSON(message, limit, signal, overflowStatus) {
  const length = message.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) throw new Failure(overflowStatus, 'body_too_large');
  const reader = message.body?.getReader();
  if (!reader) throw new Failure(400, 'invalid_json');
  const chunks = []; let total = 0; let done = false;
  try {
    while (true) {
      const next = await abortable(reader.read(), signal);
      if (next.done) { done = true; break; }
      total += next.value.byteLength;
      if (total > limit) throw new Failure(overflowStatus, 'body_too_large');
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(total); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new Failure(400, 'invalid_json'); }
  } finally {
    if (!done) { try { await abortable(reader.cancel(), signal); } catch {} }
    reader.releaseLock();
  }
}

function clientIP(request) {
  const ip = request.headers.get('CF-Connecting-IP');
  if (!ip || ip.length > 45) throw new Failure(403, 'trusted_client_required');
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
    const pieces = ip.split('.');
    if (pieces.some(x => Number(x) > 255 || String(Number(x)) !== x)) throw new Failure(403, 'trusted_client_required');
    return ip;
  }
  if (/^[0-9a-fA-F:]+$/.test(ip) && ip.includes(':')) {
    try { return new URL(`http://[${ip}]/`).hostname; } catch {}
  }
  throw new Failure(403, 'trusted_client_required');
}

async function clientIdentity(ip, salt) {
  const key = await crypto.subtle.importKey('raw', ENCODER.encode(salt), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, ENCODER.encode(`rhysbot-client-v1:${ip}`));
  return Array.from(new Uint8Array(signature), x => x.toString(16).padStart(2, '0')).join('');
}

function validatedBody(body, models) {
  if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some(x => !['model', 'prompt', 'max_new_tokens', 'verification_token'].includes(x))) throw new Failure(400, 'invalid_request');
  if (!models.includes(body.model)) throw new Failure(400, 'model_not_enabled');
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || ENCODER.encode(body.prompt).length > PROMPT_LIMIT
      || body.prompt.includes('<|') || body.prompt.includes('|>')) throw new Failure(400, 'invalid_prompt');
  const tokens = body.max_new_tokens === undefined ? DEFAULT_TOKENS : body.max_new_tokens;
  if (!Number.isInteger(tokens) || tokens < 1 || tokens > TOKEN_LIMIT) throw new Failure(400, 'invalid_token_limit');
  if (typeof body.verification_token !== 'string' || !body.verification_token.trim() || body.verification_token.length > 2048) throw new Failure(403, 'verification_required');
  return { model: body.model, prompt: body.prompt, max_new_tokens: tokens };
}

function successfulResult(payload, request) {
  if (!payload || payload.ok !== true || payload.model !== request.model || typeof payload.text !== 'string'
      || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(payload.checkpoint_run_id || '')
      || !/^[a-f0-9]{64}$/.test(payload.weights_sha256 || '') || typeof payload.identity !== 'string'
      || !payload.identity.trim() || payload.identity.length > 1000 || payload.tools_executed !== false
      || !Number.isInteger(payload.input_tokens) || payload.input_tokens < 1
      || !Number.isInteger(payload.output_tokens) || payload.output_tokens < 0 || payload.output_tokens > request.max_new_tokens
      || !Number.isFinite(payload.latency_seconds) || payload.latency_seconds < 0) throw new Failure(502, 'invalid_checkpoint_response');
  return Object.fromEntries(['ok', 'text', 'model', 'checkpoint_run_id', 'weights_sha256', 'identity',
    'input_tokens', 'output_tokens', 'latency_seconds', 'tools_executed'].map(key => [key, payload[key]]));
}

// Injectable transport/timeouts enable finite Node tests without cloud calls.
// Production onRequest below always uses the fixed defaults.
export function createRhysbotHandler({ fetcher = globalThis.fetch, upstreamTimeoutMs = 230000,
  verificationTimeoutMs = 8000, bodyTimeoutMs = 5000 } = {}) {
  return async function handle({ request, env }) {
    const origin = request.headers.get('Origin');
    const cors = origin === ORIGIN;
    if (new URL(request.url).origin !== ORIGIN || (origin !== null && !cors)
        || (request.method !== 'GET' && !cors)) return json({ error: 'origin_not_allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      'Cache-Control': 'no-store', 'Vary': 'Origin', 'Access-Control-Allow-Origin': ORIGIN,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type',
    } });
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'method_not_allowed' }, 405, cors, { Allow: 'GET, POST, OPTIONS' });
    const config = configured(env);
    if (request.method === 'GET') return json({ enabled_models: config?.models || [], turnstile_site_key: config?.sitekey || null }, 200, cors);
    if (!config) return json({ error: 'inference_not_configured' }, 503, cors);
    if ((request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') return json({ error: 'json_required' }, 415, cors);
    try {
      const ip = clientIP(request);
      let body;
      try { body = await deadline(bodyTimeoutMs, signal => boundedJSON(request, BODY_LIMIT, signal, 413)); }
      catch (error) { if (error instanceof Failure) throw error; throw new Failure(408, 'request_timeout'); }
      const input = validatedBody(body, config.models);
      let verification;
      try {
        verification = await deadline(verificationTimeoutMs, async signal => {
          const result = await abortable(fetcher(SITEVERIFY, { method: 'POST', redirect: 'manual', signal,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ secret: env.RHYSBOT_TURNSTILE_SECRET, response: body.verification_token }) }), signal);
          if (!result.ok || result.redirected) throw new Error('verification unavailable');
          return await boundedJSON(result, BODY_LIMIT, signal, 502);
        });
      } catch { throw new Failure(503, 'verification_unavailable'); }
      if (verification?.success !== true || verification.hostname !== HOSTNAME || verification.action !== 'rhysbot_generate') throw new Failure(403, 'verification_failed');
      const client = await clientIdentity(ip, env.RHYSBOT_CLIENT_SALT);
      return await deadline(upstreamTimeoutMs, async signal => {
        // Build fresh headers; caller identity, cookies and verification token
        // never reach Modal. Origin is fixed and credentials are server-only.
        const response = await abortable(fetcher(config.url, { method: 'POST', redirect: 'manual', signal,
          headers: { 'Content-Type': 'application/json', Origin: ORIGIN, 'X-Rhysbot-Client': client,
            'Modal-Key': env.MODAL_PROXY_KEY, 'Modal-Secret': env.MODAL_PROXY_SECRET },
          body: JSON.stringify(input) }), signal);
        if (response.redirected || (response.status >= 300 && response.status < 400)) throw new Failure(502, 'upstream_redirect_rejected');
        if ((response.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') throw new Failure(502, 'invalid_checkpoint_response');
        let payload;
        try { payload = await boundedJSON(response, RESPONSE_LIMIT, signal, 502); }
        catch (error) { if (signal.aborted) throw error; throw new Failure(502, 'invalid_checkpoint_response'); }
        if (!response.ok) {
          const status = [400, 403, 409, 413, 429, 503].includes(response.status) ? response.status : 502;
          // Never reflect upstream errors/HTML, URLs, headers or credentials.
          const code = status === 429 ? 'rate_limited' : payload?.error === 'execution_uncertain_operator_check_required'
            ? 'execution_uncertain_operator_check_required' : status === 503 ? 'generation_unavailable' : 'generation_rejected';
          return json({ error: code }, status, cors);
        }
        return json(successfulResult(payload, input), 200, cors);
      });
    } catch (error) {
      if (error instanceof Failure) return json({ error: error.code }, error.status, cors);
      // A disconnected/timeout request may already have consumed a reservation.
      // Never retry: require operator reconciliation before another attempt.
      return json({ error: 'execution_uncertain_operator_check_required' }, 503, cors);
    }
  };
}

export const onRequest = createRhysbotHandler();
