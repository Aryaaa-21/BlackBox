# BlackBox Release Audit

## Repository separation decision

BlackBox retains:

```text
client/  → React/Vite/Zustand/Dexie/Socket.IO client, PWA shell, browser tests
server/  → Express/Mongoose/JWT/Socket.IO server, sync, conflicts, replay, backend tests
docs/    → architecture, operations, release, and audit evidence
```

The directories are cleanly separated by responsibility. Renaming them to `frontend/` and `backend/` was deliberately not performed because the root workspace scripts, package-lock workspace entries, Playwright setup, environment paths, and existing command documentation all depend on `client/` and `server/`. A rename at the final gate would add repository/integration risk without improving the actual separation.

## Current release state

The candidate working tree contains both client and server. However, the current Git `HEAD` is an earlier backend-only commit. Until the complete candidate is committed, a clean clone of `HEAD` cannot reproduce the frontend.

## Audit result

- Frontend build/typecheck/lint: passed.
- Backend build/lint/tests: passed; 419 assertions.
- Dependency audit: 0 production vulnerabilities.
- Clean install/build: passed.
- Two-browser realtime acceptance: passed.
- Clean browser offline observation → replay: failed because the expected `OBSERVATION_RECORDED` event was absent from replay.
- Live GitHub release push: intentionally not performed because the final release gate is blocked.
- Vercel deployment: intentionally not performed because the candidate is not release-qualified and the backend is not deployed for production integration.

See `docs/PHASE6_FINAL_RELEASE_REPORT.md`, `docs/FINAL_TEST_MATRIX.md`, and `docs/LIMITATIONS.md` for the complete evidence and remaining actions.
