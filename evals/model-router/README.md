# Model Router eval (pilot)

Does the `/jev` Model Router send each prompt to a model that can answer it,
without overspending? Method borrowed from TypeSafe's SDE cascade cookbook (run
every model on every task, plot cost against success) and Baseten's router post
(repeated runs per task, a random-routing baseline, a cost knob λ).

- `tasks.mjs`: 60 prompts (math, code, constrained writing, logic, facts), each graded by code. Answers are brute-forced, code runs against hidden tests, writing constraints are checked mechanically.
- `graders.mjs`, `selftest.mjs`: every grader passes a known-good reply and rejects a bad one (`npm run selftest`, free).
- `run-models.mjs`: 4 open models via OpenRouter, standing in for the router's tiers (Haiku → GLM 5.3 Flash, Sonnet → DeepSeek V4.1 Flash, Opus → GLM 5.3, Fable → DeepSeek V4 Pro), each at low and high reasoning effort. A probe first, then full rounds in chunks of 15 prompts, each sent only if its projected cost fits the budget (default $25, `EVAL_BUDGET_USD`). Generated code runs locally in a temp dir with a 10s timeout.
- `run-jev.mjs`: asks Jev the page's exact questions (imported from `functions/api/jev.js`).
- `analyze.mjs`: scores the shipped router (`public/jev/router-policy.js`), threshold variants, the anti-pattern Choice, a learned router (leave-one-category-out, λ sweep), fixed models and the oracle; shuffle test against random routing. Writes `results/summary.json` and `public/jev/eval-summary.json`, which turns on the Eval card on `/jev`.

## Run

The scripts read two keys from the environment, named provider-first like your other keys: `OPENROUTER_KEY_JEV_EVAL` (best: a new
OpenRouter key for this eval with a $25 credit limit) and
`TYPESAFE_KEY_JEV_EVAL`.

Both live in Bitwarden Secrets Manager (project `development`). Save a key with
`save-secret NAME` in Terminal; the npm scripts below use `with-secrets` to hand
each script only the key it needs, so nothing is written to disk.

Then, from `evals/model-router/`:

```bash
npm run selftest   # free
npm run plan       # free: prints what will run
npm run jev        # 60 Jev calls, well under a cent
npm run models     # OpenRouter; spends up to the budget (a full round is ~$2-4); resumable
npm run analyze    # free
```
