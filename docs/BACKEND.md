# BlackBox Backend

## Stack

- Node.js + TypeScript
- Express
- MongoDB + Mongoose
- JWT + bcryptjs
- Zod request validation
- Socket.IO mission rooms

This document describes the current implementation rather than the obsolete planning stack.

## Start

```bash
cd server
npm install
copy .env.example .env
npm run dev
```

The default API is `http://localhost:5000/api/v1` and health is `GET /api/v1/health`.

Protected writes require a MongoDB replica set or mongos because entity, MissionEvent, and receipt writes are transactional. Non-production startup can fall back to `MongoMemoryReplSet` when the configured URI is unavailable. Production does not silently fall back.

## Routes

| Area | Current routes |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Missions | `GET /missions`, `POST /missions`, `GET /missions/:id`, `PATCH /missions/:id`, lifecycle routes |
| Team | `GET/POST /missions/:id/members`, `DELETE /missions/:id/members/:userId` |
| Tasks | `GET /missions/:id/tasks`, `POST /missions/:id/tasks`, task update/status routes |
| Events | mission event list/detail and observation recording routes |
| Sync | `POST /sync`, conflict list/detail/resolution routes |
| Replay | `GET /missions/:id/replay` with signed cursor pagination |
| Demo | guarded `/demo/info`, `/demo/reset`, `/demo/trigger-conflict` |
| Health | `GET /health` |

The synchronization endpoint is **`POST /api/v1/sync`**.

## Consistency boundaries

Operational writes run through `server/src/services/unitOfWork.ts`:

```text
authorization + validation + idempotency/version check
  + entity + MissionEvent + ProcessedMutation
  = one MongoDB transaction
```

Mongoose `__v` is exposed as `version` and supplies optimistic concurrency. MissionEvents are append-only in ordinary application paths. Socket notifications are queued with `afterCommit` and emitted only after commit.

## Security

- Public registration cannot create `COMMANDER` accounts.
- Production JWT configuration fails fast for missing/unsafe secrets.
- Route handlers enforce mission and role authorization.
- Replay cursors are HMAC-signed and bound to their mission/filter window.
- Demo maintenance is isolated to demo accounts and guarded environment paths.

## Checks

```bash
npm run lint
npm run build
npm test
```
