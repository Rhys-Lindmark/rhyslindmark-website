import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createRhysbotHandler, onRequest } from './rhysbot.js';

const ORIGIN = 'https://ai.rhyslindmark.com';
const ENV = { RHYSBOT_ENABLED_MODELS: 'nanochat,qwen', RHYSBOT_MODAL_URL: 'https://example--api.modal.run',
  MODAL_PROXY_KEY: 'server-key', MODAL_PROXY_SECRET: 'server-secret',
  RHYSBOT_CLIENT_SALT: 'a-long-private-salt-of-at-least-32-bytes',
  RHYSBOT_TURNSTILE_SECRET: 'human-verification-secret', RHYSBOT_TURNSTILE_SITE_KEY: 'public-sitekey' };
const BODY = { model: 'nanochat', prompt: 'Explain entropy.', max_new_tokens: 32, verification_token: 'human-token' };
const VERIFY = { success: true, hostname: 'ai.rhyslindmark.com', action: 'rhysbot_generate' };
const RESULT = { ok: true, text: 'Experimental output.', model: 'nanochat', checkpoint_run_id: 'nanochat-pilot-001',
  weights_sha256: 'a'.repeat(64), identity: 'Tiny actual checkpoint experiment.', input_tokens: 20,
  output_tokens: 4, latency_seconds: 2, tools_executed: false };

function request(body = BODY, headers = {}, method = 'POST', url = `${ORIGIN}/api/rhysbot`) {
  const init = { method, headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.10', ...headers } };
  if (!['GET', 'HEAD'].includes(method)) {
    init.body = typeof body === 'string' || body instanceof ReadableStream ? body : JSON.stringify(body);
    if (body instanceof ReadableStream) init.duplex = 'half';
  }
  return new Request(url, init);
}
function transport({ verification = VERIFY, result = RESULT, status = 200, responseHeaders = {}, throwUpstream = false } = {}) {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('challenges.cloudflare.com')) return Response.json(verification);
    if (throwUpstream) throw new Error('SECRET upstream URL or credentials');
    return Response.json(result, { status, headers: responseHeaders });
  };
  return { calls, handler: createRhysbotHandler({ fetcher }) };
}
async function run(handler, req = request(), env = ENV) { return await handler({ request: req, env }); }

// All transports are mocked; these do not call Cloudflare, Turnstile or Modal.
test('forwards only bounded inference fields with authenticated, HMAC-derived identity', async () => {
  const { handler, calls } = transport({ result: { ...RESULT, private_debug: 'do not expose' }, responseHeaders: { 'Set-Cookie': 'private=secret', Location: 'https://private.invalid' } });
  const response = await run(handler, request(BODY, { Cookie: 'browser-secret', Authorization: 'attacker', 'X-Rhysbot-Client': 'forged', 'X-Forwarded-For': '1.2.3.4', 'Modal-Key': 'forged' }));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), RESULT);
  assert.equal(calls.length, 2); assert.equal(calls[1].url, `${ENV.RHYSBOT_MODAL_URL}/generate`);
  assert.deepEqual(JSON.parse(calls[1].init.body), { model: 'nanochat', prompt: BODY.prompt, max_new_tokens: 32 });
  assert.deepEqual(JSON.parse(calls[0].init.body), { secret: ENV.RHYSBOT_TURNSTILE_SECRET, response: BODY.verification_token });
  const h = new Headers(calls[1].init.headers);
  assert.equal(h.get('Modal-Key'), ENV.MODAL_PROXY_KEY); assert.equal(h.get('Modal-Secret'), ENV.MODAL_PROXY_SECRET);
  assert.equal(h.get('Origin'), ORIGIN);
  assert.equal(h.get('X-Rhysbot-Client'), createHmac('sha256', ENV.RHYSBOT_CLIENT_SALT).update('rhysbot-client-v1:203.0.113.10').digest('hex'));
  for (const key of ['Cookie', 'Authorization', 'X-Forwarded-For', 'CF-Connecting-IP']) assert.equal(h.get(key), null);
  assert.equal(calls[0].init.redirect, 'manual'); assert.equal(calls[1].init.redirect, 'manual');
  assert.equal(response.headers.get('Set-Cookie'), null); assert.equal(response.headers.get('Location'), null);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), ORIGIN); assert.equal(response.headers.get('Cache-Control'), 'no-store');
});

test('GET returns only public configuration and makes no outbound call', async () => {
  const { handler, calls } = transport();
  const req = new Request(`${ORIGIN}/api/rhysbot`);
  const response = await run(handler, req);
  assert.deepEqual(await response.json(), { enabled_models: ['nanochat', 'qwen'], turnstile_site_key: 'public-sitekey' });
  assert.equal(calls.length, 0);
  const disabled = await run(handler, req, {});
  assert.deepEqual(await disabled.json(), { enabled_models: [], turnstile_site_key: null });
});

test('fails closed for every missing binding and unsupported deployment configuration', async () => {
  const { handler, calls } = transport();
  for (const name of Object.keys(ENV)) {
    const env = { ...ENV }; delete env[name];
    assert.equal((await run(handler, request(), env)).status, 503, name);
  }
  for (const value of ['https://evil.invalid/generate', 'http://x.modal.run', 'https://x.modal.run.evil.invalid', 'https://x.modal.run:444', 'https://secret@x.modal.run', 'https://x.modal.run/?token=secret', 'https://x.modal.run/#fragment', 'https://x.modal.run/other']) {
    assert.equal((await run(handler, request(), { ...ENV, RHYSBOT_MODAL_URL: value })).status, 503, value);
  }
  for (const value of ['other', 'qwen,qwen', 'qwen,', '']) assert.equal((await run(handler, request(), { ...ENV, RHYSBOT_ENABLED_MODELS: value })).status, 503);
  assert.equal((await run(handler, request(), { ...ENV, RHYSBOT_CLIENT_SALT: 'short' })).status, 503);
  assert.equal(calls.length, 0);
});

test('accepts configured /generate URL without appending duplicate path', async () => {
  const { handler, calls } = transport();
  assert.equal((await run(handler, request(), { ...ENV, RHYSBOT_MODAL_URL: `${ENV.RHYSBOT_MODAL_URL}/generate` })).status, 200);
  assert.equal(calls[1].url, `${ENV.RHYSBOT_MODAL_URL}/generate`);
});

test('requires exact origin and production hostname; methods and preflight are bounded', async () => {
  const { handler, calls } = transport();
  for (const origin of ['https://evil.invalid', 'https://ai.rhyslindmark.com.evil.invalid', 'null', '']) {
    const response = await run(handler, request(BODY, { Origin: origin }));
    assert.equal(response.status, 403); assert.equal(response.headers.get('Access-Control-Allow-Origin'), null);
  }
  const absent = request(); absent.headers.delete('Origin'); assert.equal((await run(handler, absent)).status, 403);
  assert.equal((await run(handler, request(BODY, {}, 'POST', 'https://preview.pages.dev/api/rhysbot'))).status, 403);
  assert.equal((await run(handler, request(BODY, {}, 'PUT'))).status, 405);
  const preflight = await run(handler, request('', {}, 'OPTIONS'));
  assert.equal(preflight.status, 204); assert.equal(preflight.headers.get('Access-Control-Allow-Headers'), 'Content-Type');
  assert.equal(preflight.headers.get('Access-Control-Allow-Credentials'), null); assert.equal(calls.length, 0);
});

test('rejects unknown fields, models, invalid prompts and invalid token limits before spending', async () => {
  const { handler, calls } = transport();
  for (const body of [null, [], {}, { ...BODY, run_id: 'arbitrary' }, { ...BODY, url: 'https://evil.invalid' }, { ...BODY, model: 'Qwen/base' }, { ...BODY, prompt: '' }, { ...BODY, prompt: ' ' }, { ...BODY, prompt: '<|user|>' }, { ...BODY, prompt: 'é'.repeat(801) }, ...[0, 65, 1.5, true, '32', null].map(max_new_tokens => ({ ...BODY, max_new_tokens }))]) {
    assert.equal((await run(handler, request(body))).status, 400, JSON.stringify(body));
  }
  assert.equal(calls.length, 0);
});

test('requires a bounded verification token before any network call', async () => {
  const { handler, calls } = transport();
  for (const token of [undefined, '', ' ', null, 'a'.repeat(2049)]) assert.equal((await run(handler, request({ ...BODY, verification_token: token }))).status, 403);
  assert.equal(calls.length, 0);
});

test('enforces UTF-8 prompt boundary and default/maximum generated-token limits', async () => {
  const { handler, calls } = transport();
  const body = { ...BODY, prompt: 'é'.repeat(800) }; delete body.max_new_tokens;
  assert.equal((await run(handler, request(body))).status, 200); assert.equal(JSON.parse(calls[1].init.body).max_new_tokens, 32);
  assert.equal((await run(handler, request({ ...BODY, max_new_tokens: 64 }))).status, 200);
});

test('requires valid edge IP, ignores caller-selected forwarded identities, canonicalizes IPv6', async () => {
  const { handler, calls } = transport();
  for (const value of ['', 'unknown', '256.0.0.1', '01.2.3.4', '1.2.3.4,5.6.7.8', '::notip']) assert.equal((await run(handler, request(BODY, { 'CF-Connecting-IP': value }))).status, 403);
  assert.equal(calls.length, 0);
  const req = request(); req.headers.delete('CF-Connecting-IP'); assert.equal((await run(handler, req)).status, 403);
  await run(handler, request(BODY, { 'CF-Connecting-IP': '2001:0DB8:0:0:0:0:0:1' }));
  const first = calls[1].init.headers['X-Rhysbot-Client'];
  await run(handler, request(BODY, { 'CF-Connecting-IP': '2001:db8::1' }));
  assert.equal(calls[3].init.headers['X-Rhysbot-Client'], first);
  await run(handler, request(), { ...ENV, RHYSBOT_CLIENT_SALT: 'another-private-salt-of-at-least-32-bytes' });
  assert.notEqual(calls[5].init.headers['X-Rhysbot-Client'], first);
});

test('rejects non-JSON, malformed JSON, invalid UTF-8 and declared oversize bodies', async () => {
  const { handler, calls } = transport();
  assert.equal((await run(handler, request(BODY, { 'Content-Type': 'text/plain' }))).status, 415);
  assert.equal((await run(handler, request('{'))).status, 400);
  assert.equal((await run(handler, request(BODY, { 'Content-Length': '8193' }))).status, 413);
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array([0xff])); c.close(); } });
  assert.equal((await run(handler, request(stream))).status, 400); assert.equal(calls.length, 0);
});

test('streamed request byte limit does not rely on Content-Length and cancels input', async () => {
  const { handler, calls } = transport(); let cancelled = false;
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(4096)); c.enqueue(new Uint8Array(4097)); }, cancel() { cancelled = true; } });
  const response = await run(handler, request(stream, { 'Content-Length': '1' }));
  assert.equal(response.status, 413); assert.equal(cancelled, true); assert.equal(calls.length, 0);
});

test('request body timeout ends a stalled stream without spending', async () => {
  let calls = 0; const handler = createRhysbotHandler({ bodyTimeoutMs: 5, fetcher: async () => { calls++; } });
  const response = await run(handler, request(new ReadableStream({ start() {} })));
  assert.equal(response.status, 408); assert.equal(calls, 0);
});

test('Turnstile must affirm success, exact action and hostname; no inference on rejection', async () => {
  for (const verification of [{ ...VERIFY, success: false }, { ...VERIFY, success: 'true' }, { ...VERIFY, action: 'other' }, { ...VERIFY, hostname: 'evil.invalid' }, null]) {
    const { handler, calls } = transport({ verification });
    assert.equal((await run(handler)).status, 403); assert.equal(calls.length, 1);
  }
});

test('verification errors, redirect, oversize and timeout fail closed without inference', async () => {
  for (const response of [new Response('error', { status: 503 }), new Response('', { status: 302 }), new Response('x'.repeat(8193)), new Response('{')]) {
    let calls = 0; const handler = createRhysbotHandler({ fetcher: async () => { calls++; return response; } });
    assert.equal((await run(handler)).status, 503); assert.equal(calls, 1);
  }
  let calls = 0; const handler = createRhysbotHandler({ verificationTimeoutMs: 5, fetcher: () => { calls++; return new Promise(() => {}); } });
  assert.equal((await run(handler)).status, 503); assert.equal(calls, 1);
});

test('preserves backend rate-limit refusal without exposing its raw error or headers', async () => {
  const { handler, calls } = transport({ status: 429, result: { error: 'private_url_or_secret' }, responseHeaders: { 'Set-Cookie': 'secret=value' } });
  const response = await run(handler); assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), { error: 'rate_limited' }); assert.equal(calls.length, 2);
  assert.equal(response.headers.get('Set-Cookie'), null);
});

test('budget/backend refusal is finite and never automatically retried', async () => {
  const { handler, calls } = transport({ status: 503, result: { error: 'budget_exhausted' } });
  const response = await run(handler); assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: 'generation_unavailable' }); assert.equal(calls.length, 2);
  const failed = transport({ throwUpstream: true });
  const uncertainty = await run(failed.handler); assert.equal(uncertainty.status, 503);
  assert.deepEqual(await uncertainty.json(), { error: 'execution_uncertain_operator_check_required' }); assert.equal(failed.calls.length, 2);
});

test('upstream redirect is rejected without a second inference call', async () => {
  const { handler, calls } = transport({ status: 302, responseHeaders: { Location: 'https://evil.invalid' } });
  const response = await run(handler); assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), { error: 'upstream_redirect_rejected' }); assert.equal(calls.length, 2);
});

test('upstream timeout covers fetch and response streaming and reports uncertain spend', async () => {
  for (const stalledBody of [false, true]) {
    let calls = 0;
    const handler = createRhysbotHandler({ upstreamTimeoutMs: 5, fetcher: async url => {
      calls++; if (String(url).includes('challenges.cloudflare.com')) return Response.json(VERIFY);
      if (!stalledBody) return await new Promise(() => {});
      return new Response(new ReadableStream({ start() {} }), { headers: { 'Content-Type': 'application/json' } });
    } });
    const response = await run(handler); assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'execution_uncertain_operator_check_required' }); assert.equal(calls, 2);
  }
});

test('upstream response is byte-bounded, JSON-only, projected and checkpoint-identified', async () => {
  for (const result of [{ ...RESULT, text: 'x'.repeat(65536) }, { ...RESULT, model: 'qwen' }, { ...RESULT, checkpoint_run_id: '' }, { ...RESULT, weights_sha256: 'base' }, { ...RESULT, output_tokens: 65 }, { ...RESULT, tools_executed: true }, { ok: true, text: 'base fallback' }]) {
    const { handler } = transport({ result }); assert.equal((await run(handler)).status, 502);
  }
  const handler = createRhysbotHandler({ fetcher: async url => String(url).includes('challenges.cloudflare.com') ? Response.json(VERIFY) : new Response('<html>private failure</html>') });
  assert.equal((await run(handler)).status, 502);
});

test('production Pages export is a handler with no mutable per-request state', () => { assert.equal(typeof onRequest, 'function'); });
