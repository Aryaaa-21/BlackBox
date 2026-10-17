# BlackBox Final Test Matrix

Evidence is based on commands actually run during Phase 6. `PASS` means the named check completed successfully; it does not promote a narrower check into full release evidence.

| Area | Scenario | Expected | Actual | Status | Evidence |
|---|---|---|---|---|---|
| Repository | Git working tree audit | Source/docs/tests/config are visible and intentional | Current worktree contains frontend and docs changes; many changes remain staged/uncommitted | BLOCKED | `git status --short` |
| Repository | Clean clone at current HEAD | Client and server are present | `client/package.json` is absent from HEAD clone; server is present | FAIL | Phase 6 HEAD clone: `client=False`, `server=True` |
| Install | Clean source snapshot | Install without old dependencies | `npm ci` completed with 455 packages | PASS | Clean Phase 6 snapshot |
| Build | Clean server build | TypeScript emits successfully | Passed | PASS | `npm run build:server` |
| Build | Clean client build | Vite production build succeeds | Passed; 533 kB main-chunk advisory | PASS | `npm run build:client` |
| Backend | Full regression | No failures | 419 passed, 0 failed | PASS | `npm test` in `server` |
| Client | Unit/integration-style suite | No failures | 50 passed, 0 failed | PASS | `npm test` in `client` |
| Client | Typecheck/lint | No errors | Passed | PASS | `npm run typecheck`, `npm run lint` |
| Security | Production secret validation | Missing production JWT secret fails clearly | Passed | PASS | production `env.ts` validation command |
| Security | Dependency audit | No high/critical production dependency findings | 0 vulnerabilities | PASS | `npm audit --audit-level=high --omit=dev` |
| Browser | Smoke | Auth/mission/task/team/replay smoke works | 3 passed in latest completed Phase 5 smoke run | PASS | `npm run test:e2e:smoke` |
| Browser | Offline/reconnect/replay on clean snapshot | Complete real browser journey succeeds | Observation replay assertion failed; realtime test passed | FAIL | Clean snapshot acceptance: 1 passed, 1 failed |
| Browser | Two-browser realtime | Authorized update reaches second context | Passed in clean snapshot acceptance run | PASS | `@realtime` acceptance test |
| Persistence | Client queue/cache/reopen | Durable local data survives test reopen scenarios | Covered by 50 client tests | PASS | client test suite |
| Consistency | Entity + event + receipt transaction | No impossible partial success | Covered by backend regression | PASS | 419 backend assertions |
| PWA | Service worker shell/API boundary | Static shell cached; private API not cached | Covered by client shell tests | PASS | service-worker tests in client suite |
| Deployment | Actual deployed environment | Production deployment is verified | No deployment target configured or tested | NOT APPLICABLE | Local release candidate only |
| Responsive | 375/768/1366/1920 viewport matrix | Core workflows usable at all sizes | Not run | BLOCKED | No Phase 6 viewport evidence |
| Restart | Browser close/reopen journey | Session/cache/queue survive real restart | No dedicated passing browser restart test | BLOCKED | Existing report limitation |
