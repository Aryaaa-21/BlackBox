# BlackBox Final Release Checklist

## Code

- [x] Server build passes.
- [x] Client build passes.
- [x] Server lint/typecheck passes.
- [x] Client typecheck/lint passes.
- [x] Server tests pass: 419 expected after the final demo-security assertion.
- [x] Client tests pass: 50.

## Security

- [x] Production JWT secret validation.
- [x] Server authorization regression coverage.
- [x] Demo maintenance is opt-in and protected.
- [x] Demo reset no longer exposes credentials/tokens.
- [x] Dependency audit has no high/critical production findings.
- [ ] Current Git HEAD contains the complete frontend release candidate.

## Data and reliability

- [x] Transaction/idempotency/conflict/replay backend evidence.
- [x] Durable queue/cache client evidence.
- [x] Service-worker API boundary tests.
- [x] Clean database test suite uses an isolated replica-set fallback.
- [ ] Automatic browser reconnect drain is not repeatably proven.
- [ ] Browser restart durability lacks a passing dedicated test.

## Browser

- [x] Latest smoke evidence: 3 passed.
- [x] Two-browser realtime acceptance passed in the clean snapshot run.
- [ ] Clean snapshot offline → observation → replay acceptance failed.
- [ ] Responsive matrix is not run.
- [ ] Firefox/WebKit coverage is not run.

## Documentation

- [x] README, architecture, backend, frontend, offline/sync, replay, demo, and release docs.
- [x] Final test matrix.
- [x] Security checklist.
- [x] Limitations.
- [x] Demo video checklist.
- [x] Changelog.

## Submission

- [ ] Clean Git clone is release-complete.
- [ ] Final release candidate is committed/tagged by the repository owner.
- [ ] Demo video recorded.
- [ ] Screenshots captured without secrets.
- [ ] Submission description finalized.

## Verdict gate

The checklist is **NOT READY** until the frontend is present in a clean Git clone and the clean-browser offline/replay journey passes without relying on a flaky or manual-only recovery path.
