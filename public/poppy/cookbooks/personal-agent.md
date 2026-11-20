# Build a Personal Agent

Ask an agent to move a Friday delivery to Saturday. Follow its first requests to the Demo Store and see how the store distinguishes a signed guest Session from an account grant.

## What you’ll build

The bundled agent takes a delivery request, discovers the Company’s OpenAPI description, and sends a signed request for delivery options. The store accepts the guest request and asks for sign-in when the agent tries to read the order.

> Move my delivery to Saturday.

## Prerequisites

- The [Poppy source files](https://ai.rhyslindmark.com/poppy/source.tar.gz), Node 22.18 or later, and OpenSSL 3.
- Run commands from the repository root. The sandbox has a seeded order and needs no API key.

## 1. Run the request

```sh
npm start -- "Move my delivery to Saturday"
```

Open the printed localhost URL and select **Start rescheduling**. The sandbox generates its own certificate, so the browser may show a warning for that localhost URL.

The store opens its consent screen. To see the request trace in the browser, grant the demo scopes and continue to review. Stop at the proposal if you only want to inspect the requests.

## 2. Inspect the signed guest request

- **Discovery.** The agent reads `/.well-known/poppy.json`, checks the Company domain and version, and loads its OpenAPI description.
- **Agent identity.** A root key vouches for a short-lived Session key in `poppy_dlg`. The agent uses that delegated key to sign the `Poppy-Session` header.
- **Account boundary.** Expand `GET /api/delivery-options` in the trace to see the signing information beside HTTP 200. The next `GET /api/delivery` returns 401 because the order requires an account grant.

Read the Session construction in [agent.mjs](../../src/agent.mjs) and the JWT helper in [protocol.mjs](../../src/protocol.mjs). See [Poppy 1.0, sections 4.1 and 5](https://personalagentprotocol.org/docs/1.0/spec) for the identity and Session rules.

## 3. Replay the workflow

```sh
node --test --test-name-pattern='discovery, scoped sign-in' test/sandbox.test.mjs
```

The test verifies discovery, accepted signed requests, user approval, and a fresh order read showing Saturday. [Step through the recorded requests](https://ai.rhyslindmark.com/poppy/protocol-trace#replay).

## Continue

[Sign in to read an order](direct-sign-in.md) follows the redirect and scope grant that come after the 401.
