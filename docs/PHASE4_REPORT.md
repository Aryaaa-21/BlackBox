# BLACKBOX PHASE 4 REPORT
REAL BROWSER ACCEPTANCE & END-TO-END RELIABILITY

Date: 2026-10-16 (Asia/Calcutta)

## 1. Executive Summary

Phase 4 established a real Playwright browser environment and exercised the actual Vite frontend, Express backend, ephemeral replica-set MongoDB, real IndexedDB, and real Socket.IO connection. The browser tests are not API-only tests and do not use mocked IndexedDB, Socket.IO, or synchronization for the attempted journeys.

The browser smoke path reached real login, dashboard, logout, refresh, mission, team, task, and replay UI states in targeted runs. Browser testing also exposed and received focused fixes for logout sequencing, mission-detail cache hydration blocking, and offline task-status optimistic projection.

However, the full smoke run was not stable, and the critical offline/realtime acceptance journeys did not complete reliably. Two-browser realtime, offline mutation → refresh → reconnect → sync, conflict, responsive viewport, production-preview, browser restart, and full demo validation were not successfully completed. The final verdict is therefore **NOT READY**.

## 2. Test Environment

| Item | Configuration |
|---|---|
| Browser framework | Playwright Test `@playwright/test` |
| Browser | Playwright Chrome for Testing / Chromium `156.0.8078.4` |
| Default viewport | Playwright Desktop Chrome default viewport, approximately 1280×720 |
| Frontend | Vite at `http://127.0.0.1:5174` |
| Backend | Express + Socket.IO at `http://127.0.0.1:5001` |
| Database | Ephemeral `MongoMemoryReplSet`, isolated per Playwright run |
| Browser storage | Real Chromium IndexedDB and cookies in each browser context |
| Test users | Deterministically seeded commander and field operator; test-only credentials, not production credentials |
| Test command | `npm run test:e2e:smoke` and `npx playwright test --project=acceptance` in `client` |

The test database is seeded by `client/tests/e2e/global-setup.cjs`. It creates a commander, field operator, active mission, active memberships, a fixture task, and initial MissionEvents. The backend is started with a test-only JWT secret and the isolated replica-set URI. No developer or production database is used.

## 3. Test Architecture

The exercised architecture is:

```text
Real Chromium browser
  → Vite React frontend
  → Axios REST API + Socket.IO
  → Express/Mongoose backend
  → isolated MongoMemoryReplSet database
  ↔ real Chromium IndexedDB / cookies / service-worker-capable browser storage
```

Critical acceptance paths use real frontend controls and real browser context network control. The server is not replaced with a mock. The browser contexts are independent when the two-browser test is attempted.

## 4. Browser Test Inventory

Implemented suites:

- `client/tests/e2e/smoke.spec.cjs`
  - `@smoke @auth` landing → login → dashboard → logout;
  - invalid credentials and refresh after login; and
  - mission, task, team, and replay route smoke.
- `client/tests/e2e/acceptance.spec.cjs`
  - `@critical @offline @replay` online mission → offline task/observation → refresh → reconnect → replay;
  - `@critical @realtime` two independent browser contexts and mission-room update.
- `client/playwright.config.cjs`
  - isolated global setup/teardown;
  - smoke and acceptance project tags;
  - screenshots, traces, and videos on failure; and
  - artifact directories ignored from Git.

The suite currently does not yet contain successful dedicated responsive, browser-restart, conflict-dialog, mission-lifecycle, room-isolation, network-flap, or production-preview projects.

## 5. Critical Journey

| Journey step | Result | Evidence / classification |
|---|---|---|
| Start isolated backend/database/frontend | **VERIFIED** | Playwright global setup starts the real stack and waits for backend health/frontend readiness |
| Commander login through UI | **VERIFIED** | Targeted smoke and invalid-credential runs reached the dashboard |
| Dashboard and authenticated identity | **VERIFIED** | Dashboard and Browser Commander were visible in successful runs |
| Mission opened through UI route | **VERIFIED** | Targeted mission smoke reached mission detail, task, team, and replay routes |
| Online task UI state | **VERIFIED** | Fixture task rendered in the real task table |
| Network disabled in browser | **IMPLEMENTED BUT UNVERIFIED** | Acceptance test calls real `context.setOffline(true)` but the complete journey did not finish |
| Offline task creation | **IMPLEMENTED BUT UNVERIFIED** | Attempted through real modal and IndexedDB-backed mutation path; run failed before complete reconciliation evidence |
| Offline assignment/status/observation | **IMPLEMENTED BUT UNVERIFIED** | Attempted; no final end-to-end pass |
| Offline refresh | **IMPLEMENTED BUT UNVERIFIED** | Attempted in the critical test; no completed pass |
| Browser restart | **NOT IMPLEMENTED** | No persistent-context restart test was completed |
| Reconnect and queue drain | **IMPLEMENTED BUT UNVERIFIED** | Existing Node tests cover it; real browser critical journey did not complete |
| Two-browser realtime | **IMPLEMENTED BUT UNVERIFIED** | Two-context test was created but timed out before a reliable pass |
| Conflict through browser UI | **BACKEND VERIFIED ONLY** | Phase 3 backend/API tests pass; browser conflict journey was not completed |
| Conflict resolution through browser UI | **BACKEND VERIFIED ONLY** | Existing UI exists, but browser acceptance did not complete |
| Replay after offline sync | **IMPLEMENTED BUT UNVERIFIED** | Targeted replay route smoke passed; offline-synced replay did not complete |

## 6. Two-Browser Testing

The test creates:

- Browser A: commander;
- Browser B: field operator;
- separate Playwright browser contexts;
- same seeded mission and mission room.

The test attempts an online task transition in Browser A and waits for Browser B to update without refresh. It did not complete reliably. The run timed out during the two-context flow and was classified as **FLAKY TEST / PRODUCT-ENVIRONMENT INTERACTION**, not a pass.

Mission-room isolation was not run to completion. No claim is made that Mission A events are isolated from Mission B in the browser.

## 7. Offline Testing

The acceptance test uses actual browser network control with `context.setOffline(true)`, not merely the application connectivity state. It attempts:

1. loaded mission/task;
2. offline indicator;
3. offline task creation with assignment;
4. offline status transition;
5. offline observation;
6. browser refresh while offline;
7. network restoration; and
8. replay navigation.

The full sequence did not pass. Therefore:

- offline detection: **IMPLEMENTED BUT UNVERIFIED**;
- offline create/assign/status/observation: **IMPLEMENTED BUT UNVERIFIED**;
- offline refresh durability: **IMPLEMENTED BUT UNVERIFIED**;
- browser restart durability: **NOT IMPLEMENTED**;
- reconnect and queue drain: **BACKEND VERIFIED ONLY / CLIENT NODE VERIFIED**, not browser-verified.

The attempted run exposed a genuine client defect where an offline task status mutation did not produce an optimistic task projection when an existing cached task was present. That was fixed by projecting task mutations before durable enqueue. The browser journey still requires a clean successful rerun.

## 8. Conflict Testing

The real browser conflict journey was not completed.

- Conflict detection: **BACKEND VERIFIED ONLY** through Phase 3 concurrent API tests.
- Conflict dialog: **IMPLEMENTED BUT UNVERIFIED**. The existing UI displays local/server status and Keep Server/Keep Local actions.
- Keep Server: **BACKEND VERIFIED ONLY**.
- Keep Local: **BACKEND VERIFIED ONLY**.
- Merge authorization: **BACKEND VERIFIED ONLY**. The current conflict UI does not expose a Merge action; no large UI feature was added.

No browser result is being promoted from backend evidence to `VERIFIED`.

## 9. Replay Testing

Targeted browser smoke reached the replay route after opening a real mission. Replay controls and historical state were not fully exercised in a stable full acceptance run.

- Replay route loads: **VERIFIED in targeted smoke run**.
- Historical reconstruction from browser-visible timeline: **IMPLEMENTED BUT UNVERIFIED**.
- Play/pause/next/previous/reset/speed/seek: **IMPLEMENTED BUT UNVERIFIED**.
- Replay pagination through multiple browser pages: **BACKEND VERIFIED ONLY**.
- Replay authorization: **BACKEND VERIFIED ONLY**.
- Offline-synced history → replay: **IMPLEMENTED BUT UNVERIFIED**.
- Conflict → resolution → replay: **BACKEND VERIFIED ONLY**.

The existing Node client suite and Phase 3 backend suite provide strong non-browser evidence, but they do not satisfy Phase 4 browser acceptance.

## 10. Responsive Testing

No responsive browser runs were completed.

| Viewport | Result |
|---|---|
| 375×812 | **BLOCKED / NOT RUN** |
| 768×1024 | **BLOCKED / NOT RUN** |
| 1366×768 | **BLOCKED / NOT RUN** |
| 1920×1080 | **BLOCKED / NOT RUN** |

No responsive claim is made.

## 11. Test Results

### Browser tests

Final full smoke command:

```text
npm run test:e2e:smoke
```

Result: **3 tests, 1 passed, 2 failed** in the final full run.

Final acceptance command:

```text
npx playwright test --project=acceptance
```

Result: **2 tests, 0 passed, 2 failed**. The offline critical journey and two-browser realtime journey timed out or aborted before completion.

Aggregate final suite result: **5 browser tests, 1 passed, 4 failed, 0 skipped**.

Targeted reruns did individually pass the invalid-credentials/refresh test, the landing/logout test after its fix, and the mission/task/team/replay route test. Because the full suite was not repeatable, these are recorded as targeted evidence, not full-suite readiness.

### Other checks

- Client Node tests: **50 passed, 0 failed**.
- Client typecheck: **passed**.
- Client lint: **passed** after ignoring generated Playwright artifacts and configuring CommonJS test files.
- Client production build: **passed** with the existing main-chunk advisory.
- Server lint/build: **passed**.
- Phase 3 backend assertions: **417 passed, 0 failed**.

Classification:

- Passed: targeted browser smoke paths and auth flows.
- Failed: stable full smoke suite, offline critical journey, two-browser realtime journey.
- Flaky: browser startup/navigation/actionability under the animated shader shell and multi-context load; repeated runs produced different failures.
- Blocked/not run: responsive, browser restart, conflict UI, network flap, production-preview browser suite, full demo runbook.

## 12. Backend Correlation

The following correlations are available from the existing application and Phase 3 evidence, but only some were browser-exercised:

| UI action | API | Database / event | Browser result |
|---|---|---|---|
| Login | `POST /api/v1/auth/login` | Session cookie/IndexedDB session; `/auth/me` on refresh | **VERIFIED** in targeted smoke |
| Mission list/detail | `GET /api/v1/missions`, `GET /api/v1/missions/:id` | Real seeded mission and memberships | **VERIFIED** in targeted mission smoke, unstable in full suite |
| Task status | `PATCH /api/v1/tasks/:id/status` online or queued mutation offline | Task version + `TASK_STARTED`/transition event | **BACKEND VERIFIED ONLY** for full correlation |
| Offline create | queued `CREATE_TASK` → `POST /api/v1/sync` | Task + MissionEvent + ProcessedMutation | **IMPLEMENTED BUT UNVERIFIED** in browser |
| Observation | observation endpoint or queued `RECORD_OBSERVATION` | `OBSERVATION_RECORDED` | **IMPLEMENTED BUT UNVERIFIED** in browser |
| Realtime | Socket.IO mission room | authoritative cache/Zustand reconciliation | **IMPLEMENTED BUT UNVERIFIED** in two-browser test |
| Replay | `GET /api/v1/missions/:id/replay` | immutable event history and reducer state | route **VERIFIED**; historical browser journey **UNVERIFIED** |

## 13. Bugs Found

### BUG-P4-001 — Logout navigation race

- Severity: P1
- Area: authentication/browser session
- Reproduction: log in, open the user menu, click Sign out.
- Expected: session clears, then browser navigates to login.
- Actual: navigation could race `logout()`, and the public-only guard redirected back to dashboard.
- Root cause: `void logout(); navigate('/login')` navigated before the async session clear completed.
- Fix: await `logout()` before navigating.
- Regression test: targeted real-browser landing/login/logout smoke passes after the fix.
- Status: **FIXED**.

### BUG-P4-002 — Mission detail cache hydration could block server loading

- Severity: P1
- Area: mission detail/browser startup
- Reproduction: open a mission in a real browser while cache hydration/live IndexedDB work is active.
- Expected: API mission detail loads independently of cache hydration.
- Actual: the page could remain on “Loading mission” even when task/member/event API requests succeeded.
- Root cause: `missionsApi.get()` was chained after `hydrateCache()`.
- Fix: cache hydration is now best-effort and the authoritative mission request starts independently.
- Regression test: targeted mission route smoke can reach task/team/replay views; full-suite stability remains open.
- Status: **FIXED, NEEDS STABLE FULL-SUITE RERUN**.

### BUG-P4-003 — Offline task status lacked an optimistic projection

- Severity: P1
- Area: offline task mutation
- Reproduction: create/cache a task, disable browser network, click Start.
- Expected: task immediately displays ACTIVE and remains durable.
- Actual: task remained PENDING because an existing cached task caused `optimisticEntity` to be omitted.
- Root cause: queued change mutations only projected when no authoritative cache row existed.
- Fix: task mutations now apply a pure optimistic projection before durable enqueue.
- Regression test: targeted browser journey reached this assertion before later navigation instability; Node queue tests remain green.
- Status: **FIXED, NEEDS STABLE FULL-SUITE RERUN**.

### BUG-P4-004 — Browser shell actionability/startup instability

- Severity: P1
- Area: browser acceptance reliability
- Reproduction: repeated Playwright smoke and two-context runs under the animated shader shell.
- Expected: stable semantic controls and page transitions.
- Actual: repeated runs intermittently stalled on landing bootstrap, sidebar/row navigation, tab actionability, replay navigation, or context startup; GPU/shader stall messages appeared in browser logs.
- Root cause: not yet isolated; likely interaction between animated visual shell, browser rendering, and asynchronous bootstrap/re-render timing.
- Fix: no production workaround was applied beyond test-side Chromium `--disable-gpu`, forced clicks in the acceptance harness, and direct route use in one critical helper. Those measures did not produce a stable full suite.
- Regression test: current Playwright smoke/acceptance suites reproduce the instability.
- Status: **OPEN**.

## 14. Remaining Issues

### P0

- None identified.

### P1

1. Full browser smoke suite is not stable.
2. Critical offline → refresh → reconnect → sync → replay browser journey does not pass.
3. Two-browser realtime update does not pass reliably.
4. Browser conflict detection/resolution is not verified.
5. Browser restart durability is not verified.

### P2

1. Responsive browser matrix has not been run.
2. Production-preview browser validation has not been run.
3. Mission-room isolation, network flap, refresh-during-sync, and crash-recovery browser tests are absent.
4. Browser test actions still need more stable semantic synchronization rather than forced clicks/direct route fallback.

### P3

1. Vite production bundle remains above the 500 kB advisory threshold.
2. Playwright artifacts are retained only on failure locally and ignored by Git; CI artifact retention policy is not defined.

## 15. Known Limitations

### Implemented but unverified

- Real offline task creation/assignment/status/observation through a complete browser run.
- IndexedDB queue persistence across actual browser restart.
- Browser reconnect reconciliation and Socket.IO recovery.
- Browser conflict dialog and Keep Server/Keep Local resolution.
- Browser replay playback correctness at every historical frame.
- Mission-room isolation.
- Responsive viewport matrix.
- Production-build browser acceptance.

### Backend/client evidence only

- Transactions, idempotency, conflict resolution, deterministic replay, cursor pagination, and offline queue behavior have strong Phase 2/3 automated evidence, but that is not browser acceptance evidence.

### Not implemented in this phase

- Dedicated persistent-browser-context restart test.
- Full 3-minute browser demo runbook test.
- Browser network-flap and crash-recovery suites.
- Merge UI; backend authorization exists, but the existing UI exposes Keep Server/Keep Local only.

## 16. Demo Readiness

**NO** — the full 3-minute BlackBox demo cannot currently be claimed reliable from a clean environment.

The isolated browser environment starts reproducibly and the login/dashboard/mission/replay targeted paths work, but the acceptance suite is not repeatable. The offline and realtime promises that define the demo were not completed through a stable real-browser run. The remaining shader/bootstrap/actionability instability and missing browser conflict/restart validation must be resolved before demo readiness.

## 17. Phase 4 Verdict

**NOT READY**

Phase 4 produced a real Playwright test environment, deterministic isolated test data, browser artifacts, targeted smoke evidence, and several focused browser fixes. It did not satisfy the Phase 4 completion criteria because the full smoke suite is unstable and the critical two-browser/offline/sync/realtime/replay journey did not pass end-to-end. Phase 5 was not started.
