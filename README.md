# BlackBox

## Resilient Operations Platform

**BlackBox keeps teams coordinated when connectivity disappears.**

```text
OFFLINE → OPERATE
RECONNECT → SYNC
CONFLICT → RESOLVE
HISTORY → REPLAY
```

BlackBox is an offline-first mission coordination platform for commanders and field operators working in degraded or intermittent network conditions. The product keeps supported work usable locally, synchronizes durable mutations when connectivity returns, makes conflicts explicit, and reconstructs the operation from immutable MissionEvents.

## Why it matters

Traditional CRUD applications often turn a network interruption into lost work, ambiguous state, or a blocked operator. BlackBox treats connectivity as an operational state:

- mission, task, team, and event data are cached in IndexedDB;
- supported mutations are written to a durable queue before transport;
- local IDs and dependent mutations survive reloads and retries;
- server writes use idempotency, optimistic concurrency, and transactions;
- Socket.IO distributes committed changes to mission rooms; and
- Mission Replay reduces immutable events into historical state.

## Core features

- Offline-first task and observation workflows
- Durable, dependency-aware synchronization
- Canonical idempotency and response-loss recovery
- Optimistic concurrency and explicit conflict resolution
- Real-time mission-room updates with post-commit delivery
- Immutable MissionEvents and deterministic replay
- Role-aware commander and field-operator access
- Isolated demo reset and conflict trigger in development/demo mode

## Architecture

```text
React + TypeScript + Vite
        ↓
Zustand stores and API services
        ↙                         ↘
IndexedDB / Dexie              Express REST + Socket.IO
        ↓                         ↓
Durable mutation queue        Mongoose / MongoDB replica set
        └────────────── sync + MissionEvents ──────────────┘
                                      ↓
                           deterministic replay reducer
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/OFFLINE_SYNC.md](docs/OFFLINE_SYNC.md), and [docs/REPLAY.md](docs/REPLAY.md) for implementation detail.
Deployment configuration and the local production simulation are documented in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
The final release gate is recorded in [docs/PHASE6_FINAL_RELEASE_REPORT.md](docs/PHASE6_FINAL_RELEASE_REPORT.md), with test evidence in [docs/FINAL_TEST_MATRIX.md](docs/FINAL_TEST_MATRIX.md) and known limitations in [docs/LIMITATIONS.md](docs/LIMITATIONS.md).

## Technology

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| State | Zustand |
| Local persistence | IndexedDB via Dexie |
| API | Axios → Express + TypeScript |
| Database | MongoDB + Mongoose |
| Realtime | Socket.IO |
| Validation | Zod |
| Auth | JWT + bcryptjs |
| Tests | Node test runner, fake IndexedDB, Playwright |

## Local setup

### Prerequisites

- Node.js 20+ (Node 24 is supported in the verified environment)
- MongoDB replica set or mongos for protected transactional writes
- npm

The server can start a `MongoMemoryReplSet` fallback in non-production development/test mode when the configured MongoDB URI is unavailable. For normal local development, use a dedicated MongoDB replica set and never point tests at production data.

### Install

```bash
npm install
```

### Configure

```bash
copy server/.env.example server/.env
copy client/.env.example client/.env
```

Set a local `MONGODB_URI` and a development JWT secret in `server/.env`. If using the protected demo controls, set a private `DEMO_PASSWORD` as well. Never commit `.env` files or real credentials.

### Start

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run client
```

Open `http://localhost:5173`. The API defaults to `http://localhost:5000/api/v1`.

### Production build

```bash
npm run build:server
npm run build:client
```

The client build uses route-level code splitting. The remaining main chunk is expected to be below the default Vite 500 kB warning threshold in the current build; inspect the output for any future regression.

## Three-minute demo

1. Sign in as a commander and open an active mission.
2. Show the team, tasks, connectivity, and live activity.
3. Disable browser network access.
4. Create or update supported task work and record an observation.
5. Refresh while offline to show local persistence.
6. Restore network and show queue synchronization.
7. Use two clients or the controlled demo conflict path to show an explicit conflict.
8. Resolve the conflict and open Mission Replay.
9. Play the event history and close with: **“The network can fail. The operation shouldn't.”**

The exact reproducible runbook is in [docs/DEMO_RUNBOOK.md](docs/DEMO_RUNBOOK.md). Current local Chromium evidence covers smoke, offline observation/replay, and realtime; conflict browser verification and external deployment remain separate checks.

## Testing

Backend:

```bash
cd server
npm run lint
npm run build
npm test
```

Client unit/integration-style tests:

```bash
cd client
npm test
npm run typecheck
npm run lint
npm run build
```

Real browser tests:

```bash
cd client
npm run test:e2e:smoke
npm run test:e2e
```

The browser suite starts an isolated replica-set database and test frontend/backend. Its current limitations are recorded in [docs/PHASE4_REPORT.md](docs/PHASE4_REPORT.md).

## Project structure

```text
blackbox/
├── client/                 React app, IndexedDB, sync, replay, browser tests
├── server/                 Express API, MongoDB models, Socket.IO, tests
├── docs/                   Architecture, operations, demo, and phase reports
├── package.json            Workspace commands
└── README.md
```

The release audit intentionally retains the names `client/` and `server/` instead of renaming them to `frontend/` and `backend/`. The workspace scripts, Playwright global setup, package-lock workspace paths, environment examples, and existing documentation all use these paths. They are already cleanly separated by responsibility, and renaming them at the release gate would add integration risk without changing the architecture.

## Security

- Public registration always creates `FIELD_OPERATOR`; it cannot provision a commander.
- Production requires a strong JWT secret.
- Mission, replay, conflict, task, and socket access are authorization-checked.
- Demo reset and conflict-trigger operations are environment-gated and demo-account scoped.
- MissionEvents strip sensitive credential fields and are immutable in ordinary paths.
- No secrets, tokens, passwords, or private keys belong in the repository.

## Verification status

| Area | Current status |
|---|---|
| Phase 1 baseline/security | Pass evidence retained in implementation and regression tests |
| Phase 2 offline/sync reliability | Automated pass; see `docs/PHASE2_REPORT.md` |
| Phase 3 consistency/replay | Automated pass; see `docs/PHASE3_REPORT.md` |
| Phase 4 real-browser acceptance | Chromium smoke, offline/replay, and realtime flows verified; conflict browser flow remains a separate release check |
| Phase 5 demo/release packaging | Deployment simulation, readiness endpoints, container definitions, and CI configuration prepared |
| Phase 6 final release gate | Use the current release-readiness report and final test matrix; external cloud deployment remains separate |

## License

See the repository license file when present.
