# BlackBox Release Checklist

**Certification pass:** 2026-10-17
**Current classification:** **B — FEATURE COMPLETE BUT RELEASE BLOCKED**

`[x]` means verified by an executed check. `[~]` means implemented or partially exercised but not a release-quality pass. `[ ]` means unverified or not complete.

## Functional

- [x] Authentication and logout — Chromium smoke suite
- [x] Mission management — server suite and Chromium smoke
- [x] Team management — server suite and targeted browser acceptance
- [x] Tasks — client/server suites and targeted browser acceptance
- [x] Observations/SITREPs — client/server suites and targeted browser acceptance
- [x] Offline mode — client persistence/queue tests
- [x] Durable mutation queue — 54 client tests
- [x] Synchronization — server suite and client queue tests
- [x] Idempotency — duplicate, response-loss, and concurrent server tests
- [x] Conflict resolution logic — server suite and client reducer tests
- [~] Conflict resolution browser journey — supported UI exists, deterministic browser flow not verified
- [~] Realtime collaboration — prior two-context run passed; latest full run was not stable
- [x] MissionEvents — server transaction and immutability tests
- [x] Mission Replay — reducer, cursor, malformed-event, and client cache tests

## Reliability

- [x] Network failure during mutation — durable client queue tests
- [x] Network failure during sync — response-loss and transport-failure tests
- [x] Backend 500 — retry/backoff client tests and server transaction tests
- [x] Auth failure during sync — HTTP 401 is retained as a non-retryable recoverable failure
- [x] Database/entity/event/receipt/commit failure injection — server atomicity tests
- [x] Browser refresh while offline — client persistence tests and targeted browser acceptance
- [~] Browser restart while offline — simulated through IndexedDB close/reopen; real browser process restart not verified
- [x] 1,000+ mutations — 1,000 real client-path mutations, browser/database reopen simulation, response loss, and exact reconciliation
- [x] Duplicate mutation retry — 20 duplicate acknowledgements in the 1,000-mutation stress test
- [x] Dependency ordering — CREATE → ASSIGN → STATUS tests
- [x] Replay determinism — pure reducer and identical cursor/replay tests
- [~] Socket.IO disconnect/recovery — reconnect backfill hardening implemented; browser recovery pass remains unverified
- [~] Multi-tab behavior — durable lease verified; full browser multi-tab workflow not run
- [ ] Storage quota/IndexedDB corruption failure injection
- [ ] Long-duration real browser air-gap process restart

## Security

- [x] Password hashing and protected routes
- [x] JWT validation, expiration, logout, and active-account checks
- [x] Mission/task/replay/conflict authorization tests
- [x] Server-side input validation for sync and direct routes
- [x] Duplicate/idempotency-key rejection
- [x] Production JWT/CORS configuration validation
- [x] Dependency audit — `npm audit --omit=dev`: 0 vulnerabilities
- [~] Repository secret scan — no committed production credential identified; local test fixtures contain non-secret test values
- [x] Socket handshake now reloads the current active user before accepting a connection
- [~] CSRF/origin defense for cookie-authenticated mutations — SameSite/CORS protections exist; explicit CSRF token not implemented

## Deployment

- [x] Client typecheck
- [x] Server typecheck/lint
- [x] Client production build
- [x] Server production build
- [x] Production env validation
- [x] Dockerfiles and local replica-set compose configuration
- [x] Liveness/readiness endpoints
- [x] CI workflow definition
- [~] Docker image build — compose config passed; Docker daemon unavailable for image build
- [ ] Managed MongoDB deployment
- [ ] HTTPS/TLS reverse proxy deployment
- [ ] Hosted CI execution
- [ ] Backup/restore drill
- [ ] External production deployment

## Browser matrix

- [x] Chromium smoke
- [~] Chromium full acceptance — latest run did not complete as a clean pass
- [ ] Firefox
- [ ] WebKit/Safari
- [ ] Responsive checks at 320, 375, 768, 1024, and 1440+ px

## Demo

- [~] Deterministic demo data seed exists in the browser setup
- [~] Offline → reconnect → replay demo — targeted portions pass; full final scenario is not certified
- [ ] Browser conflict creation and resolution demo
- [x] No credentials in demo output/reporting

## Repository hygiene

- [x] `git diff --check`
- [~] No generated build output or browser artifacts are tracked; current working tree contains unrelated uncommitted UI/dependency changes that must be reviewed separately
- [x] Frontend, backend, tests, deployment files, and documentation are present

## Release gate

Release remains blocked by the following P1 items:

1. Full Chromium acceptance must complete reliably without sync/realtime timing failures.
2. A deterministic browser conflict flow must be verified.
3. Docker images, hosted CI, and a real HTTPS/managed-Mongo deployment must be validated before production claims.

Do not mark this checklist as release-ready until those gates have execution evidence.
