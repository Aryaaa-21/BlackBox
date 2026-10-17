# Release Checklist

## Code and tests

- [ ] Client typecheck passes
- [ ] Client lint passes
- [ ] Client build passes
- [ ] Server lint/typecheck passes
- [ ] Server build passes
- [ ] Backend regression tests pass
- [ ] Client regression tests pass
- [ ] Browser smoke suite passes repeatedly
- [ ] Full browser acceptance suite passes

## Security

- [ ] No secrets, tokens, cookies, or private keys are committed
- [ ] Production JWT secret is strong and configured externally
- [ ] Public registration cannot provision commanders
- [ ] Mission/task/replay/conflict/socket authorization is enforced
- [ ] Demo reset is isolated and protected

## Database and operations

- [ ] Production uses a replica set or mongos for protected writes
- [ ] Indexes are created/verified
- [ ] Clean database startup is documented
- [ ] Environment examples match actual variables

## Product and browser

- [ ] Core pages have loading/empty/error states
- [ ] Offline and sync states are understandable
- [ ] Responsive viewport checks pass
- [ ] No placeholder or stale architecture copy remains
- [ ] Production build can be browser-tested

## Documentation

- [ ] README
- [ ] Architecture
- [ ] Backend
- [ ] Frontend
- [ ] Offline/sync
- [ ] Replay
- [ ] Features
- [ ] Demo runbook/checklist
- [ ] Release checklist

## Demo

- [ ] Demo reset is deterministic
- [ ] Clean-environment dry run passes twice
- [ ] Offline → sync → conflict → replay is browser-verified
- [ ] Screenshots/video plan contains no secrets

## Repository

- [ ] `git diff --check` passes
- [ ] No `node_modules`, build output, logs, or browser artifacts are tracked
- [ ] Frontend, backend, tests, and docs are present
