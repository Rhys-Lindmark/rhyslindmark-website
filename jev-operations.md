# Claim Check operations

- Route: https://ai.rhyslindmark.com/jev/
- Every paid attempt requires a fresh Turnstile token, verified server-side with action `jev_check` and hostname `ai.rhyslindmark.com`. There is no service-key, header, cookie, or session bypass.
- Turnstile reduces automation; no CAPTCHA guarantees a visitor is human.
- Model pinned to `jev-1.14.0`. Published price checked 2026-10-27: $0.042 per million input tokens; output free; normal request context <=65,536 tokens. Source: https://docs.typesafe.ai/models
- Atomically reserve $0.01 before each API attempt, including upstream failures/timeouts; never refund. Lifetime reserve ceiling $20 (2,000 attempts), no automatic reset. At the documented context and price, those attempts cost at most about $5.51 in total. The headroom is intentional. Other applications using the same TypeSafe account are outside this cap.
- Maximum 10 attempts per IP per UTC hour and 100 site-wide per UTC day. HMAC identifiers replace raw IP addresses in the database; expired rate counters are pruned.
- Limits and enabled state live in `jev_budget` and `jev_limits` in the existing `rhysbot-platform` D1 database. Redeploys do not reset them. Missing database/configuration or failed verification stops before Jev.
- Immediate kill switch: `UPDATE jev_budget SET enabled=0 WHERE id=1;`. Also set production `JEV_ENABLED=0` and redeploy. Do not reset/increase the allowance without user authorization.
- Usage: `SELECT reserved_micros/1000000.0 AS allowance_used_usd, enabled FROM jev_budget WHERE id=1;` This is a conservative allowance, not an exact TypeSafe invoice.
- Server key source: encrypted `jev_credentials` row, or an existing `JEV_API_KEY` runtime secret. Database ciphertext uses AES-256-GCM with a purpose-specific key derived from the existing runtime secret `RHYSBOT_CLIENT_SALT`; preserve this secret or re-provision when rotating it.
- One-time owner provisioning is disabled unless production `JEV_SETUP_KEY_SHA256` matches SHA-256 of the exact owner-approved API key. It accepts only that key, writes ciphertext once with INSERT OR IGNORE, and cannot overwrite credentials. Remove that setup variable after provisioning. Never send key material to logs, source, or browser assets.
- Tests: `node --test functions/api/jev.test.mjs functions/api/jev-access.test.mjs`. Tests use SQLite and real Web Crypto; CAPTCHA responses are mocked for security-path tests. Production validation still needs a user to complete the actual widget.
