# Mission Replay

Mission Replay is an event-based historical view. It is not a current-database snapshot rendered backward.

## Source

Replay consumes immutable MissionEvents ordered by ascending `(createdAt, _id)`. New pages use an HMAC-signed cursor and first-page high-water tuple, preventing later appends from appearing in the middle of a drained history.

## Reducer

The client starts from an empty `ReplayState`. `replayReducer` applies known mission, task, member, observation, network, sync, conflict, and resolution events. Frame zero is before the first event. Unknown or malformed events remain visible with warnings and do not stop later safe events.

Current mission metadata may be returned for display, but current tasks/users are not used to invent historical fields. Missing actor snapshots remain unavailable/unknown.

## UI

The Replay page provides a timeline, selected event, state-at-this-moment panel, play/pause, previous/next, reset, speed, and seek over loaded frames. Pending local events are excluded from authoritative history and cached/offline results disclose when history is incomplete.

## API

```text
GET /api/v1/missions/:missionId/replay
  ?from=<inclusive ISO date>
  &to=<inclusive ISO date>
  &eventType=<event type>
  &limit=<1..5000>
  &cursor=<signed cursor>
```

Each request rechecks replay authorization. Invalid or incompatible cursors return `400 INVALID_REPLAY_CURSOR`.

## Conflict history

`SYNC_CONFLICT` explains why a mutation stopped. `CONFLICT_RESOLVED` records the explicit resolution and authoritative resolved state. Replay can therefore show the divergence and the decision, not only the final task value.

## Offline limitation

Offline cached replay is authoritative only for the cached event set. The client marks incomplete history instead of claiming that an offline cache is a complete mission record.
