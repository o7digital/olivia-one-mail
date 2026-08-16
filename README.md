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
