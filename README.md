# Olivia One Mail

Phase 2 of the Olivia One premium mail workspace: the React shell now talks to a dedicated `olivia-gateway` service, while preserving the supplied visual preview.

## Run locally

```bash
npm install
npm --prefix olivia-gateway install
npm run gateway:dev
npm run dev
```

The Vite app runs at `http://localhost:5173` and proxies API traffic to the gateway at `http://localhost:8787`.

## Olivia AI v2 development

Copy `olivia-gateway/.env.example` to `olivia-gateway/.env` and set `OLIVIA_INTERNAL_TOKEN` from the development service secret store. `npm run gateway:dev` loads this ignored file. The development gateway is configured for:

```text
AI_PROVIDER=python-olivia
AI_API_URL=https://olivia-v2-python-dev-production.up.railway.app
```

The browser calls only `/api/ai/analyze`, `/api/ai/rewrite`, and `/api/ai/compose` on the Olivia gateway. The gateway adds `X-Olivia-Internal-Token` and resolves `clientCode` from `AI_MAILBOX_CLIENT_MAP`, then `AI_DOMAIN_CLIENT_MAP`, then `AI_DEFAULT_CLIENT_CODE`. Browser-provided tenant codes are not accepted. Keep the token server-side and configure mailbox/domain maps in the development environment secret store.

## Phase 2 scope

- Componentized four-panel mail experience
- Routes for mail, calendar, contacts, tasks, Pulse, and settings
- Gateway-backed folders, search, message selection, composer, AI Workspace, and Pulse confirmation flow
- Separate Node.js + TypeScript `olivia-gateway` service with auth, mail, calendar, contacts, AI, and Pulse endpoints
- Provider abstraction prepared for Mailcow IMAP/SMTP replacement behind the gateway
- Loading, empty, and error states
- Desktop and tablet layouts

Mailcow, SOGo, provider credentials, and upstream infrastructure still remain untouched in this phase.

## Architecture

- `src/components/` contains reusable UI blocks that preserve the Phase 1 visual identity
- `src/features/` owns client interaction state
- `src/services/` is now an HTTP client boundary for the Olivia Gateway
- `olivia-gateway/` contains the Phase 2 Fastify + TypeScript backend with mock provider implementations
