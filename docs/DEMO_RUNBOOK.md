# BlackBox Demo Runbook

## Purpose

This is the current demo procedure for the React/Express/MongoDB product. It does not use the obsolete “Demo HUD” wording from the earlier planning document.

## 1. Prerequisites

- Node.js 20+
- MongoDB replica set or mongos for transactional writes
- Clean browser profile or cleared BlackBox site storage
- No production credentials or production database

## 2. Start the stack

```bash
npm install
copy server/.env.example server/.env
copy client/.env.example client/.env
npm run dev
```

In another terminal:

```bash
npm run client
```

Open `http://localhost:5173`.

## 3. Demo mode

For a local demo only, use `ENABLE_DEMO_MODE=true` and a private `DEMO_PASSWORD` in `server/.env`, plus `VITE_ENABLE_DEMO_MODE=true` in `client/.env`. Demo endpoints are guarded and only operate on dedicated `@demo.blackbox.internal` accounts. Do not enable this path against production data. Demo passwords and authentication tokens are never returned by the API.

## 4. Reset to known state

1. Sign in as a demo commander using the private demo credentials configured for the isolated environment, or use an existing commander account.
2. Open **Settings**.
3. In the demo controls, use **Reset demo environment** if the control is present.
4. Sign in again if the reset invalidated the previous demo session, then confirm that the seeded mission and tasks appear.
5. If the demo controls are disabled, seed/reset through the guarded API procedure rather than editing MongoDB manually.

The reset creates the dedicated demo users, mission, tasks, memberships, and historical events. It does not delete arbitrary user or mission data.

## 5. Three-minute narrative

### 00:00–00:20 — What is BlackBox?

“BlackBox keeps teams coordinated when connectivity disappears.” Point to the flow: offline → operate → reconnect → sync → resolve → replay.

### 00:20–00:50 — Normal operation

Sign in as commander, open the active mission, and show the mission header, team, tasks, activity, connectivity, and sync state.

### 00:50–01:30 — Network failure

Use browser network controls or the demo environment’s supported network simulation. Confirm the UI says **Offline** and explains that supported changes are stored locally.

### 01:30–02:00 — Offline operation

Create/update a supported task and record an observation. Show pending sync. Refresh while offline and show that the local task and observation remain.

### 02:00–02:25 — Reconnect and sync

Restore network. Show Syncing → Synced, queue drain, and authoritative task/event state.

### 02:25–02:45 — Conflict

Use the guarded demo conflict trigger or two authorized clients. Show Local versus Server state and choose an explicit resolution. Never silently edit the database to manufacture a result.

### 02:45–03:00 — Replay

Open Replay, show the event timeline, play a few frames, and close with: **“The network can fail. The operation shouldn't.”**

## 6. Recovery

- Backend unavailable: check `GET /api/v1/health`, MongoDB URI, replica-set support, and server logs.
- Frontend unavailable: check Vite port 5173 and `VITE_API_URL`.
- Stale demo state: sign out, clear only the BlackBox site’s IndexedDB/cookies, reset demo, and sign in again.
- Queue stuck: open Settings, inspect pending/failed/conflict counts, and use the supported retry/sync controls.
- Conflict absent: verify the controlled divergence path was used and that the client had loaded a prior task version.
- Replay empty: verify the mission has authorized access and committed MissionEvents.

## 7. Safety

Never print or commit passwords, JWTs, cookies, API keys, or production connection strings. The demo is not accepted as successful if it requires manual database edits, source changes, fake API responses, or browser-console manipulation.

## 8. Current limitation

Phase 4 reported the full browser offline/two-client journey as **NOT READY**. Until that report is cleared, present the automated backend/client evidence honestly and do not claim a fully browser-verified offline demo.
