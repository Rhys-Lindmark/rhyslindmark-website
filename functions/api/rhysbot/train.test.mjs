import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { onRequest } from './train.js';
import { onRequest as upload } from './train-upload.js';
import { validateCorpus, verifyStripeSignature, MAX_BYTES } from './train-core.js';
import { verifiedArtifactBlob } from '../../../public/rhysbot/train/artifact.js';

// Deployment-package smoke tests; comprehensive SQL/concurrency tests live in
// the canonical rhysbot/platform/train.test.mjs. All calls are local mocks.
test('packaged Pages endpoints expose unavailable config and reject unconfigured uploads', async () => {
  const request = new Request('https://ai.rhyslindmark.com/api/rhysbot/train');
  const result = await onRequest({ request, env: {} });
  const body = await result.json();
  assert.equal(body.available, false); assert.equal(body.test_only, true);
  assert.equal(body.max_corpus_bytes, MAX_BYTES); assert.equal(result.headers.get('Cache-Control'), 'no-store');
  const mutation = new Request('https://ai.rhyslindmark.com/api/rhysbot/train-upload?format=txt', { method: 'POST', body: 'text', headers: { Origin: 'https://ai.rhyslindmark.com' } });
  assert.equal((await upload({ request: mutation, env: {} })).status, 503);
});
test('packaged core rejects unsafe JSONL and validates signature over original raw bytes', async () => {
  const enc = new TextEncoder();
  assert.throws(() => validateCorpus(enc.encode('{"url":"https://evil.invalid/file"}'), 'jsonl'));
  assert.throws(() => validateCorpus(enc.encode('{"text":"\\u0000"}'), 'jsonl'));
  assert.throws(() => validateCorpus(enc.encode('hi'), 'txt'), /200/);
  assert.throws(() => validateCorpus(enc.encode('{"text":"hi"}'), 'jsonl'), /200/);
  validateCorpus(enc.encode(JSON.stringify({text:'Educational example. '.repeat(15)})+'\n'), 'jsonl');
  const now = 1800000000, secret = 'whsec_local_test', raw = '{ "body": "exact" }';
  const signature = createHmac('sha256', secret).update(`${now}.${raw}`).digest('hex');
  assert.equal(await verifyStripeSignature(enc.encode(raw), `t=${now},v1=${signature}`, secret, now), true);
  assert.equal(await verifyStripeSignature(enc.encode('{"body":"exact"}'), `t=${now},v1=${signature}`, secret, now), false);
});
test('packaged download helper refuses missing metadata, truncation and hash corruption', async () => {
  const raw = new TextEncoder().encode('PKxx');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', raw))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const make = text => new Response(text,{headers:{'Content-Type':'application/zip','X-Rhysbot-Artifact-Bytes':'4','X-Rhysbot-Artifact-SHA256':digest}});
  assert.equal(await (await verifiedArtifactBlob(make('PKxx'))).text(),'PKxx');
  await assert.rejects(()=>verifiedArtifactBlob(make('PKx')),/Incomplete/);
  await assert.rejects(()=>verifiedArtifactBlob(make('PKxy')),/hash mismatch/);
  await assert.rejects(()=>verifiedArtifactBlob(new Response('PKxx',{headers:{'Content-Type':'application/zip'}})),/metadata/);
});
