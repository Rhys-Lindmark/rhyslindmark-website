# Hackathon sponsors

The [organizer’s prize page](https://tokensand.com/personalagenthack) lists these sponsor products. The demo keeps vendor calls off when their configuration is absent. Use demo accounts and synthetic data. Load keys into the process from your secure credential store.

| Sponsor | Status | Configuration or next check |
| --- | --- | --- |
| Amplitude | Server-side funnel adapter | Inject `AMPLITUDE_API_KEY`. Set `AMPLITUDE_REGION=eu` for EU projects. Run a demo and look for **Poppy Task Started** through **Poppy Delivery Changed** in the project Event Stream. |
| Persona | Sandbox write-access gate | Inject `PERSONA_API_KEY` and `PERSONA_TEMPLATE_ID`. The template's sandbox workflow must move qualifying inquiries to `approved`. Grant change access, open the hosted test verification, return to the local tab and check status. |
| Statsig | Funnel events and optional policy-context gate | Inject `STATSIG_SERVER_SECRET`. Set `STATSIG_POLICY_GATE` to a configured feature gate to control the policy excerpt preview. |
| Senso | Policy context lookup | Inject `SENSO_API_KEY`. Seed an authorized knowledge base with the demo delivery policy. Retrieved passages appear beside the operation terms. |
| Arcee AI | CLI intent fallback | Inject `ARCEE_API_KEY` and optionally set `ARCEE_MODEL`. Provide a demo request that omits an explicit supported day to exercise inference. |
| Cognee | Policy memory lookup | Inject `COGNEE_API_KEY` and set `COGNEE_DATASET` to the demo-policy dataset. |
| SingleStore | Parameterized event sink | Set `SINGLESTORE_URL` to a Helios endpoint, `SINGLESTORE_DATABASE`, and inject `SINGLESTORE_TOKEN`. Create the audit table below. |
| Superlinked | SIE Serverless reranking | Inject `SUPERLINKED_API_KEY` and optionally set `SUPERLINKED_MODEL`. Enable at least one demo context source with multiple results. |
| Guild AI | API-trigger runner | Configure a sandbox agent with a text input, an API trigger, and the variables below. |
| Airbyte | Read-only MCP context retrieval | Inject `AIRBYTE_MCP_TOKEN` from an authorized session. Set `AIRBYTE_SOURCE_ID`, `AIRBYTE_STREAM`, and optionally `AIRBYTE_DESTINATION_ID` for the seeded search index. The demo reads `title` and `text` fields. |
| Firedrill | Persona, rubric, and scenario builder | Save the fixture persona and evaluation in an authorized demo workspace. Generate an approval or refusal scenario from the saved version references. |

## SingleStore audit table

```sql
CREATE ROWSTORE TABLE IF NOT EXISTS poppy_demo_events (
  event_id CHAR(36) PRIMARY KEY,
  demo_id VARCHAR(64) NOT NULL,
  event_name VARCHAR(80) NOT NULL,
  seen_at_ms BIGINT NOT NULL
);
```

The public Commonplace edition workflow and the local signed delivery sandbox are both available. Sponsor adapters currently run in the local sandbox. The event sinks receive an independent demo identifier and lifecycle events. The store exchanges OAuth credentials only with its agent. Persona hosts its own verification flow.

## Guild AI and Firedrill

For Guild, configure `GUILD_OWNER` and `GUILD_WORKSPACE`. Load `GUILD_TRIGGER_KEY_ID` and `GUILD_TRIGGER_KEY_SECRET` securely. Run `node scripts/guild-poppyval.mjs approve` or replace `approve` with `decline`. Open the returned session URL to inspect the resulting run. A submitted session is a run receipt.

For Firedrill, save `data/firedrill/customer.json` as a persona and `data/firedrill/approval.json` as an evaluation. For each saved version, make a small JSON file with its `id`, `revision`, and `digest`. Run `node scripts/firedrill-scenario.mjs approve persona-version.json evaluation-version.json` and save the generated scenario. Repeat with `decline`. Connect the test agent to synthetic tools and a seeded order before running the campaign.

[Guild API triggers](https://docs.guild.ai/platform/api-triggers) · [Firedrill scenarios](https://docs.firedrill.run/build/scenarios) · [Airbyte search tools](https://docs.airbyte.com/platform/airbyte-mcp/tools) · [Superlinked scoring](https://superlinked.com/docs/reference/sdk)
