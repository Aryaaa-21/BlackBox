# BlackBox Known Limitations

## Release blockers

- The working tree contains an unreleased candidate; this report does not claim that a clean clone of the current `HEAD` contains these uncommitted changes. A release owner must commit and review the candidate before tagging.
- External cloud deployment, managed MongoDB, HTTPS, TLS, backups, restore drills, and multi-instance Socket.IO scaling remain unverified.

## Browser and PWA

- Chromium is the only browser with meaningful acceptance evidence.
- Firefox/WebKit, mobile viewport, and keyboard-only matrix runs are not complete.
- Service-worker shell caching is tested, but deployment update behavior across incompatible old clients is not tested against a live deployment.
- Browser close/reopen persistence has automated IndexedDB evidence but lacks a dedicated passing real-browser restart run.

## Synchronization

- Automatic reconnect draining has previously left pending mutations in a combined browser run. Settings → Sync now is a visible recovery path, but it is not a substitute for proving automatic drain.
- The acceptance suite uses an isolated replica-set database and test accounts; it is not production deployment evidence.

## Deployment

- BlackBox is not deployed by this repository audit. HTTPS, production CORS, real WebSocket transport, managed MongoDB, and deployed service-worker behavior remain deployment work.
- `docker-compose.yml` currently describes a standalone MongoDB container while protected writes require a replica set or mongos. Use the documented replica-set setup or the development memory-replica fallback; do not treat the compose file as a production deployment recipe.

## Demo

- Demo reset requires a private `DEMO_PASSWORD` and no longer returns credentials/tokens through the API.
- A two-consecutive-clean three-minute recording has not been completed.

## Performance

- Route-level code splitting reduced the main client chunk below the default Vite 500 kB warning threshold in the current local build. Deployed network performance remains unverified.
