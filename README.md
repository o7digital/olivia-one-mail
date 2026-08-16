# Olivia One Mail

Phase 1 of the Olivia One premium mail workspace: a production-structured React shell based on the supplied visual preview.

## Run locally

```bash
npm install
npm run dev
```

The Vite development server is available at `http://localhost:5173`.

## Phase 1 scope

- Componentized four-panel mail experience
- Routes for mail, calendar, contacts, tasks, Pulse, and settings
- Functional folders, search, message selection, composer, and AI Workspace
- Mock mail and intelligence service contracts
- Loading, empty, and error states
- Desktop and tablet layouts

Mailcow, SOGo, provider credentials, the Olivia Gateway, and live APIs are intentionally outside this phase.

## Architecture

`components/` contains reusable visual building blocks, `features/` owns interaction state, `mocks/` contains preview data, and `services/` defines the Phase 1 data boundary that can later be replaced by the Olivia Gateway.
