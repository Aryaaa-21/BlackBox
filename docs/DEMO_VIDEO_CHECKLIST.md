# BlackBox Demo Video Checklist

## Before recording

- [ ] Use a clean browser profile.
- [ ] Use an isolated demo database.
- [ ] Backend health endpoint responds.
- [ ] Frontend production preview loads.
- [ ] Private demo password is configured outside the repository.
- [ ] Network controls are ready.
- [ ] No console errors are visible.
- [ ] Correct commander/operator accounts are ready.
- [ ] Demo mission has been reset through the protected control if needed.

## Recording sequence

- [ ] 30-second introduction: what BlackBox is and why unreliable connectivity matters.
- [ ] Commander login.
- [ ] Mission, team, task, activity, and connection state.
- [ ] Two-browser realtime update if the current run is passing.
- [ ] Network off.
- [ ] Offline task/observation mutation.
- [ ] Refresh while offline.
- [ ] Network on.
- [ ] Automatic sync first; use visible Sync now only if the release candidate explicitly documents that recovery path.
- [ ] Conflict trigger only through the protected demo control.
- [ ] Keep server/Keep local resolution.
- [ ] Mission Replay.
- [ ] Closing line: “The network can fail. The operation shouldn't.”

## After recording

- [ ] No passwords, tokens, API keys, cookies, or private data are visible.
- [ ] No unrelated browser tabs are visible.
- [ ] No terminal secrets are visible.
- [ ] No debug overlays or temporary controls are visible.
- [ ] The recording result matches the final test matrix.
- [ ] Do not publish a recording if the browser acceptance journey failed.
