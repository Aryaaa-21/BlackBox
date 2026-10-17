# BlackBox Architecture

## Online path

```text
React page
  → Zustand/API service
  → Express route + authorization
  → Mongoose/MongoDB
  → post-commit MissionEvent and Socket.IO mission-room notification
  → client cache/store reconciliation
```

## Offline path

```text
React action
  → IndexedDB optimistic entity + durable mutation queue transaction
  → local UI projection
  → browser remains usable while transport is unavailable
```

## Reconnect path

```text
Connectivity restored
  → queue claim/dependency selection
  → POST /api/v1/sync
  → idempotency and version validation
  → transaction: entity + MissionEvent + ProcessedMutation
  → conflict or authoritative result
  → Socket.IO after commit
  → IndexedDB/Zustand reconciliation
```

## Replay path

```text
MissionEvents ordered by (createdAt, _id)
  → signed cursor/high-water pagination
  → client empty-state reducer
  → historical mission/task/member/conflict/network state
```

Replay does not use the current task or mission state to fabricate earlier frames.

## Main modules

- `client/src/pages` — route-level UI
- `client/src/stores` — auth, operations, connectivity, realtime, sync
- `client/src/db/index.ts` — Dexie schema and account-scoped persistence
- `client/src/services/mutations.ts` — durable user mutations
- `client/src/services/sync.ts` — queue processing and reconciliation
- `client/src/services/replay.ts` — pure historical reducer
- `server/src/services/unitOfWork.ts` — MongoDB transaction boundary
- `server/src/services/sync.service.ts` — server mutation processing
- `server/src/services/missionEvent.service.ts` — immutable event creation
- `server/src/services/replay.service.ts` — authorized event pagination
