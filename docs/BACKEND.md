# BlackBox — Backend Development Plan (Serverpod 4)

> **Platform:** Serverpod 4 + Dart  
> **Database:** PostgreSQL (server) + SQLite via Serverpod client-side DB (device)  
> **Authentication:** Serverpod built-in auth module  
> **Scheduling:** Serverpod Future Calls  
> **Real-Time:** Serverpod Streaming (managed WebSocket)

---

## Phase 0 — Environment & Project Bootstrap

**Goal:** Serverpod project running locally with database verified.

### Tasks
- [ ] Install Flutter `3.44.4+` and Dart `3.12.2+`
- [ ] Install Serverpod CLI: `dart install serverpod_cli`
- [ ] Verify: `serverpod version`
- [ ] Create project: `serverpod quickstart blackbox`
- [ ] Run dev stack: `serverpod start`
- [ ] Verify embedded PostgreSQL is accessible
- [ ] Verify Serverpod Studio opens (`localhost:8080`)
- [ ] Confirm generated Flutter client compiles
- [ ] Pin Serverpod version in `pubspec.yaml` — **do not upgrade mid-build**

### Definition of Done
> `serverpod start` runs without errors. Serverpod Studio accessible. Default endpoint responds.

---

## Phase 1 — Data Models & Database Schema

**Goal:** Define all core YAML models, generate code, and run migrations.

### Models to Define

#### `User` (server)
```yaml
class: User
table: users
fields:
  name:     String
  email:    String
  role:     String    # COMMANDER | FIELD_OPERATOR
  createdAt: DateTime
```

#### `Mission` (server + sync candidate)
```yaml
class: Mission
table: missions
fields:
  title:       String
  description: String?
  location:    String?
  severity:    String   # LOW | MEDIUM | HIGH | CRITICAL
  status:      String   # ACTIVE | COMPLETED | CLOSED
  createdBy:   int      # userId
  createdAt:   DateTime
  startedAt:   DateTime?
  completedAt: DateTime?
```

#### `MissionMember` (server)
```yaml
class: MissionMember
table: mission_members
fields:
  missionId: int
  userId:    int
  role:      String   # COMMANDER | FIELD_OPERATOR
  status:    String   # ACTIVE | CHECKED_OUT
  joinedAt:  DateTime
```

#### `Task` (server + sync candidate)
```yaml
class: Task
table: tasks
fields:
  missionId:   int
  title:       String
  description: String?
  priority:    String   # LOW | MEDIUM | HIGH | CRITICAL
  status:      String   # PENDING | ACTIVE | BLOCKED | COMPLETED
  assignedTo:  int?     # userId
  createdAt:   DateTime
  dueAt:       DateTime?
  completedAt: DateTime?
```

#### `MissionEvent` (server + sync candidate)
```yaml
class: MissionEvent
table: mission_events
fields:
  missionId:  int
  actorId:    int        # userId
  eventType:  String     # TASK_COMPLETED | OBSERVATION_RECORDED | ...
  payload:    String?    # JSON string
  createdAt:  DateTime
  deviceId:   String
  syncStatus: String     # PENDING | SYNCED | CONFLICT | FAILED
```

#### `DeviceState` (server)
```yaml
class: DeviceState
table: device_states
fields:
  deviceId:       String
  userId:         int
  lastSyncAt:     DateTime?
  connectionState: String
  pendingChanges: int
```

#### `Alert` (server)
```yaml
class: Alert
table: alerts
fields:
  missionId:  int
  type:       String
  message:    String
  severity:   String
  createdAt:  DateTime
  resolvedAt: DateTime?
```

### Tasks
- [ ] Create all model YAML files in `blackbox_server/lib/src/models/`
- [ ] Run `serverpod generate`
- [ ] Create and apply database migration
- [ ] Verify tables created in PostgreSQL via Serverpod Studio
- [ ] Define client-side local models (subset) for offline caching

### Definition of Done
> All tables exist in the database. `serverpod generate` produces clean code with no errors.

---

## Phase 2 — Authentication

**Goal:** Secure user registration, login, session management, and role resolution.

### Serverpod Auth Setup
- [ ] Enable `serverpod_auth_server` module in server
- [ ] Enable `serverpod_auth_email_flutter` on client side
- [ ] Configure `AuthConfig` in server setup

### Custom Extensions
- [ ] Add `role` field to user profile post-registration
- [ ] Build `UserService`:
  - `getUserProfile(session)` → returns User with role
  - `updateRole(session, role)` → sets Commander or Field Operator

### Endpoint: `AuthEndpoint` (thin wrapper)
```dart
Future<String?> register(Session session, String name, String email, String password, String role)
Future<AuthenticationResponse> login(Session session, String email, String password)
Future<void> logout(Session session)
Future<UserProfile?> getProfile(Session session)
```

### Security Rules (enforced server-side)
- [ ] Every protected endpoint calls `session.authenticated` → reject if null
- [ ] Role-based checks inline per endpoint:
  ```dart
  if (role != 'COMMANDER') throw UnauthorizedException();
  ```
- [ ] Mission membership validated before allowing task mutations

### Definition of Done
> User can register, log in, and receive a role-scoped session. Unauthorized requests rejected with 401.

---

## Phase 3 — Mission & Team Endpoints

**Goal:** Commander can create missions, manage team members, and update mission state.

### Endpoint: `MissionEndpoint`

```dart
// Create a new mission (Commander only)
Future<Mission> createMission(Session session, String title, String description, String location, String severity)

// Get single mission
Future<Mission?> getMission(Session session, int missionId)

// Get all missions for the current user
Future<List<Mission>> getMissions(Session session)

// Update mission status
Future<Mission> updateMission(Session session, int missionId, String status)

// Close a mission (Commander only)
Future<void> closeMission(Session session, int missionId)

// Add member to mission
Future<MissionMember> addMember(Session session, int missionId, int userId, String role)

// Get mission members
Future<List<MissionMember>> getMembers(Session session, int missionId)
```

### Tasks
- [ ] Implement all `MissionEndpoint` methods
- [ ] Authorization: validate Commander role before `createMission`, `closeMission`, `addMember`
- [ ] `getMissions` returns only missions the current user is a member of
- [ ] `getMission` validates membership
- [ ] Creating a mission auto-adds the creator as Commander member
- [ ] Mission creation fires `MISSION_CREATED` event
- [ ] Member addition fires `TEAM_ASSIGNED` event
- [ ] Write unit tests for each method

### Definition of Done
> Commander creates mission. System records event. Members list populated. Authorization prevents unauthorized access.

---

## Phase 4 — Task Endpoints

**Goal:** Full task lifecycle from creation to completion.

### Endpoint: `TaskEndpoint`

```dart
// Create task (Commander only)
Future<Task> createTask(Session session, int missionId, String title, String description, String priority, int? assignedTo, DateTime? dueAt)

// Assign or reassign task (Commander only)
Future<Task> assignTask(Session session, int taskId, int userId)

// Update task status (Commander or assigned Field Operator)
Future<Task> updateTaskStatus(Session session, int taskId, String newStatus)

// Get all tasks for a mission
Future<List<Task>> getTasks(Session session, int missionId)

// Get single task
Future<Task?> getTask(Session session, int taskId)
```

### State Machine (enforced server-side)
```
PENDING → ACTIVE
ACTIVE  → BLOCKED | COMPLETED
BLOCKED → ACTIVE  | COMPLETED
```
- Any other transition → rejected with error

### Tasks
- [ ] Implement all `TaskEndpoint` methods
- [ ] Enforce state machine transitions server-side
- [ ] Authorization: Field operators can only update **their** assigned tasks
- [ ] Every status change fires the corresponding `MissionEvent`
- [ ] Task completion fires `TASK_COMPLETED` event with payload
- [ ] Write unit tests for state machine

### Definition of Done
> Tasks follow the state machine. Field operators cannot change others' tasks. Every change produces an event.

---

## Phase 5 — Event System

**Goal:** Persistent, immutable event log for every important operational action.

### Endpoint: `EventEndpoint`

```dart
// Create a manual event/observation (Commander or Field Operator)
Future<MissionEvent> createEvent(Session session, int missionId, String eventType, String? payload, String deviceId)

// Get all events for a mission (ordered by createdAt ASC)
Future<List<MissionEvent>> getMissionEvents(Session session, int missionId)
```

### `EventService` (internal helper used by all endpoints)
```dart
Future<MissionEvent> record(Session session, int missionId, int actorId, String eventType, String? payload, String deviceId)
```
All other endpoints (Mission, Task) call `EventService.record()` internally.

### Event Types Handled
| Event | Triggered By |
|---|---|
| `MISSION_CREATED` | `createMission` |
| `TEAM_ASSIGNED` | `addMember` |
| `TASK_CREATED` | `createTask` |
| `TASK_STARTED` | `updateTaskStatus(ACTIVE)` |
| `TASK_COMPLETED` | `updateTaskStatus(COMPLETED)` |
| `TASK_BLOCKED` | `updateTaskStatus(BLOCKED)` |
| `OBSERVATION_RECORDED` | `createEvent` |
| `STATUS_CHANGED` | `updateMission` |
| `MEMBER_CHECKED_IN` | `addMember` / manual |
| `NETWORK_LOST` | Client-reported event |
| `NETWORK_RESTORED` | Client-reported event |
| `SYNC_STARTED` | `syncPendingEvents` |
| `SYNC_COMPLETED` | `syncPendingEvents` success |

### Tasks
- [ ] Implement `EventService.record()`
- [ ] Wire all other endpoints to call `EventService.record()`
- [ ] Events are insert-only — never update or delete
- [ ] Validate `missionId` membership before allowing event creation
- [ ] Index `mission_events` table on `(missionId, createdAt)` for efficient queries

### Definition of Done
> Every important action has a corresponding event record. Events are append-only. Mission event log is correct and ordered.

---

## Phase 6 — Real-Time Streaming

**Goal:** Online clients receive live mission updates without polling.

### Endpoint: `MissionStreamEndpoint` (Streaming endpoint)

```dart
// Stream mission updates to connected clients
Stream<MissionEvent> missionUpdates(Session session, int missionId)
```

### Server-Side Push
After any `EventService.record()` call, broadcast the new event to all subscribers of that `missionId`:

```dart
session.messages.postMessage(
  'mission-$missionId',
  MissionEventMessage(event: newEvent),
);
```

### Tasks
- [ ] Create `MissionStreamEndpoint` as a Serverpod streaming endpoint
- [ ] Use Serverpod message passing to broadcast events to subscribers
- [ ] Validate that the subscriber is a member of the mission before allowing stream
- [ ] Handle client disconnection gracefully (Serverpod manages this)
- [ ] Handle stream resume after connection drop
- [ ] Test: two sessions open → one fires event → other receives within 1 second

### Definition of Done
> Two connected clients. One acts → other receives the `MissionEvent` via stream without polling.

---

## Phase 7 — Offline Synchronization Engine

**Goal:** Accept pending events from offline clients, validate, persist, and resolve conflicts.

> ⚠️ **Highest-risk phase.** Keep synchronized model set small: Mission, Task, MissionEvent only.

### Endpoint: `SyncEndpoint`

```dart
// Accept a batch of pending events from a device
Future<SyncResult> syncPendingEvents(Session session, List<MissionEvent> pendingEvents, String deviceId)

// Get current sync state for a device
Future<DeviceState> getSyncState(Session session, String deviceId)
```

### `SyncResult` model
```dart
class SyncResult {
  List<String> syncedEventIds;   // successfully persisted
  List<String> conflictEventIds; // conflicts detected
  List<String> failedEventIds;   // validation failures
  DateTime serverTime;
}
```

### `SyncService` (internal)
```dart
Future<SyncResult> processBatch(Session session, List<MissionEvent> events, String deviceId)
```

Processing logic per event:
1. Check if `eventId` already exists → if yes, skip (idempotent)
2. Validate `missionId` and `actorId` membership
3. Validate state transition is still valid (e.g. task not already COMPLETED by someone else)
4. If valid → persist event, update derived state (Task.status, Mission.status)
5. If conflict → mark as `CONFLICT`, do not discard, store with conflict flag
6. If invalid → mark as `FAILED`
7. Broadcast accepted events to stream subscribers

### Conflict Strategy
- Events are **never silently discarded**
- Conflicts are stored with `syncStatus = CONFLICT`
- Server state wins for task status (last-write-wins per server timestamp)
- Conflict is visible to the Commander on dashboard

### Tasks
- [ ] Implement `SyncService.processBatch()`
- [ ] Implement idempotency check (unique `eventId` index)
- [ ] Implement conflict detection (compare incoming state vs current server state)
- [ ] Implement `CONFLICT` flagging and storage
- [ ] Implement `DeviceState` update after sync (`lastSyncAt`, `pendingChanges = 0`)
- [ ] After sync, broadcast new events to stream subscribers
- [ ] Fire `SYNC_STARTED` and `SYNC_COMPLETED` (or `SYNC_FAILED`) events
- [ ] Handle empty batch gracefully
- [ ] Write integration test: offline events → sync → all events persisted correctly
- [ ] Write idempotency test: same event submitted twice → stored once

### Definition of Done
> Offline events submitted, validated, and persisted. Conflicts flagged. Duplicate events rejected. Stream subscribers notified.

---

## Phase 8 — Replay Endpoint

**Goal:** Return the complete ordered event history for a mission, enabling frontend timeline reconstruction.

### Endpoint: `ReplayEndpoint`

```dart
// Get full event history for replay (ordered chronologically)
Future<List<MissionEvent>> getReplay(Session session, int missionId)

// Get events in a time window (optional, for large missions)
Future<List<MissionEvent>> getReplayWindow(Session session, int missionId, DateTime from, DateTime to)
```

### Tasks
- [ ] Implement `getReplay()` — returns all events ordered by `createdAt ASC`
- [ ] Include both online and offline events (syncStatus: SYNCED and CONFLICT)
- [ ] Include synthetic events: `NETWORK_LOST`, `NETWORK_RESTORED`, `SYNC_COMPLETED`
- [ ] Validate mission membership before returning data
- [ ] Ensure index on `(missionId, createdAt)` for performance

### Definition of Done
> Frontend receives complete event history. All event types present. Chronological order correct.

---

## Phase 9 — Scheduled Escalation (Future Calls)

**Goal:** Demonstrate Serverpod Future Calls with one real escalation workflow.

### `EscalationCall` (Future Call)

```dart
class EscalationCall extends FutureCall<EscalationData> {
  @override
  Future<void> invoke(Session session, EscalationData? data) async {
    // Check if expected confirmation event was received
    // If not: create ESCALATION_TRIGGERED alert
    final confirmed = await _checkConfirmation(session, data!.taskId);
    if (!confirmed) {
      await AlertService.createAlert(
        session,
        missionId: data.missionId,
        type: 'ESCALATION',
        message: 'Task #${data.taskId} confirmation not received within deadline.',
        severity: 'HIGH',
      );
      await EventService.record(
        session,
        missionId: data.missionId,
        actorId: 0, // system actor
        eventType: 'ESCALATION_TRIGGERED',
        payload: json.encode({'taskId': data.taskId}),
        deviceId: 'server',
      );
    }
  }
}
```

### Endpoint: `AlertEndpoint`

```dart
// Schedule an escalation deadline for a task
Future<void> scheduleEscalation(Session session, int missionId, int taskId, Duration deadline)

// Get active alerts for a mission
Future<List<Alert>> getAlerts(Session session, int missionId)

// Resolve an alert (Commander only)
Future<Alert> resolveAlert(Session session, int alertId)
```

### Tasks
- [ ] Register `EscalationCall` in server setup
- [ ] Implement `AlertEndpoint.scheduleEscalation()` — calls `Serverpod.futureCallWithDelay()`
- [ ] Implement `AlertService.createAlert()`
- [ ] Implement `getAlerts()` and `resolveAlert()`
- [ ] Test: schedule 30-second escalation, wait → alert appears in database
- [ ] Alert creation streams the alert event to connected clients

### Definition of Done
> Commander schedules escalation. If not confirmed within deadline, server creates `ESCALATION_TRIGGERED` event and alert automatically.

---

## Endpoint Summary

| Endpoint | Methods | Phase |
|---|---|---|
| `AuthEndpoint` | `register`, `login`, `logout`, `getProfile` | 2 |
| `MissionEndpoint` | `createMission`, `getMission`, `getMissions`, `updateMission`, `closeMission`, `addMember`, `getMembers` | 3 |
| `TaskEndpoint` | `createTask`, `assignTask`, `updateTaskStatus`, `getTasks`, `getTask` | 4 |
| `EventEndpoint` | `createEvent`, `getMissionEvents` | 5 |
| `MissionStreamEndpoint` | `missionUpdates` (streaming) | 6 |
| `SyncEndpoint` | `syncPendingEvents`, `getSyncState` | 7 |
| `ReplayEndpoint` | `getReplay`, `getReplayWindow` | 8 |
| `AlertEndpoint` | `scheduleEscalation`, `getAlerts`, `resolveAlert` | 9 |

---

## Services (Internal)

| Service | Responsibility |
|---|---|
| `EventService` | `record()` — append-only event creation, used by all endpoints |
| `SyncService` | `processBatch()` — offline event validation, conflict detection |
| `MissionService` | Business logic for mission state |
| `AlertService` | Alert creation and management |

---

## Database Indexes (Performance)

```sql
CREATE INDEX idx_mission_events_mission_created ON mission_events(mission_id, created_at ASC);
CREATE INDEX idx_tasks_mission ON tasks(mission_id);
CREATE INDEX idx_mission_members_mission ON mission_members(mission_id);
CREATE UNIQUE INDEX idx_mission_events_event_id ON mission_events(event_id); -- idempotency
```

---

## Security Checklist

- [ ] All endpoints check `session.authenticated`
- [ ] Role checks are server-side only (never trust client role claims)
- [ ] Mission membership validated on every data access
- [ ] Task ownership validated before allowing mutations
- [ ] State transition validation prevents illegal jumps
- [ ] Idempotency index prevents duplicate event processing
- [ ] No secrets or credentials in source code
- [ ] HTTPS enforced in production config

---

## Testing Plan

| Test | Phase |
|---|---|
| Auth: register, login, invalid credentials, unauthorized action | 2 |
| Mission CRUD: create, get, update, close | 3 |
| Task state machine: all valid and invalid transitions | 4 |
| Event creation and event log ordering | 5 |
| Stream: event broadcast to connected subscriber | 6 |
| Sync: offline events → all accepted | 7 |
| Sync: idempotency — same event submitted twice | 7 |
| Sync: conflict detection — two incompatible changes | 7 |
| Replay: complete event list returned in order | 8 |
| Future Call: escalation fires after deadline | 9 |
