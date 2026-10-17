# BlackBox Known Limitations

## Release blockers

- The current Git `HEAD` is backend-only. The frontend and much of the release candidate are staged/uncommitted in the working tree, so a clean clone of `HEAD` cannot reproduce the product.
- The clean-install browser acceptance run failed the offline observation → replay assertion. Realtime passed, and backend/client persistence suites pass, but the full browser journey is not release-qualified.

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

- The production client main bundle is approximately 533 kB after minification, producing a Vite advisory. No code-splitting optimization was introduced during the release audit.
