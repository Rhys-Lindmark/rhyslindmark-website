# Sign in to read an order

Read a customer’s delivery with a scoped account grant. Follow the initial sign-in challenge, the User’s decision on the store’s page, and the successful retry.

## What you’ll build

The user asks when an order will arrive. The agent starts with a signed Session. The Demo Store requires `orders:read` for the order lookup and asks the User to grant that one scope.

## Prerequisites

- The [Poppy source files](https://ai.rhyslindmark.com/poppy/source.tar.gz), Node 22.18 or later, and OpenSSL 3.
- Start with a fresh sandbox so the seeded order is still scheduled for Friday.

## 1. Request only read access

```sh
npm start
```

Open the printed localhost URL and choose **Look up delivery**. The store’s consent page should show one permission for reading the order. The User selects **Sign in and grant access** to continue.

## 2. Follow the redirect and retry

1. The signed-out `GET /api/delivery` returns HTTP 401.
2. The Company returns an authorization code. The callback checks state and issuer before exchanging the code with PKCE and a signed client assertion.
3. The agent checks the granted scope and retries the lookup with a fresh signed Session and the scoped access token. The result should show **Friday**, with HTTP 200 for the second lookup.

The [agent callback](../../src/agent.mjs) handles the exchange. See [Poppy 1.0 Direct Sign-In and scopes](https://personalagentprotocol.org/docs/1.0/spec#42-direct-sign-in) for the requirements.

## 3. Verify what read access allows

```sh
node --test --test-name-pattern='read-only consent' test/sandbox.test.mjs
```

The test attempts the rescheduling journey with only read access. The agent stops at insufficient consent. A later order lookup confirms Friday.

## Continue

[Approve a delivery change](delivery-approval.md) follows the write grant and shows the separate decision to change the order.
