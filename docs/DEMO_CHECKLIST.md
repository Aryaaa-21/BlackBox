# Demo Checklist

## Environment

- [ ] MongoDB replica set or approved development fallback is available
- [ ] Backend is running and `GET /api/v1/health` succeeds
- [ ] Frontend is running at the configured client URL
- [ ] Correct test/demo environment is selected
- [ ] Demo mode is enabled only for the isolated demo environment
- [ ] Browser storage is clean or reset intentionally

## Authentication and mission

- [ ] Commander can sign in through the UI
- [ ] Field operator account is available through the safe demo fixture
- [ ] Protected route redirects unauthenticated visitors
- [ ] Active mission exists
- [ ] Team and fixture tasks are visible

## Online

- [ ] Connectivity says Online
- [ ] Socket status is connected
- [ ] A task operation produces visible authoritative state
- [ ] Second-client realtime behavior has been verified for the current release

## Offline

- [ ] Browser network is disabled using the approved test/demo procedure
- [ ] Offline indicator and local-work explanation are visible
- [ ] Supported task mutation is saved locally
- [ ] Observation is saved locally
- [ ] Refresh behavior has been verified for the current release

## Sync

- [ ] Network is restored
- [ ] Syncing state appears
- [ ] Queue drains or failure is clearly actionable
- [ ] Authoritative server state is visible
- [ ] Corresponding MissionEvents exist

## Conflict and replay

- [ ] Conflict is created through the guarded procedure
- [ ] Local versus server state is understandable
- [ ] Explicit resolution succeeds
- [ ] Replay opens
- [ ] Historical events and state are visible

## Final

- [ ] No unexpected browser console errors
- [ ] No secrets or tokens are visible
- [ ] Closing line is ready: “The network can fail. The operation shouldn't.”
