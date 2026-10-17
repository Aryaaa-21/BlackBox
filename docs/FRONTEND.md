# BlackBox Frontend

## Stack

- React 18 + TypeScript + Vite
- React Router
- Zustand stores
- Axios API services
- Dexie-backed IndexedDB
- Socket.IO client
- Playwright browser acceptance tests

This document describes the current implementation rather than the obsolete client plan.

## Routes

- `/` landing page
- `/login` and `/register` authentication
- `/dashboard` operational overview
- `/missions` mission list and lifecycle actions
- `/missions/:missionId` mission workspace
- `/missions/:missionId/replay` mission replay
- `/replay` replay selector
- `/settings` account, connectivity, local storage, sync, and demo controls

## State flow

```text
REST / Socket.IO → Zustand stores → React pages
        ↘
   Dexie / IndexedDB cache
        ↘
 durable mutation queue → sync endpoint → authoritative reconciliation
```

`client/src/services/mutations.ts` creates durable task/observation work. `client/src/services/sync.ts` claims, sends, retries, and acknowledges queued mutations. `client/src/services/replay.ts` reconstructs historical state from event input only. `client/src/services/authority.ts` prevents stale versionless/API/socket data from overwriting newer authoritative rows.

## Connectivity UX

The shell distinguishes browser connectivity and API reachability. The user-facing states are Online, Offline, Reconnecting, Pending sync, Syncing, Synced, Sync failed, and Conflict. Offline supported operations remain available and display that changes are stored locally.

## UI conventions

- Dark operational surface with restrained blue signal accents.
- Geist/system sans for normal UI and Geist Mono for IDs/timestamps.
- Lucide icons with accessible labels for icon-only controls.
- Tables and compact panels for scanning operational state.
- Modals/drawers for focused create/edit/observation/conflict flows.
- `prefers-reduced-motion` support and static background surfaces for reliable browser interaction.

## Checks

```bash
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e:smoke
npm run test:e2e
```
