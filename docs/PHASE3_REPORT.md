# BLACKBOX PHASE 3 REPORT
DATA CONSISTENCY & REPLAY HARDENING

Date: 2026-10-16 (Asia/Calcutta)

## 1. Executive Summary

Phase 3 implemented and verified the requested consistency and replay hardening while preserving the existing MongoDB/Mongoose, MissionEvent, IndexedDB, mutation queue, sync, Socket.IO, authorization, and UI architecture.

The server now commits mutable entity changes, immutable MissionEvents, and ProcessedMutation receipts in one MongoDB transaction. Optimistic concurrency uses the existing Mongoose `__v` counter exposed as numeric `version`. Idempotency is persisted and collision-checked across independent service instances. MissionEvent history is immutable in ordinary application paths, and live notifications run only after commit.

Replay now starts from an empty state and reduces only ordered authoritative events. The server provides signed cursor pagination over `(createdAt, _id)` with a first-page high-water bound. The client drains pages, excludes pending local work, reconstructs historical state without current-entity lookups, and protects caches and visible state from stale versionless/API/socket writes.

Final automated result: **417 backend assertions and 50 client tests passed; zero failures**. Server lint/build and client typecheck/lint/build passed. Actual browser refresh/restart/service-worker/multi-tab validation remains blocked by website-access approval, so the verdict is **READY WITH P1 REMAINING** rather than an unconditional browser-qualified release.

## 2. Pre-Implementation Audit

The audit confirmed that the real implementation uses `client/src/services/sync.ts`, Dexie helpers, API modules, and Zustand stores rather than the illustrative `syncEngine.ts`/`syncProcessor.ts` names. The existing database name `blackbox-operational-cache` and installed tables were retained.

The main Phase 3 weaknesses were:

1. Entity, MissionEvent, and receipt writes were separate, with possible partial success.
2. Operational sockets could be scheduled before the complete write boundary had committed.
3. Entity concurrency was timestamp-based in the main sync paths.
4. MissionEvent history could be changed through ordinary model operations.
5. Replay depended on current mission/task/user data, ignored the cursor contract, and did not provide deterministic event-only reconstruction.
6. Client replay loading did not fully drain pages or clearly distinguish incomplete cached history.
7. Client API/socket/cache reconciliation did not consistently prefer the highest authoritative version.

Phase 2 behavior was preserved, including durable mutation identities, canonical fingerprints, dependency-aware queue processing, account scoping, retry limits, transport-only offline fallback, and static-only service-worker caching.

## 3. Transaction Architecture

`server/src/services/unitOfWork.ts` provides the transaction boundary through `withUnitOfWork`. It uses Mongoose transaction sessions with snapshot read concern, majority writes, primary reads, and `AsyncLocalStorage`/Mongoose transaction async-local propagation so nested model/service operations participate in the caller's transaction.

Protected writes fail explicitly with `503 TRANSACTIONS_UNSUPPORTED` when the configured MongoDB is a standalone server. The development/test fallback is `MongoMemoryReplSet`, not a standalone memory server. The final test run used that replica-set fallback because the configured `127.0.0.1:1` URI was intentionally unavailable.

The consistency invariant is:

```text
authorization + validation + idempotency/version check
  + entity mutation + MissionEvent + ProcessedMutation
  = one transaction
```

Failed transaction stages leave no entity, event, success receipt, version increment, or operational socket notification. Post-commit callbacks are discarded on rollback and run only after a successful commit. Driver retry attempts receive fresh callback lists, preventing duplicate notifications.

Covered write paths include tasks, missions, members, observations, sync mutations, conflict creation, conflict resolution, demo writes, and event creation.

## 4. Concurrency Control

Mongoose's existing `__v` is the single authoritative counter. `server/src/models/versioning.ts` enables optimistic concurrency, exposes `version`, increments query-update paths, and leaves event-clock-only mission updates out of the mission entity version.

Sync accepts `baseVersion` and retains legacy `baseUpdatedAt` compatibility. A stale request creates one durable conflict rather than applying over a newer entity. Concurrent same-base requests were tested for:

- same-field edits;
- different-field edits;
- assignment versus status;
- edit versus status; and
- simultaneous observations.

Each conflicting pair produced one success and one conflict, exactly one entity version increment for the successful mutation, and deterministic conflict resolution behavior. Legacy documents without `__v` upgrade from an effective version of `0` to version `1` on their first operational edit.

## 5. Idempotency

ProcessedMutation receipts remain insert-only and retain the original local identity, device, mutation, server mapping, and recursive SHA-256 request fingerprint. Same-key requests with equivalent canonical payloads replay as duplicates. Same-key requests with changed payload, operation, entity identity, base version, or other logical identity fail with `IDEMPOTENCY_KEY_REUSED`.

Receipt uniqueness is enforced across independent service instances by MongoDB, not only by the in-process promise map. A losing producer's entity/event work rolls back when the receipt insert loses a unique-key race. Conflicted mutations claim a durable conflict outcome receipt as well as successful mutations.

Legacy receipts without verifiable fingerprints fail closed with `IDEMPOTENCY_LEGACY_UNVERIFIABLE`. Failed mutations do not create success receipts and can be safely retried with the original identity.

## 6. MissionEvent Integrity

MissionEvents are protected against ordinary save-existing, update, replace, delete, and bulk-write operations. Production has no generic edit bypass. The fixture-only maintenance helper is restricted to `NODE_ENV=test`; demo cleanup remains ownership-scoped and demo-mode-gated.

New event payloads include reconstructible snapshots and persisted timestamps/versions for missions, tasks, and members. Actor labels are captured from the server-side actor record at event time; caller-supplied actor labels are not trusted. Recursive sanitation strips credential keys while preserving arrays, nested arrays, dates, and ObjectIds. Event retries compare the original request fingerprint, so an actor rename does not change the meaning of a prior idempotent request.

Mission event causal timestamps are serialized through the mission event clock and are strictly increasing. The filtered replay compound index `{ missionId: 1, eventType: 1, createdAt: 1, _id: 1 }` was added alongside the chronological index.

## 7. Conflict Integrity

Conflict creation stores the local state, server state, base state, request fingerprint, mutation identity, and an immutable `SYNC_CONFLICT` event in one transaction. Conflict resolution checks current access and the presented server version again before applying `KEEP_LOCAL` or `MERGE`.

`KEEP_SERVER` returns the current authoritative task rather than the stale detection snapshot. `KEEP_LOCAL` and `MERGE` create fresh durable resolution identities and receipts. Repeating the same resolution returns the original result and identity; changing the meaning of a completed resolution is rejected. Resolution writes the entity, conflict state, receipt, and `CONFLICT_RESOLVED` event atomically.

Concurrent duplicate resolution attempts produce one effect and one resolution audit event. Resolution remains authorization-aware: field operators cannot merge and conflict access remains mission/account scoped.

## 8. Replay Architecture

The server replay endpoint reads only immutable MissionEvents for historical events. The current mission is returned only as metadata with `scope: CURRENT_METADATA`; it is not used to reconstruct historical state or page summaries. Current Task or User lookups are not used to fill missing historical labels. Missing actor snapshots render as `Unknown Operator`.

The client reducer in `client/src/services/replay.ts` provides:

- `createEmptyReplayState`;
- a pure `replayReducer`;
- `reconstructReplay`;
- frame zero before the first event; and
- frame-by-frame historical seeking.

Known mission, task, member, observation, network, sync, conflict, assignment, lifecycle, and resolution events are reduced in order. Unknown, malformed, foreign-mission, duplicate, and pending events remain visible with warnings and do not prevent later safe events from reducing. Rejected local conflict state is never applied; only an explicit authoritative resolved snapshot may change historical entity state.

## 9. Replay Pagination

Replay ordering is ascending `(createdAt, _id)`. The endpoint uses `limit + 1`, strict-after cursors, and a first-page high-water tuple so events appended after page one cannot appear in the middle of an in-progress history drain.

Cursors are HMAC-signed and bind mission, date filters, event type, prior tuple, and high-water tuple. Tampered, malformed, expired-in-context, or filter/mission-incompatible cursors return `400 INVALID_REPLAY_CURSOR`. Date bounds are inclusive and calendar-validated. Unknown non-empty event types remain queryable. Limits are integers from 1 through 5000.

Each page reports `summary.scope: PAGE` and counts only returned events. Pagination `total` is the bounded filtered history through the high-water tuple, not a misleading remaining-row count. Cursor authorization is checked again on every page.

## 10. Offline → Sync → Replay

The real client golden path was retained and rerun against the Express server and MongoDB test database. It covers offline CREATE → ASSIGN → STATUS → OBSERVATION, durable local IDs, response loss, exact-key retry, four receipts, four immutable events, and replay visibility.

Client replay transport is server-authoritative when reachable. Offline fallback uses only cached authoritative events and marks the result as limited when completeness is unknown. `source: LOCAL` and `syncState: PENDING` events are excluded and counted. HTTP 4xx/5xx responses remain errors rather than being presented as successful offline replay.

The client now drains cursors for full history, recomputes summaries over the loaded authoritative event set, handles timezone-offset date filters by instant, and keeps account changes from mixing responses or cache rows.

## 11. Conflict → Resolution → Replay

The integrated server scenario creates stale conflicts, resolves them through `KEEP_SERVER`, `KEEP_LOCAL`, and `MERGE`, retries the same resolution, rejects changed resolution meanings, and verifies the resulting entity/event/receipt state. The replay endpoint exposes both the immutable `SYNC_CONFLICT` and `CONFLICT_RESOLVED` history entries, plus the actual task transition events generated by an approved resolution.

The pure client reducer verifies that detection does not apply rejected local state and that only the explicit `resolvedEntityState` is applied after resolution. Invalid resolution kinds retain history and warnings without mutating the task.

## 12. Browser Validation

Actual browser validation was attempted against the existing `http://localhost:5173/` tabs, but OmniRush browser access remained blocked with:

```text
Select this tab in its conversation's browser panel to review website access, then retry.
```

Therefore the following were **not claimed as browser-tested**:

- real page refresh with the installed service worker;
- browser restart and IndexedDB/session restoration;
- actual browser offline/online transition;
- real multi-tab lease behavior; and
- rendered replay controls and visible UI reconciliation.

The client suite does include Node/fake-IndexedDB service-worker VM tests and real client-service/API tests. Those are useful regression evidence but are not substitutes for the missing browser checks. No external browser profile, CDP, or browser bypass was used.

## 13. Test Results

### Final commands and results

| Area | Command | Result |
|---|---|---|
| Backend assertions | `NODE_ENV=test MONGODB_URI=mongodb://127.0.0.1:1/blackbox_phase3_isolated npm test` in `server` | **417 passed, 0 failed** |
| Backend lint/typecheck | `npm run lint` in `server` | **Passed** |
| Backend build | `npm run build` in `server` | **Passed** |
| Client tests | `npm test` in `client` | **50 passed, 0 failed** |
| Client typecheck | `npm run typecheck` in `client` | **Passed** |
| Client lint | `npm run lint` in `client` | **Passed** |
| Client build | `npm run build` in `client` | **Passed** |
| Whitespace | `git diff --check` | **Passed** |

The client count increased from 36 to 50 through 14 new replay, stale-write, cache, and performance tests. The backend count increased from 324 to 417 through 93 Phase 3 assertions. Existing tests were retained.

### New coverage

- entity, MissionEvent, receipt, and commit-stage rollback;
- retry after each injected failure;
- post-commit-only notification behavior;
- fresh transaction callback lists on retry;
- independent-service duplicate and changed-payload races;
- base-version concurrency across task mutation classes;
- exactly-once conflict resolution effects;
- event immutability and fixture-only maintenance boundaries;
- server-derived actor snapshots and recursive sanitation;
- event-only reducer reconstruction from empty state;
- malformed, unknown, duplicate, pending, and foreign events;
- signed cursors, high-water bounds, tied timestamps, filters, dates, limits, and authorization;
- legacy versionless entities;
- offline cached replay, pending exclusion, account scope, and HTTP error behavior; and
- stale version 9 API results versus version 10 socket/cache state.

The first Phase 3 attempt exposed three test/integration failures: replay filters did not exclude an unknown legacy `syncState` field under strict query mode, which caused the cursor-drain and final-page assertions to fail as downstream effects. The query was corrected to explicitly use non-strict filtering for legacy fields. A client lint failure from `setImmediate` not being declared was also fixed with a portable timer. The final run is zero-failure.

## 14. Performance

Measured locally with the replica-set MongoDB fallback and HTTP server, three samples per case:

| Workload | Median | Min | Max |
|---|---:|---:|---:|
| Server replay, 100 events | 16.03 ms | 15.64 ms | 19.19 ms |
| Server replay, 500 events | 24.58 ms | 23.53 ms | 32.19 ms |

Client pure reducer/frame construction was measured separately in Node, five samples per case:

| Workload | Median | Min | Max |
|---|---:|---:|---:|
| Client reducer, 100 events/all frames | 1.01 ms | 0.69 ms | 2.16 ms |
| Client reducer, 500 events/all frames | 6.04 ms | 3.06 ms | 8.62 ms |

These are local test measurements, not production capacity claims and not browser rendering measurements. The client production build passes with an existing Vite warning that the main JavaScript chunk is approximately 548.58 kB after minification; code-splitting was not part of Phase 3.

## 15. Remaining Issues

1. Actual browser qualification is still blocked by the OmniRush browser-panel approval requirement.
2. No deployed/production MongoDB topology was verified. Standalone MongoDB is intentionally rejected for protected writes; production must provide a replica set or mongos.
3. Existing legacy MissionEvents do not receive backfilled actor snapshots or repaired historical payloads. Replay reports missing information rather than inventing it.
4. The event cursor is signed and bounded but is not a durable snapshot; it is intentionally tied to the append-only high-water tuple.
5. The client build's main chunk remains above the Vite advisory threshold.

No known final test regression remains. The warning/error lines printed by the test runner are intentional rejected-path coverage (authorization, stale conflict, invalid cursor, and injected rollback failures), not failed assertions.

## 16. Deferred Work

The following remain outside Phase 3 and were not started:

- Phase 4 work;
- production deployment/topology provisioning;
- browser-panel approval and actual browser refresh/restart/multi-tab qualification;
- legacy event backfill or migration tooling;
- a durable replay snapshot system;
- UI redesign or unrelated feature work; and
- bundle/code-splitting optimization.

No commit, push, reset, or unrelated documentation overhaul was performed.

## 17. Phase 3 Verdict

**READY WITH P1 REMAINING**

The implementation satisfies the tested Phase 3 data-consistency, concurrency, idempotency, immutable-history, deterministic-replay, pagination, offline-reconciliation, and authorization requirements. The remaining P1 is actual browser validation, which cannot be honestly marked complete until the user selects/reviews the BlackBox browser tab in the OmniRush browser panel and the smoke checks are run there. Phase 4 was not started.
