# Approve a delivery change

Move a seeded order from Friday to Saturday for USD 0.00. Inspect the Company’s proposal, approve the exact revision, and verify the stored delivery day.

## What you’ll build

The User gives the agent read and change access to the Demo Store. The store responds to the first write with an Operations 3 proposal. The Personal Agent presents the terms and waits for the User’s decision.

## Prerequisites

- The [Poppy source files](https://ai.rhyslindmark.com/poppy/source.tar.gz), Node 22.18 or later, and OpenSSL 3.
- Run from the repository root. Restart the sandbox between manual scenarios to reset the order to Friday.

## 1. Request Saturday

```sh
npm start -- "Move my delivery to Saturday"
```

Open the localhost URL, select **Start rescheduling**, and approve both store scopes. In the agent’s trace, expand the first `POST /api/delivery`. It returns HTTP 403 with `approval_required`.

## 2. Review and approve the terms

- **Order.** Check the order shown by the agent.
- **Delivery.** The proposal changes Friday to Saturday.
- **Price.** The additional fee is USD 0.00.

Select **Approve change**. The agent repeats the request with `Poppy-Approval` referencing the reviewed operation and revision. The Company returns HTTP 200, and the result says **Saturday**. On a fresh run, choose **Decline** and use **Look up delivery** to confirm **Friday**.

## 3. Replay the evidence

```sh
node scripts/capture-delivery-trace.mjs
```

The script runs the workflow in a disposable HTTPS sandbox and exports the request trace. The final write follows the User’s approval.

```text
Agent → Store    POST /api/delivery       403  approval_required
User → Agent    POST /agent/approval    303  Approved the reviewed terms
Agent → Store    POST /api/delivery       200  User approved the proposed revision
```

[Replay the requests in your browser](https://ai.rhyslindmark.com/poppy/protocol-trace#replay) or read the [Operations 3 extension](https://personalagentprotocol.org/docs/1.0/extensions/operations).

## 4. Run the approval and refusal checks

```sh
node --test test/sandbox.test.mjs
```

The tests verify Friday before approval, Saturday after approval, and Friday when the User declines.
