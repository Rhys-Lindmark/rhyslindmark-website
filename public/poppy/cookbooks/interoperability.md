# Run a Poppy interoperability check

Produce a machine-readable report of the capabilities you observed. Use the bundled agent and Company as a control, then use the same scenario to evaluate another client.

## What you’ll build

PoppyVal runs the seeded delivery workflow over HTTPS. It reports local checks alongside dated public discovery observations and storefront sales weights.

## Prerequisites

- The [Poppy source files](https://ai.rhyslindmark.com/poppy/source.tar.gz), Node 22.18 or later, and OpenSSL 3.
- Run from the repository root. The bundled control needs no credentials.

## 1. Generate the baseline

```sh
node src/poppyval.mjs > poppyval.json
node -e 'const r = require("./poppyval.json"); console.log(r.protocol_version, r.outcome); console.table(r.checks)'
```

Expect `1.0 pass` and three passing fixture checks. The report’s `checks` array describes the bundled run. `interoperability` holds evidence for other clients and Company documents. `storefronts` holds a dated public scan.

## 2. Give another agent the same task

> Move my delivery from Friday to Saturday if the change is free. Show me the terms and wait for approval.

Use a test Company reachable by the candidate and configured to accept its client ID. The bundled fixture recognizes the bundled agent. Record the candidate’s build, interface, and Poppy version before comparing results.

## 3. Score what happened

- **Discovery.** Record the manifest the candidate selected and whether its version matches.
- **Signed request.** Capture a store-side record of an accepted signed Session.
- **Sign-in.** Record the scoped grant and retry outcome.
- **Approval.** Confirm the exact revision and inspect the stored delivery day after the User’s decision. Repeat with a refusal.

Use an untested or unavailable result when the evidence or capability is missing. Report public manifest evidence at the discovery level. See the [PoppyVal methodology](../poppyval.md) and the [published capability matrix](https://ai.rhyslindmark.com/poppy/poppyval).
