# Olivia One → Olivia V3.5 sandbox

## Audit (2026-09-06)

Live gateway on VPS: `olivia-one-mail-olivia-gateway-1`, source `/opt/o7/olivia-one-mail`.
Current upstream: V2 Railway. Explicit mapping observed: `zevicapital.com → zevicapital`; mailbox map empty. The existing fallback `AI_DEFAULT_CLIENT_CODE=default` was unsafe.
Vercel `/api/*` proxies to the live VPS gateway: deploying a frontend preview alone does not isolate the backend.

Changes in this branch remove fallback resolution, including before cache access. Exact mailbox mapping takes precedence over exact domain mapping. Unmapped/invalid mailboxes or tenant `default` receive `403 TENANT_UNMAPPED`. V2 remains the default engine for explicitly mapped mailboxes. A single mailbox may opt into V3 only when its resolved tenant equals the configured test tenant. No V3 error falls back to V2.

## Server configuration

Keep existing explicit V2 maps. Add the approved test mailbox to `AI_MAILBOX_CLIENT_MAP` with its approved V3 tenant, then configure **only on the gateway**:

```dotenv
AI_V3_TEST_MAILBOX=
AI_V3_TEST_TENANT=
AI_V3_API_URL=
AI_V3_TOKEN=
AI_V3_TIMEOUT_MS=30000
AI_V3_POLL_MS=250
```

Empty test mailbox disables V3. Token must be a valid V3 JWT bound to that tenant with `olivia:use` and `jobs:read` (service role); provide/rotate it through server secret configuration. V3 login tokens expire after one hour. The gateway does not hold the JWT signing key or bootstrap credentials. Do not put the token in `VITE_*`, frontend code, Git, screenshots or browser storage.

Use HTTPS outside the private Docker network. Deployed V3 is accessible as `http://olivia-v3:8093` only from its private network `olivia-v3_olivia-v3-internal`. A separate Olivia One test gateway can join that existing network; do not reconfigure V3 or Mailcow. Keep test ingress separate from live ingress. The current production Compose file deliberately does not activate V3.

The selected mailbox is read-only: protected routes reject all mutations except the three AI endpoints. No SMTP send, CRM write, task creation, archive or external tool execution is allowed for it. Extracted V3 actions are review text only. UI draft review is still required. Other mailboxes retain existing V2 behavior.

## Contract and actual capability limits

| Olivia One | V3.5 endpoint | Result adaptation / limitation |
| --- | --- | --- |
| Summary | POST `/v1/olivia-one/email/summary` | `summary` string → summary list. Worker truncates body to 240 chars. |
| Analyze/classify | POST `/v1/olivia-one/email/classification` | Category/confidence. Worker detects “réservation”, otherwise “general”. |
| Urgency | Absent | Explicitly unavailable (`null`), never fabricated from classification or V2. |
| Suggested reply | POST `/v1/olivia-one/email/suggested-reply` | `reply` → editable suggested reply. Worker returns fixed French acknowledgement. |
| Rewrite | POST `/v1/olivia-one/text/rewrite` | `text` → draft. Worker only trims whitespace; no true tone/length/translation transformation. |
| Compose | POST `/v1/olivia-one/email/compose` | `body` → draft. Worker concatenates instruction/context; no real generation. |
| Action extraction | POST `/v1/olivia-one/actions/extract` | Review text, no execution. Worker extracts lines matching todo/faire/rappeler/réserver. |

Existing browser `/api/ai/analyze` aggregates summary, classification, reply and action jobs. `/api/ai/rewrite` and `/api/ai/compose` adapt the draft contract. Every V3 request uses server-side Bearer JWT + `X-Tenant-ID`. Job submission is followed by `GET /v1/olivia-one/jobs/{id}`, including already-succeeded idempotent replays. All submission/result envelopes must declare `sandbox: true`. Results are schema-checked. A total deadline includes submission, fetch, response body and polling. Errors are sanitized (`503`, or `504 V3_TIMEOUT`).

Idempotency keys hash upstream, tenant, authenticated mailbox, operation and complete payload. Concurrent identical requests share one promise. Subsequent retries, including after gateway restart, submit the same persistent V3 key; changed content yields a new key. No tool/workflow endpoint is called. Logs contain operation, job ID, tenant, duration and status code; no content, token or mailbox password.

## Validation and live acceptance

Run:

```sh
npm run gateway:build
npm --prefix olivia-gateway test
npm run build
npm run test:e2e
```

Unit/injection tests use fixtures, not V3. `tests/v3-sandbox.spec.js` verifies only UI rendering with a fixture; it does not establish live worker readiness.

For a live test, supply the approved mailbox, tenant and valid service JWT to an isolated server gateway. Authenticate that mailbox normally from the isolated Olivia One interface. Run analyze, suggested reply review, rewrite and compose with synthetic email content. Capture `olivia_one.v3.completed` IDs/durations, then correlate those exact IDs against read-only `docker logs olivia-v3-worker` entries `job.completed`. Retry identical input and verify the same job IDs. Verify an unmapped mailbox is refused and another explicitly mapped mailbox still routes to V2 using fixtures (do not send live V2 traffic for this test).

Do not deploy to Vercel production or change V2, Mailcow, WordPress, DNS, or V3.5 code. Until the test mailbox/tenant, credentials and isolated ingress are configured and the real jobs/browser path verified, the verdict is **NOT READY**. Urgency and actual rewrite transformations remain unavailable in frozen V3.5 even if all six transport operations succeed.

### Results for this change

- Gateway TypeScript and frontend Vite builds: passed.
- Gateway suite: 33/33 passed, with simulated upstreams.
- Browser suite (installed Chrome): 13/14 passed. Existing calendar test hardcodes August 2026 and fails in September; no calendar product code was changed.
- Dedicated V3 sandbox UI test: passed.
- Real test mailbox and tenant: not yet supplied. `test@example.com` is a synthetic test fixture, not an authenticated Mailcow mailbox.
- Live V3 operations, response times, corresponding worker job logs: not measured; no live V3 job submitted.
- Deployment: not performed. The existing Vercel proxy targets the live gateway; approved mailbox/tenant, service credential and isolated test ingress must be supplied/configured before activation.
- Verdict: **NOT READY for a real Olivia One interface test**. Gateway implementation and simulated validation are complete; live acceptance remains blocked.
