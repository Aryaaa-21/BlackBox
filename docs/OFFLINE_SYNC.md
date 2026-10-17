# Offline and Synchronization

## Detection

BlackBox distinguishes browser network state from API reachability. The UI can show Online, Offline, Reconnecting, or server unavailable without treating every server error as offline success.

## Local persistence

Dexie stores account-scoped missions, tasks, members, events, sessions, conflicts, device identity, local/server ID mappings, and mutations in the `blackbox-operational-cache` database.

Supported user mutations are queue-first. The optimistic entity projection and mutation row are written in one IndexedDB transaction.

## Queue identity

Each mutation retains:

- `mutationId`;
- `idempotencyKey`;
- device ID;
- original local entity ID;
- client timestamp;
- immutable payload/wire body; and
- optional `baseVersion`/legacy timestamp.

Retries reuse those identities. Dependents wait for acknowledged predecessors and durable local/server mappings.

## Reconnect

When API reachability returns, the client selects ready mutations, respects dependencies, sends bounded batches to `POST /api/v1/sync`, and reconciles each result. Network failures preserve the same mutation for retry. Permanent errors and conflicts remain visible.

## Server boundary

The server validates authorization, operation shape, idempotency, and version before committing the entity, MissionEvent, and ProcessedMutation receipt together in a MongoDB transaction. Socket notifications run only after commit.

## Conflict

A stale `baseVersion` creates a durable conflict and `SYNC_CONFLICT` event. Resolution requires an explicit user choice. `KEEP_SERVER`, `KEEP_LOCAL`, and commander-only merge behavior are version-aware and idempotent. A rejected local value is never silently applied.

## Limitations

Automated client/server tests are strong, but Phase 4 did not complete a stable real-browser offline refresh/restart/two-client journey. See `docs/PHASE4_REPORT.md`.
