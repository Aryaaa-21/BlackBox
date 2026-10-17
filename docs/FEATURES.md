# BlackBox Feature Matrix

Statuses use the Phase 4 vocabulary:

- **VERIFIED** — verified in the relevant automated/browser evidence.
- **BACKEND VERIFIED ONLY** — API/database behavior verified, browser journey not completed.
- **IMPLEMENTED BUT UNVERIFIED** — code exists, but required acceptance evidence is missing.
- **BLOCKED** — validation could not be completed because of environment/suite limitations.
- **NOT IMPLEMENTED** — feature is absent.

| Feature | Status | Evidence |
|---|---|---|
| Commander/field-operator authorization | VERIFIED | Server regression tests and targeted browser login/role flows |
| Public registration cannot create commanders | VERIFIED | Server security regression tests |
| Mission CRUD/lifecycle | BACKEND VERIFIED ONLY | Server tests; full browser lifecycle not completed |
| Team add/remove | BACKEND VERIFIED ONLY | Server tests; targeted browser team rendering passed |
| Task CRUD and state machine | BACKEND VERIFIED ONLY | Server tests; targeted browser task rendering passed |
| Offline task/observation mutation queue | BACKEND VERIFIED ONLY | 50 client tests and Phase 2 report |
| Offline browser refresh persistence | IMPLEMENTED BUT UNVERIFIED | Browser attempt did not complete stably |
| Browser restart persistence | NOT IMPLEMENTED | Dedicated persistent-context test remains |
| Durable local IDs and dependencies | VERIFIED in automated client/server tests | Phase 2/3 evidence |
| Idempotency and retry | VERIFIED in automated client/server tests | Phase 2/3 evidence |
| Transactional entity/event/receipt writes | VERIFIED in backend tests | Phase 3 report |
| Optimistic concurrency/conflicts | BACKEND VERIFIED ONLY | Phase 3 tests; browser conflict not completed |
| Socket.IO realtime collaboration | IMPLEMENTED BUT UNVERIFIED | Two-browser test exists but is unstable |
| Mission-room isolation | BLOCKED | Browser acceptance not completed |
| Deterministic event replay | VERIFIED in automated client/server tests | Phase 3 report |
| Replay route and targeted UI loading | VERIFIED in targeted browser smoke | Phase 4 report |
| Replay playback/pagination in browser | IMPLEMENTED BUT UNVERIFIED | Full browser playback not completed |
| Demo reset and conflict trigger | BACKEND VERIFIED ONLY | Guarded demo service tests and settings controls |
| Responsive viewports | BLOCKED | Phase 4 viewport matrix not completed |
| Production-preview browser run | BLOCKED | Build passes; preview browser run remains |
