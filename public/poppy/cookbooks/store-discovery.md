# Add Poppy discovery to a store

Give a Personal Agent one URL where it can learn the Company’s identity, protocol version, and available interfaces. Verify that an independent client can follow the advertised OpenAPI URL.

## What you’ll build

The local Demo Store publishes a Poppy 1.0 document at `/.well-known/poppy.json`. It names the responding host, its API description, and the Operations version used in the delivery example.

## Prerequisites

- The [Poppy source files](https://ai.rhyslindmark.com/poppy/source.tar.gz), Node 22.18 or later, and OpenSSL 3.
- Run from the repository root. The client in this example trusts the sandbox’s generated certificate.

## 1. Inspect the Company’s document

```sh
node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { startSandbox } from './src/demo.mjs';

const { origin, http, close } = await startSandbox();
try {
  const response = await http(origin + '/.well-known/poppy.json');
  assert.equal(response.status, 200);

  const company = response.json();
  assert.equal(company.organization.domain, new URL(origin).host);
  assert.equal(company.protocol_version, '1.0');

  const api = company.apis.find(({ type }) => type === 'openapi');
  assert.ok(api);
  const description = await http(api.url);
  assert.equal(description.status, 200);
  assert.ok(description.json().paths['/api/delivery-options']?.get);

  console.log(JSON.stringify({
    company: company.organization.name,
    version: company.protocol_version,
    openapi: api.url,
    operations: company.extensions.operations[0].version,
  }, null, 2));
} finally {
  await close();
}
NODE
```

Expect `Demo Store`, protocol version `1.0`, a localhost OpenAPI URL, and Operations version `3`. The port changes with each run.

## 2. Map the document to your store

- **Company identity.** Serve the manifest over HTTPS at the well-known path. Check that `organization.domain` matches the host serving the document.
- **Advertised interface.** List the API description under `apis`, with a short description of the task it supports. The client should be able to follow the advertised URL and identify a relevant operation.
- **Extensions.** Declare each implemented extension and its version. The sandbox advertises Operations 3 for exact-term approval.

The [store implementation](../../src/store.mjs) includes the manifest and OpenAPI handlers. For a deployed site, run the [Company validator](https://personalagentprotocol.org/kit/company) and test the advertised workflow separately.

## Continue

Inspect the [live Commonplace manifest](https://ai.rhyslindmark.com/.well-known/poppy.json) for a signed-out catalog with its own OpenAPI description.
