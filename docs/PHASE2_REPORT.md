# BLACKBOX PHASE 2 REPORT
OFFLINE & SYNC RELIABILITY HARDENING

Date: 2026-10-16 (Asia/Calcutta)

## 1. Executive Summary

The offline-first guarantee is materially stronger. All six supported offline mutation types now use durable queue-first writes, stable identities, dependency-aware processing, persisted local-to-server mappings, durable retry state, and transactional client acknowledgements. Server receipts now actually store and validate canonical fingerprints. Lost responses, repeated calls, and ordinary retries do not duplicate the tested entities or logical events.

Final automated results: **324 backend assertions and 36 client tests passed; zero failures**. The real client queue was also exercised against the real Express/MongoDB test server, including response loss and replay verification.

This is not an unconditional production exactly-once claim. Actual browser refresh/restart validation remains blocked by website-access approval. Entity/event/receipt atomicity and distributed server coordination remain Phase 3 work. Phase 3 was not started.

## 2. Pre-Implementation Audit

The actual implementation differed from the illustrative roadmap names. It uses `client/src/services/sync.ts`, API modules, Zustand stores, and Dexie helpers; separate `syncEngine.ts`, `syncQueue.ts`, `syncProcessor.ts`, `syncRetry.ts`, and repository files did not exist. They were not created blindly or removed.

The existing database name, `blackbox-operational-cache`, was retained to preserve installed data. Existing tables are `missions`, `tasks`, `members`, `events`, `users`, `mutations`, `conflicts`, `metadata`, and `sessions`.

### Exact weaknesses found

1. Server local-ID mappings were an in-memory map per HTTP batch. Later batches and duplicate CREATE results could lose the mapping.
2. `mutationFingerprint` was imported but not persisted by successful handlers. The old helper only sorted top-level payload keys.
3. Some receipts stored resolved server IDs while exact retries still supplied original local IDs.
4. Concurrent same-key waiters were unconditionally reported as `DUPLICATE`, even if the original failed or conflicted.
5. Optimistic cache writes and queue insertion were separate writes. Queue deletion happened before cache reconciliation.
6. Queue state had no durable in-flight marker, retry schedule, or dependency acknowledgement.
7. Task form network failures could lose intent; observations used unrelated local-event and mutation keys.
8. Conflict refresh could store rows without account scoping. KEEP_SERVER returned an old detection snapshot; KEEP_LOCAL lacked a fresh durable resolution identity.
9. ASSIGN_TASK skipped stale-version conflict checks. Timestamp comparison tolerated a full second of missed changes.
10. Create/assign/status MissionEvents lacked mutation-level event keys.
11. Connectivity had no bounded recovery polling. Server outages during authorization were swallowed as permanent access denial.
12. The service worker could cache private API responses and could miss entry assets on first installation.
13. No client test runner or browser smoke harness existed. The verified Phase 1 baseline was **269**, not the older approximate 267.

### Original lifecycle/failure map

| Step | Storage and identifier | Original transition | Failure/retry behavior |
|---|---|---|---|
| Mutation created | Optimistic task/event in Dexie; temporary entity ID | UI intent -> cache | Crash before enqueue could orphan intent |
| Queued/persisted | `mutations`, `mutationId`, key, device ID | -> PENDING | Identities persisted, but entity/queue not atomic |
| Ready | First 20 PENDING rows by timestamp | No explicit dependency claim | Child could outlive per-batch ID map |
| Sent | In-memory shared promise; attempts in Dexie | No durable SYNCING | Interrupted work had no explicit recovery state |
| Server processing | Entity, MissionEvent, ProcessedMutation | Independent writes | Fingerprint missing; crashes could leave partial server writes |
| Acknowledged | Queue row deleted | Removed before reconciliation | Crash could lose mapping/cache reconciliation |
| Local reconciliation | Cached entity replaced | No durable ID map | Later local-ID dependents could fail |

## 3. Architecture Changes

The stack, Dexie database, queue architecture, API contracts, mission/task state machine, MissionEvents, and Socket.IO architecture were preserved. No AI, runtime integration, unrelated feature, transaction/outbox redesign, or replay-pagination implementation was added.

| File(s) | Problem | Change | Why |
|---|---|---|---|
| `client/src/db/index.ts` | No durable mapping/in-flight state; non-atomic writes | Dexie v4 `idMappings`, queue ordering/dependencies, immutable identity/state guards, atomic device ID, projections | Retain work and references across reload/retry |
| `client/src/services/sync-policy.ts` (new) | Implicit ordering/error rules | Testable selection, stable wire representation, transition/retry/cache policy | Enforce invariants consistently |
| `client/src/services/sync.ts` | Unsafe acknowledgement, retries, conflict scoping | Durable claim/wire body, lease, transactional acknowledgement, backoff, conflict reconciliation | Recover interruption without losing successful work |
| `client/src/services/mutations.ts` (new) | Online/offline paths could lose intent | Shared durable task/observation mutation entry points | Persist before attempting network |
| `client/src/services/cache-policy.ts` (new) | Cached filters/pages and optimistic state could diverge | Shared local filtering/pagination helpers | Preserve useful offline views without masking HTTP failures |
| `client/src/api/{auth,events,health,http,members,missions,sync,tasks,users}.ts` | Account races and inconsistent writes/cache reads | Account-bound requests/cache snapshots; task/observation writes use queue | Keep retry identity and account attribution stable |
| `client/src/stores/{auth,operations,sync}.store.ts` | Lost projections/counts; unsafe fallback | Observe persisted state, transport-only fallback, offline session bootstrap | Refresh does not revert queued intent |
| `client/src/services/connectivity.ts`, `client/src/App.tsx` | Browser online did not imply backend recovery | Independent reachability; bounded health and sync ticks | Resume pending work after backend recovery |
| `client/src/components/tasks/TaskForm.tsx`, `client/src/pages/app/MissionDetailPage.tsx` | Direct writes and hidden conflict-resolution rejection | Existing forms call durable mutations; existing modal shows errors/busy state | Correctness feedback without UI redesign |
| `client/public/sw.js` | Private HTTP cache and missing first-install assets | Static-only cache; precache built entry JS/CSS; retire older shell caches | Support offline shell reload without caching protected APIs |
| `server/src/services/idempotency.service.ts`, `server/src/models/ProcessedMutation.ts` | Unstored/weak fingerprints and local-ID identity mismatch | Recursive SHA-256 fingerprint, receipt validation, original identity, durable CREATE lookup | Reject collisions; resolve prior-batch local IDs |
| `server/src/services/sync.service.ts` | False duplicates, assignment overwrite, swallowed outages | Same-key revalidation, real result semantics, assignment conflicts, no one-second blind window, current authorization | No fake success or permission bypass |
| `server/src/services/task.service.ts`, `server/src/services/missionEvent.service.ts` | Missing event keys and unchecked event-key reuse | Optional compatible event metadata; event collision validation and unique-race handling | Deduplicate logical events on acknowledged retries |
| `server/src/services/conflict.service.ts`, `server/src/models/SyncConflict.ts` | Stale server choice, weak resolution identity | Current KEEP_SERVER result; fresh version-aware resolution identity/receipt; safe same-choice retry | Preserve original audit and prevent blind overwrite |
| `server/src/controllers/sync.controller.ts`, `server/src/validators/sync.validator.ts`, `client/src/types/api.ts` | No explicit refreshed resolution version | Optional `expectedServerUpdatedAt` | Permit explicit version-aware review without breaking old callers |
| `client/package.json`, `client/eslint.config.js`, `package-lock.json`, `client/tests/*`, `server/src/tests/*` | No client persistence tests; missing server regressions | Node built-in tests, test-only fake-indexeddb/esbuild, integration/golden cases | Reproducible verification; no application framework replacement |

Existing Phase 1 changes and staged files were preserved. Phase 2 changes were not committed, pushed, or silently restaged.

## 4. Mutation Identity

- `mutationId`: UUID generated once before durable insertion; never regenerated on retry or reload.
- `idempotencyKey`: independently generated once; reused for every attempt. Observation event and queue entry share this key.
- `entityId`: original local/server request identity remains immutable. A separate persisted wire snapshot contains any resolved transport ID.
- `clientCreatedAt`: original client timestamp remains stable.
- `deviceId`: generated once in an IndexedDB transaction and retained in metadata.
- `fingerprint`: SHA-256 of recursively canonicalized logical request identity, payload, base version, and client timestamp. Object order is ignored at every depth; array order remains meaningful. No separate raw fingerprint payload is stored.

Dexie update hooks reject identity changes. Before sending, the exact wire body is persisted; retry reuses it rather than rebasing an already-attempted request.

Unhashed legacy server receipts cannot prove their original payload. They now fail closed with `IDEMPOTENCY_LEGACY_UNVERIFIABLE` rather than inventing a hash or silently validating changed work. Explicit reconciliation is required; work is not re-executed.

## 5. Local ID Mapping

Dexie v4 adds `idMappings` keyed by `[accountId+entityType+localId]`. Each row stores local ID, server ID, creation mutation ID, and update timestamp.

For a successful CREATE or duplicate acknowledgement, a single IndexedDB transaction:

1. Persists the mapping.
2. Removes the temporary cached entity.
3. Stores the authoritative server entity.
4. Rebases unsent immediate dependents to the acknowledged server version.
5. Removes the acknowledged active queue entry.

A failure anywhere rolls the transaction back. Delayed dependent writes resolve the same mapping after database reopen. Original identity fields are retained rather than rewritten; transport references and cached entity keys resolve to the server ID.

Server-side CREATE receipts additionally resolve legacy/local references across HTTP batches, scoped to user, device, mission, and entity type. Receipt purging, if explicitly invoked later, also removes that server fallback guarantee.

## 6. Dependency Resolution

Each enqueue transaction assigns a durable monotonic `queueOrder` and predecessor mutation ID for the same logical entity. Selection sends at most one ready mutation per entity per batch.

`CREATE -> acknowledgement -> durable mapping -> ASSIGN -> acknowledgement -> STATUS` is enforced. Unresolved local IDs, unacknowledged predecessors, retry delay, FAILED, and CONFLICT entries block that entity chain without treating waiting children as failed. Independent entities may continue.

The client retains the existing PENDING state for waiting children; the persisted predecessor/mapping requirement is the explicit dependency state. New READY/BLOCKED enum variants were unnecessary. Tests cover reordered children, delayed later batches, database reopen, and 55 queued mutations.

## 7. Queue Reliability

### Durable states and valid transitions

- PENDING -> SYNCING when its persisted wire body is claimed.
- SYNCING -> PENDING for retryable failure or explicit interrupted-flight recovery.
- SYNCING -> FAILED for permanent failure or exhausted automatic attempts.
- SYNCING -> CONFLICT for a real server conflict.
- FAILED -> PENDING only through explicit retry.
- CONFLICT -> FAILED only when its server conflict is confirmed missing and needs review.
- SYNCING -> acknowledged removal only together with successful local reconciliation.
- CONFLICT -> resolved removal only with persisted resolution state and authoritative entity reconciliation.

Unchanged states may receive attempt/error metadata. Invalid transitions throw at the Dexie persistence boundary. Success is represented by atomic removal from the active queue, not an indefinitely retained SYNCED row. Server receipts and durable mappings retain acknowledgement evidence.

### Persistence and crash recovery

Optimistic creation/observation and queue insertion commit together. Task edits/status/assignment are projected from the durable queue over the authoritative task cache, avoiding a separate lossy React-only state.

The in-process mutex coalesces rapid calls. An IndexedDB lease bounds concurrent tab processors; a crashed owner expires after at most 60 seconds. A successor recovers SYNCING entries to PENDING, preserving their exact attempted bodies and keys. Actual multiple-tab suspension/termination remains unverified in a browser.

Tests inject interruption before request dispatch, response loss after server processing, and failure during local acknowledgement persistence. Transaction rollback leaves the queue and temporary cache intact. Retrying a committed server request returns its prior receipt.

### Retry and partial failure

- Attempts, last attempt, error/code, retryability, and next attempt time are durable.
- Retryable: transport errors, timeouts, HTTP 408/425/429/5xx, and supported per-item temporary server errors.
- Backoff: exponential, starting at one second and capped at 60 seconds. Eight failed attempts exhaust automatic retry; explicit retry preserves identity and attempt history.
- HTTP 400/401/403/404/422 are not automatically retried. Generic HTTP 409 remains a visible manual-review failure; a structured per-item CONFLICT enters the conflict workflow.
- Missing/malformed acknowledgements cannot become fake success. Acknowledged entries remain removed; only incomplete entries remain retryable.
- Conflict/permanent failure blocks its own entity chain, not unrelated work.

The partial-result test preserves successful A/B/E, retains conflict C and its child, and retries temporary failure D without replaying A/B/E.

### Large queue and performance safety

Client test: 55 mutations across 11 task chains, including updates, assignments, status changes, observations, response loss, database reopen, and one unresolved conflict. Expected result: 11 tasks, 52 successful logical effects, one conflict plus two blocked children, ten fully active/assigned server-model tasks, and no stuck SYNCING entries.

Real server test: 55 mixed mutations over 20/20/15 HTTP batches, followed by replay of all 55. Expected result: 11 unique tasks, correct assignment/status, 55 fingerprint receipts, exactly 55 keyed MissionEvents, and all 55 events exposed in replay.

Processing remains sequential within each server batch and dependency chain, with a maximum HTTP batch of 20. Health checks run every 15 seconds; an eligible sync tick runs every 10 seconds. Backoff and reachability gate retries. No uncontrolled per-mutation parallelism or reconnect request flood was added. Tests did not benchmark thousands of queued entries; selection/cache projection still reads the finite account queue and should be measured before much larger-scale tuning.

## 8. Idempotency

| Scenario | Observed result |
|---|---|
| First CREATE | SYNCED; one entity, one receipt, one event |
| Exact retry | DUPLICATE with original authoritative result |
| Reordered equivalent payload | DUPLICATE |
| Nested reordered JSON | Same canonical hash |
| Reordered array | Different hash |
| Changed payload/key reused | FAILED / IDEMPOTENCY_KEY_REUSED; no execution |
| Changed operation or entity/key reused | Same collision rejection |
| Changed base version/key reused | Same collision rejection |
| Concurrent identical requests | One SYNCED, one DUPLICATE |
| Concurrent different payloads/same key | One execution; one collision rejection |
| Concurrent validation failures | Both FAILED, never fake DUPLICATE |
| Concurrent stale assignment | Both CONFLICT; one conflict record |
| Lost real server response | Client retries same body/key; one entity and logical event |
| Unhashed legacy receipt | Explicit unverifiable failure; no silent execution |

Every successful handler persists the original request identity and canonical fingerprint. Conflicts retain their original request fingerprint too. Key waiters validate meaning after waiting instead of inheriting another request's success/failure.

Current mission authorization is checked before receipt replay. Removing an operator causes a repeated acknowledged observation request to fail without returning its protected entity.

## 9. Conflict Handling

- CONFLICT rows remain durable and account-scoped; automatic queue selection excludes them and their dependent chains.
- Conflict refresh no longer loses account scoping or treats absence from an open list as proof of success. It retrieves the authoritative conflict before retiring the queued mutation.
- KEEP_SERVER returns the current task, not the obsolete conflict-detection snapshot. Client resolution atomically removes the old queue entry and reconciles local state.
- KEEP_LOCAL persists a fresh resolution UUID/key, validated intended payload, and exact presented/current base version before application. It uses normal task services and preserves state-machine/authorization rules. Assignment resolution is supported as well as updates, unassignment, and status.
- KEEP_LOCAL and MERGE reject a changed post-presentation version with CONFLICT_STALE_VERSION rather than blindly overwriting. The API supports an optional explicitly reviewed expectedServerUpdatedAt.
- MERGE remains commander-only, uses normal task input validation/services, and gets its own durable identity and receipt.
- Same-choice completed resolution retries return saved identity/result without applying changes twice. A MERGE retry with different data is rejected.
- Original conflicts and snapshots remain auditable. Resolution identity is included in the resolution audit event. The existing modal now displays resolution failures instead of leaving an unhandled promise rejection.

Full compare-and-swap and multi-document atomic resolution remain Phase 3. If a crash occurs after a task change but before conflict completion, safe rejection/manual reconciliation can still be necessary.

## 10. Connectivity Handling

The actual model remains separate browser state, API reachability, and the existing independent Socket.IO connection state. Conceptually:

| Condition | Mode/behavior |
|---|---|
| Browser offline | OFFLINE; cached session bootstrap and durable local writes need no network |
| Browser online, API unknown/unreachable | DEGRADED/server unavailable; do not infer ONLINE from navigator.onLine |
| API reachable and browser online | ONLINE for API sync; socket health remains independently represented |
| Wi-Fi available but health fails | API unreachable; do not pretend full service availability |
| Health succeeds after outage | Eligible queue resumes on existing bounded sync tick |
| HTTP 401/403/404/409/422 | API was reached; surface application failure, not an offline success |
| HTTP 500/503 | Service degraded; writes may retry, but stale reads do not silently mask the HTTP error |

Only recognized transport/no-response failures permit stale IndexedDB read fallback. Retryable server failures and permissible cached reads are deliberately different policies. The real operations store is tested for 400/401/403/404/409/422/500 rejection versus transport fallback.

No external monitoring API was added. The existing `/api/v1/health` endpoint is used. Logs contain mutation/operation/entity/state identifiers and batch outcomes, not payloads or authentication headers. Per-mutation processing/replay diagnostics are suppressed in production; no secret-bearing logging was added.

## 11. Browser Validation

**No actual browser validation passed or is claimed.** There was no Phase 1 Playwright/Cypress harness to extend. Two fresh observations of the existing BlackBox conversation tab returned:

`needs_attention: Select this tab in its conversation's browser panel to review website access, then retry.`

No browser authentication, DOM mutation, offline toggle, refresh, restart, or multi-tab action was dispatched. The blocker was not bypassed with an external browser/CDP connection.

Validation levels must not be conflated:

1. `client/tests/sync.test.cjs`: real Dexie/client services over fake-indexeddb, with database close/reopen and deterministic failures.
2. `client/tests/shell.test.cjs`: service-worker handler logic in a Node VM; not actual browser installation.
3. `client/tests/golden.cjs`: real client queue/API modules and IndexedDB adapter against the real Express/MongoDB test server; not React/browser rendering.

Still required in an approved browser, preferably the production preview because the service worker is production-only:

1. Login -> active mission -> offline create -> refresh -> verify -> reconnect -> verify server task.
2. Offline CREATE -> ASSIGN -> STATUS -> OBSERVATION, refreshing after each; close/reopen while offline; reconnect and inspect queue, server, events, replay.
3. Actual two-tab lease behavior and suspended/crashed-tab recovery, including the expiry delay.

## 12. Test Results

Environment: Windows, Node 24.14.0. Backend runs used a fresh mongodb-memory-server instance. The command-level MONGODB_URI was pointed at an intentionally unavailable local test URI, causing the existing non-production fallback to create an isolated clean database. No normal local database or `.env` was altered.

| Suite/measurement | Old | New | Added | Failed | Runner-skipped |
|---|---:|---:|---:|---:|---:|
| Backend assertion runner | 269 | 324 | 55 | 0 | 0 |
| Client Node tests | 0 | 36 | 36 | 0 | 0 |
| Combined executed checks* | 269 | 360 | 91 | 0 | 0 |

*Backend counts individual custom assertions; client counts Node test cases containing multiple assertions. The combined figure is an inventory, not equivalent test granularity. The older approximate 267 baseline predates the final verified Phase 1 count.

Browser validation: **three scenario groups NOT RUN**, not silently skipped or counted as passed. True browser process restart, rendered UI transitions, service-worker lifecycle, and real tab contention remain uncovered by the automated adapter tests.

Existing tests were retained. Two expectations were updated to the stronger contract: identical conflict-resolution retry replays its result rather than returning 409, and direct MissionEvent exact retry uses identical content. The prior changed-content event case is now an additional explicit collision-rejection assertion.

### Commands actually run

Client working directory:

```powershell
npm run typecheck
npm run lint
npm run build
npm test
```

Server working directory:

```powershell
npm run lint
npm run build
$env:NODE_ENV='test'; $env:MONGODB_URI='mongodb://127.0.0.1:1/blackbox_phase2_isolated'; npm test
```

Repository root:

```powershell
npm run lint
npm run build:server
git diff --check
git diff --cached --check
git status --short
```

All listed checks passed. `build:server` exists at the root; the server package's equivalent is `build`. Vite's approximately 527.5 kB main-bundle warning remains non-blocking. Git emits existing LF/CRLF normalization notices, not whitespace errors. New test dependencies are development-only fake-indexeddb and explicit esbuild (previously transitive via Vite).

### Test matrix and data integrity evidence

| Area | Coverage | Evidence/limit |
|---|---|---|
| Connectivity | ONLINE, OFFLINE, DEGRADED, unavailable, recovered | Monitor classification and real HTTP golden; physical browser network toggles not run |
| Queue sizes | 1, multiple task chains, 20-sized batches, 55 total | Client persistence suite; real server 20/20/15 processing and full retry |
| Dependencies | CREATE->UPDATE; CREATE->ASSIGN; CREATE->ASSIGN->STATUS | Client selection/projection and real cross-batch server lookup |
| Failures | No response/network, timeout classes, 408, 429, 500, 503; permanent 400/401/403/404/409/422 | Deterministic injected boundaries and actual store rejection; not a physical network chaos test |
| Lifecycle | Database reopen, retry, duplicates, response loss, partial results, acknowledgement transaction failure | Real client modules; physical page/browser restart not run |
| Conflict | KEEP_LOCAL, KEEP_SERVER, MERGE authorization/retry/version checks | Real Express/MongoDB requests plus client reconciliation |
| Mutex | Repeated invocation and durable lease contention/expiry | Automated single-process/adapter tests; real tabs not run |
| Shell | Initial JS/CSS precache; no API interception; old cache cleanup | Handler-level VM tests; actual installed worker not run |

The real server large-queue assertions inspect the database, not just HTTP status: 11 distinct task IDs, 11 ACTIVE tasks assigned to the intended operator, 55 processed receipts with fingerprints, and 55 keyed events before and after full retry. Replay returns those same 55 events.

The separate real-client golden case leaves one offline-created server task, the intended assignment and ACTIVE status, four receipts, four events, no remaining active queue entries, and a durable mapping replacing the temporary ID. The test checks the server via HTTP and the parent checks MongoDB counts independently.

The synthetic large client boundary model intentionally leaves one visible conflict and its two blocked children. It verifies 11 mappings/tasks and no SYNCING rows; it does not falsely require every entry to disappear despite the unresolved conflict. A separate resolution test reconciles KEEP_SERVER and drains the released dependent.

## 13. Golden Scenario Result

**Protocol/data-layer scenario: PASS. Full actual-browser scenario: NOT RUN.**

| Step | Automated result | What was actually verified |
|---|---|---|
| Login/session | PASS | Existing real auth integration tests; golden reads authenticated profile |
| Open active mission | PASS at API layer | Isolated active mission and membership established through real endpoints |
| Online create/assign/start | PASS | Real client queue -> real API -> MongoDB |
| Offline CREATE | PASS at client data layer | Durable optimistic local task and stable mutation |
| Offline ASSIGN | PASS at client data layer | Dependent intent and projected assignment survive DB reopen |
| Offline STATUS | PASS at client data layer | Dependent ACTIVE intent survives DB reopen |
| Offline OBSERVATION | PASS at client data layer | Local event and matching mutation key persist |
| Refresh after each operation | NOT RUN in browser | Dexie close/reopen tests pass; this is not a page-refresh claim |
| Close/restart browser while offline | NOT RUN | Durable database reopen is tested, not real browser process persistence |
| Reconnect/reachability | PASS at service/protocol layer | Monitor recovery classification and real HTTP submission |
| Dependency-aware sync | PASS | Creation acknowledgement precedes assignment and status delivery |
| Response loss/duplicate/retry | PASS | Real server commits; injected lost response retries same key/body |
| Verify queue/mappings/local state | PASS | Queue empty; server ID mapped; cache agrees |
| Verify server/events/replay | PASS | One task, intended assignment/status, four receipts/events in replay |
| Conflict and explicit resolution | PASS separately | Real conflict/version/authorization tests; client terminal reconciliation |

The golden child uses an explicit offline write flag and an IndexedDB adapter, not browser airplane mode. Its database remains available across connection closes within the test process; it does not prove persistence across an operating-system/browser shutdown. No actual browser step is counted as a passed test.

## 14. Remaining Issues

### P0

No P0 failure was observed in the executed checks. This does not prove behavior outside their stated scope.

### P1

1. **Browser release qualification is incomplete.** Actual offline reload, close/reopen, installed service-worker behavior, rendered queue counts, and real tab contention require approved browser access. These acceptance boxes must remain open.
2. **Server crash/multi-process atomicity remains bounded, not solved.** Entity save, event save, processed receipt, conflict completion, and socket broadcast are separate operations. A server crash between entity mutation and receipt persistence can repeat an entity write on retry. In-process key serialization is not a distributed lock. This is specifically deferred Phase 3 work, not hidden by the client retry tests.
3. **Version checks are still read-then-write.** Removing the one-second tolerance and rejecting stale resolution choices improves safety, but another writer can race the final read and save. Atomic version comparison belongs in Phase 3.

### P2

- Unhashed legacy receipts cannot safely be auto-verified and need explicit reconciliation rather than key regeneration. Existing pre-v4 cached entity account migration remains limited; queued mutations are migrated from their actor identity.
- A prepared conflict resolution interrupted after partial server writes can require manual review. An explicitly refreshed base version is supported by the API; the current modal is not a redesigned server-version comparison tool.
- Multi-thousand-entry queue performance and account-cache primary-key redesign were not undertaken. The active queue/mapping selection reads finite account data; benchmark before expanding scale.
- The production main-bundle size warning remains. No unrelated bundling optimization was attempted.

### P3

- Richer diagnostics/queue history and more extensive property/randomized testing can be considered later if operational evidence requires them.
- Cross-browser service-worker/storage-eviction qualification remains follow-up validation. Browser storage deletion/eviction cannot be treated as durable server replication.

## 15. Deferred Phase 3 Work

DATA CONSISTENCY & REPLAY remains unstarted:

1. MongoDB transactions or equivalent atomic design across entity, MissionEvent, receipt, and conflict completion.
2. Transactional outbox/durable socket publication and recovery for save-before-broadcast failure.
3. Multi-process mutation claiming/idempotency coordination with well-defined crash recovery; event keys alone do not make entity writes exactly once.
4. Stronger authoritative versions/compare-and-swap, including conflict resolution and protection from read/write races.
5. Repair/reconciliation policy for partial entity/event/receipt and resolution writes; explicit receipt-retention guarantees.
6. Replay cursor pagination.
7. Historical reconstruction hardening and complete event payload requirements.
8. Offline replay behavior.
9. Replay summary correctness/scaling.

No transaction/outbox implementation, replay pagination change, state-machine rewrite, or automatic Phase 3 work was performed in this phase.

## 16. Phase 2 Verdict

**READY WITH P1 REMAINING**

The targeted offline/sync implementation is substantially stronger and its executed automated checks pass: 324 backend assertions plus 36 client tests. Durable mappings, dependency ordering, stable retry identity, fingerprint collisions, partial failures, conflict handling, and real client/server response-loss reconciliation are demonstrated.

Full browser acceptance is not demonstrated, and server atomicity/distributed guarantees remain explicitly deferred. Do not interpret this verdict as every Phase 2 acceptance checkbox being complete or as approval to advance automatically.

Next authorized action: complete the three browser validation groups once website access is approved, review this report and remaining P1 risks, then decide whether to authorize Phase 3. **Stop here; no Phase 3 implementation was started.**
