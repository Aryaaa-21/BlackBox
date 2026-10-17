# Changelog

## Release candidate — Phase 6 audit

### Foundation

- Consolidated the current React/Vite frontend and Express/Mongoose backend documentation.
- Preserved the existing IndexedDB, mutation queue, MissionEvent, Socket.IO, and replay architecture.

### Offline and sync

- Durable queue identities, dependency ordering, retry, response-loss recovery, and local/server ID mapping are covered by the Phase 2/3 regression suites.
- Client and server transaction/idempotency behavior remains covered by the final automated suites.

### Consistency and replay

- Entity/event/receipt transaction boundaries and optimistic version conflicts remain covered.
- Event-only deterministic replay, signed cursors, high-water pagination, and pending-event disclosure remain documented.

### Browser acceptance

- Production-preview Playwright harness exercises a real shell/service worker, IndexedDB, REST, Socket.IO, and isolated replica-set database.
- Smoke and two-browser realtime paths have passing evidence.
- The clean-snapshot offline observation → replay journey remains a release blocker.

### UI/UX

- Default animated shell was replaced by static operational CSS surfaces for browser/demo reliability.
- Connectivity, sync, loading, empty, error, conflict, and replay states remain visible and explicit.

### Security and release audit

- Demo reset no longer returns demo passwords or authentication tokens.
- Demo mode is opt-in and disabled in production.
- Production CORS excludes local origins.
- Added final test, security, release, limitations, and demo-video checklists.

This is an audit record, not a claim that the release gate has passed.
