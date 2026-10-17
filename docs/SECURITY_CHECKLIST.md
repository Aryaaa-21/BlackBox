# BlackBox Final Security Checklist

## Authentication

- [x] Passwords are hashed with bcryptjs.
- [x] JWT validation is server-side.
- [x] Invalid/expired tokens return 401.
- [x] Logout clears the HTTP-only auth cookie and client session.
- [x] Public registration cannot select a privileged role.
- [x] Production startup rejects a missing/short JWT secret.
- [x] Demo reset no longer returns passwords or authentication tokens.

## Authorization

- [x] Mission membership/ownership is checked server-side.
- [x] Commander-only actions use server role checks.
- [x] Task, team, event, replay, sync, and conflict paths are authorization-aware.
- [x] Socket mission-room access is authorization-checked.
- [x] Demo reset and conflict trigger require authenticated commander access.
- [x] Backend regression covers revoked membership and cross-mission access.

## Data and event integrity

- [x] User responses omit `passwordHash`.
- [x] MissionEvents are protected against ordinary edits/deletes.
- [x] Actor snapshots are server-derived.
- [x] Entity, event, and idempotency receipt writes use the transaction boundary where required.
- [x] Replay reads immutable event history rather than current state reconstruction.
- [x] Same-key changed-payload collisions are rejected.

## Demo

- [x] Demo mode is opt-in (`ENABLE_DEMO_MODE=true`) and disabled in production.
- [x] Demo reset requires a private `DEMO_PASSWORD` configuration.
- [x] Demo reset returns metadata only, not passwords/tokens.
- [x] Demo operations are scoped to dedicated demo accounts/missions.
- [x] Production CORS no longer adds local development origins.
- [ ] A deployed production demo environment has not been tested.

## Configuration and repository

- [x] `.env` files are ignored.
- [x] Local `server/.env` was removed from the workspace and is not tracked.
- [x] Production fallback secret is rejected at startup.
- [x] `npm audit --omit=dev` reports 0 vulnerabilities.
- [x] No private key/token pattern was found in tracked source/docs after the final search.
- [ ] Current Git `HEAD` does not contain the frontend; the release candidate is still uncommitted.
