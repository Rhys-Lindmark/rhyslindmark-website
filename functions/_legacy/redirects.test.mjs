import assert from 'node:assert/strict';
import test from 'node:test';
import { onRequest } from '../_middleware.js';
import { LEGACY_POST_SLUGS } from './posts.js';

function run(url, { method = 'GET', status = 404 } = {}) {
 const local = new Response('local page', { status, headers: { 'x-local': 'preserved' } });
 return onRequest({ request: new Request(url, { method }), next: async () => local });
}

test('every verified article redirects on both main hosts with optional trailing slash', async () => {
 for (const slug of LEGACY_POST_SLUGS) {
  for (const host of ['rhyslindmark.com', 'www.rhyslindmark.com']) {
   for (const slash of ['', '/']) {
    const response = await run(`https://${host}/${slug}${slash}`);
    assert.equal(response.status, 301, `${host}/${slug}${slash}`);
    assert.equal(response.headers.get('location'), `https://rhyslindmark.substack.com/p/${slug}`);
   }
  }
 }
});

test('existing local pages always win over legacy entries', async () => {
 for (const status of [200, 302, 403, 500]) {
  const response = await run('https://www.rhyslindmark.com/tools/', { status });
  assert.equal(response.status, status);
  assert.equal(response.headers.get('x-local'), 'preserved');
 }
});

test('unknown paths, missing assets, AI routes and other hosts keep their local 404', async () => {
 for (const url of [
  'https://www.rhyslindmark.com/unknown-post',
  'https://www.rhyslindmark.com/sitemap.xml',
  'https://www.rhyslindmark.com/singularity',
  'https://www.rhyslindmark.com/nested/how-to-anki',
  'https://www.rhyslindmark.com/how-to-anki//',
  'https://ai.rhyslindmark.com/how-to-anki',
  'https://ai.rhyslindmark.com/singularity',
  'https://ai.rhyslindmark.com/unknown-post',
  'https://unrelated.example/how-to-anki',
 ]) {
  const response = await run(url);
  assert.equal(response.status, 404, url);
  assert.equal(response.headers.get('location'), null, url);
  assert.equal(await response.text(), 'local page');
 }
});

test('legacy redirects preserve queries and HEAD while leaving writes alone', async () => {
 const response = await run('https://www.rhyslindmark.com/how-to-anki/?utm_source=old-link&x=1', { method: 'HEAD' });
 assert.equal(response.status, 301);
 assert.equal(response.headers.get('location'), 'https://rhyslindmark.substack.com/p/how-to-anki?utm_source=old-link&x=1');
 for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) {
  const response = await run('https://www.rhyslindmark.com/how-to-anki', { method });
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('location'), null);
 }
});
