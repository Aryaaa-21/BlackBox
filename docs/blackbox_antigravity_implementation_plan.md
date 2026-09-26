# BlackBox — Complete Antigravity Implementation Plan

## 1. Purpose

This document converts the existing BlackBox frontend plan into a complete implementation roadmap covering:

- Flutter frontend
- Serverpod backend
- PostgreSQL database
- Authentication
- Typed Serverpod endpoints
- Real-time streaming
- Offline-first local operation
- Synchronization
- Idempotency
- Conflict handling
- Mission Replay
- Future Calls
- Demo mode
- Testing
- Security
- Deployment
- Antigravity execution rules

The core product remains:

> **The network can fail. The operation shouldn't.**

---

## 2. Audit: What Should Change

The existing frontend plan is already strong on UI and interaction flow. It covers the dashboard, mission operations, real-time updates, offline mode, sync states, replay, demo mode, and final polish.

The major missing layer is the complete backend contract.

### Keep

- Flutter + Dart
- Serverpod
- dark operations-console UI
- Commander / Field Operator roles
- mission dashboard
- mission operations
- real-time updates
- offline state
- sync state indicators
- Mission Replay
- demo mode
- responsive UI

### Change / Clarify

#### 1. Offline mode should be state-driven

Do not navigate users away from their current mission every time connectivity disappears.

Instead:

```text
CURRENT SCREEN
      +
OFFLINE STATE
      +
PERSISTENT OFFLINE INDICATOR
```

The user should continue operating inside the mission.

#### 2. Connectivity is not the same as server availability

`connectivity_plus` only provides a network hint.

Track:

```text
networkAvailable
serverReachable
```

A device can have Wi-Fi while the Serverpod server is unreachable.

#### 3. Serverpod must be the actual backend

Do not add:

- Express
- MongoDB
- Firebase
- Socket.IO
- custom WebSockets
- custom authentication
- another ORM

The point of the project is to demonstrate Serverpod meaningfully.

#### 4. Server authorization must exist

Never rely only on Flutter to decide whether a user can perform an operation.

Every protected Serverpod endpoint must verify:

```text
authenticated user
→ role
→ mission membership
→ operation permission
```

#### 5. Offline changes need idempotency

Every offline mutation needs a stable unique identifier.

Use:

```text
idempotencyKey
```

This prevents duplicate events when a synchronization retry occurs.

#### 6. Conflict behavior must be explicit

Do not silently overwrite state.

For MVP:

```text
local operation
      ↓
server validation
      ↓
accepted OR conflict
```

A conflict should remain visible.

#### 7. Serverpod version must be verified before implementation

Antigravity must inspect the actual installed Serverpod version and use the APIs available in that version.

Never invent framework methods.

---

# 3. Final Architecture

```text
                         BLACKBOX
                            │
                     FLUTTER CLIENT
                            │
          ┌─────────────────┴─────────────────┐
          │                                   │
     LOCAL DATA                         SERVERPOD CLIENT
          │                                   │
          │                       ┌───────────┴───────────┐
          │                       │                       │
          │                   ENDPOINTS                STREAMS
          │                       │                       │
          │                  Auth / Missions             │
          │                  Team / Tasks                │
          │                  Events / Sync               │
          │                  Replay                      │
          │                                              │
          └────────────── SYNC ──────────────────────────┘
                                      │
                                  SERVERPOD
                                      │
                                  POSTGRESQL
```

---

# 4. Technology Stack

## Frontend

- Flutter
- Dart
- Riverpod
- go_router
- connectivity_plus
- google_fonts
- intl

## Backend

- Serverpod
- Serverpod generated client
- Serverpod authentication
- Serverpod streaming
- Serverpod Future Calls where useful

## Database

- PostgreSQL
- Serverpod migrations

## Local data

Use the supported Serverpod client-side/local database capabilities available in the installed version.

Do not create a second synchronization framework.

---

# 5. Project Structure

Recommended application structure:

```text
lib/
├── main.dart
├── app.dart
│
├── core/
│   ├── theme/
│   ├── routing/
│   ├── constants/
│   ├── errors/
│   └── utils/
│
├── auth/
│   ├── screens/
│   ├── providers/
│   └── services/
│
├── dashboard/
│   ├── screens/
│   ├── widgets/
│   └── providers/
│
├── mission/
│   ├── screens/
│   ├── widgets/
│   ├── providers/
│   └── services/
│
├── offline/
│   ├── connectivity_service.dart
│   ├── sync_service.dart
│   └── providers/
│
├── replay/
│   ├── screens/
│   ├── widgets/
│   └── providers/
│
└── demo/
    ├── demo_controller.dart
    └── demo_data.dart
```

Keep Serverpod generated code in its generated location.

Never manually duplicate generated models or client classes.

---

# 6. Main Routes

```text
/login
/register
/dashboard
/mission/:id
/mission/:id/replay
```

Offline state is global application state.

Do not make offline mode a separate mandatory route.

---

# 7. Roles

Use two primary roles.

## Commander

Can:

- create missions
- start missions
- complete missions
- manage members
- create tasks
- assign tasks
- monitor mission activity
- view replay

## Field Operator

Can:

- view assigned missions
- view assigned tasks
- update assigned task status
- create observations
- work with cached data offline
- synchronize pending work

Authorization must be enforced server-side.

---

# 8. Database Models

## UserProfile

Authentication identity should use Serverpod authentication.

Application profile:

```text
UserProfile
- id
- authUserId
- displayName
- role
- createdAt
```

---

## Mission

```text
Mission
- id
- title
- description
- location
- severity
- status
- createdBy
- createdAt
- startedAt
- completedAt
```

### MissionStatus

```text
DRAFT
ACTIVE
COMPLETED
CANCELLED
```

### Severity

```text
LOW
MEDIUM
HIGH
CRITICAL
```

---

## MissionMember

```text
MissionMember
- id
- missionId
- userId
- role
- status
- joinedAt
```

---

## Task

```text
Task
- id
- missionId
- title
- description
- priority
- status
- assignedTo
- createdBy
- createdAt
- dueAt
- completedAt
```

### TaskStatus

```text
PENDING
ACTIVE
BLOCKED
COMPLETED
```

### TaskPriority

```text
LOW
MEDIUM
HIGH
CRITICAL
```

---

## MissionEvent

```text
MissionEvent
- id
- missionId
- actorId
- eventType
- payload
- createdAt
- clientCreatedAt
- deviceId
- idempotencyKey
- source
```

### Source

```text
SERVER
OFFLINE_CLIENT
```

Important operations should generate events.

Mission Replay reads from this history.

---

# 9. Event Types

Use a fixed enum.

```text
MISSION_CREATED
MISSION_STARTED
MISSION_COMPLETED

MEMBER_ASSIGNED
MEMBER_CHECKED_IN

TASK_CREATED
TASK_ASSIGNED
TASK_STARTED
TASK_COMPLETED
TASK_BLOCKED

OBSERVATION_RECORDED

NETWORK_LOST
NETWORK_RESTORED

SYNC_STARTED
SYNC_COMPLETED
SYNC_CONFLICT
```

Do not accept arbitrary event type strings from the client.

---

# 10. Task State Machine

The backend must validate state transitions.

Allowed:

```text
PENDING → ACTIVE
PENDING → BLOCKED

ACTIVE → COMPLETED
ACTIVE → BLOCKED

BLOCKED → ACTIVE
```

Commander can have administrative override capability.

Field Operator can only modify tasks assigned to that operator.

Do not trust frontend state validation.

---

# 11. Authentication

Use Serverpod authentication.

Implement:

```text
register
login
logout
getCurrentUser
```

Never store passwords manually.

After login:

```text
Auth
 ↓
UserProfile
 ↓
Role
 ↓
Dashboard
```

Protected endpoints must reject unauthenticated requests.

---

# 12. Authorization

Every protected operation follows:

```text
AUTHENTICATED?
      ↓
ROLE VALID?
      ↓
MISSION MEMBER?
      ↓
ACTION ALLOWED?
      ↓
EXECUTE
```

Example:

```text
Field Operator A
        ↓
Member of Mission 42?
        ↓
YES
        ↓
Task 17 assigned to A?
        ↓
YES
        ↓
Allow update
```

Otherwise return a controlled authorization error.

---

# 13. Mission Endpoint

Create typed Serverpod endpoint methods.

```text
createMission(CreateMissionRequest)
getMission(int missionId)
getMyMissions()
updateMission(UpdateMissionRequest)
startMission(int missionId)
completeMission(int missionId)
```

## CreateMissionRequest

```text
title
description
location
severity
```

## UpdateMissionRequest

```text
missionId
title?
description?
location?
severity?
```

Server validates:

- authentication
- role
- mission ownership
- valid status transitions

---

# 14. Team Endpoint

```text
addMember(AddMemberRequest)
removeMember(RemoveMemberRequest)
getMembers(int missionId)
updateMemberStatus(UpdateMemberStatusRequest)
```

Only authorized Commanders can manage membership.

---

# 15. Task Endpoint

```text
createTask(CreateTaskRequest)
getTasks(int missionId)
getTask(int taskId)
assignTask(AssignTaskRequest)
updateTaskStatus(UpdateTaskStatusRequest)
```

## CreateTaskRequest

```text
missionId
title
description
priority
assignedTo
dueAt
```

## UpdateTaskStatusRequest

```text
taskId
newStatus
idempotencyKey
clientCreatedAt
```

The server must:

1. authenticate;
2. authorize;
3. validate task transition;
4. check idempotency;
5. update task;
6. create MissionEvent;
7. publish stream update.

---

# 16. Event Endpoint

```text
createEvent(CreateEventRequest)
getMissionEvents(int missionId)
```

## CreateEventRequest

```text
missionId
eventType
payload
clientCreatedAt
deviceId
idempotencyKey
```

Processing:

```text
Authenticate
   ↓
Authorize
   ↓
Validate event
   ↓
Check idempotency
   ↓
Persist event
   ↓
Update derived state
   ↓
Publish stream
```

---

# 17. Synchronization Endpoint

Conceptual method:

```text
syncPendingEvents(SyncPendingEventsRequest)
```

Request:

```text
deviceId
events[]
```

Each event:

```text
localEventId
missionId
eventType
payload
clientCreatedAt
deviceId
idempotencyKey
```

Response:

```text
SyncResult
- synced[]
- conflicts[]
- failed[]
- serverTimestamp
```

Important:

If the installed Serverpod version already provides the required synchronization primitives, use them rather than building an independent sync engine.

---

# 18. Idempotency

Every offline mutation must have:

```text
idempotencyKey
```

Server logic:

```text
if key already exists:
    return existing result

else:
    process event
```

This prevents duplicate events caused by:

- retries
- reconnects
- app restarts
- repeated button taps

---

# 19. Offline Data Strategy

The application should support cached:

```text
Mission
Task
MissionEvent
```

When online:

```text
Server
 ↓
Local cache
 ↓
UI
```

When offline:

```text
Local cache
 ↓
UI
```

For mutations:

```text
UI
 ↓
Local state
 ↓
Pending event
```

When connection returns:

```text
Pending event
 ↓
Sync
 ↓
Server validation
 ↓
Accepted / Conflict / Failed
 ↓
Local state updated
```

---

# 20. Connectivity

Track two separate values:

```text
networkAvailable
serverReachable
```

Expose:

```text
ONLINE
OFFLINE
RECONNECTING
SYNCING
SYNCED
SYNC_ERROR
```

Use `connectivity_plus` as a network hint.

Perform a lightweight Serverpod reachability check before claiming that synchronization is possible.

---

# 21. Real-Time Streaming

Use Serverpod streaming.

Do not implement custom WebSockets.

Scope updates by:

```text
missionId
authenticated user
```

Flow:

```text
Task update
   ↓
Serverpod endpoint
   ↓
Database
   ↓
Mission event
   ↓
Serverpod stream
   ↓
Connected clients
```

Required demo:

```text
Field Unit A completes task
          ↓
Commander sees update
          ↓
No refresh
```

---

# 22. Conflict Handling

Keep this simple.

Example:

```text
Server:
COMPLETED

Local pending action:
BLOCKED
```

Result:

```text
CONFLICT
```

Display:

```text
SYNC CONFLICT

Task:
Check Zone C

Remote:
COMPLETED

Local:
BLOCKED

VIEW EVENT
```

Do not implement CRDTs.

Do not silently overwrite.

Do not delete the losing event.

Keep the event history immutable.

---

# 23. Mission Replay

Route:

```text
/mission/:id/replay
```

Backend:

```text
getReplay(int missionId)
```

Return chronological events.

Display:

```text
timestamp
actor
event
source
sync state
```

Controls:

```text
Play
Pause
1x
2x
5x
Jump to Event
```

Offline events should have a clear visual distinction.

Sync events should also be visually distinguishable.

Replay must use actual stored mission events.

---

# 24. Future Call

Optional after the core system is stable.

Example:

```text
Critical task created
       ↓
Future Call scheduled
       ↓
5 minutes
       ↓
Reload task
       ↓
Still pending?
    /         YES       NO
   ↓         ↓
Escalate   Do nothing
```

The Future Call must always re-check current state.

---

# 25. Demo Mode

Developer/demo-only functionality:

```text
COMMANDER
FIELD UNIT A
FIELD UNIT B
```

Network controls:

```text
ONLINE
OFFLINE
RECONNECT
```

Utility controls:

```text
CREATE SAMPLE MISSION
RESET DEMO
```

The demo must still use the real Serverpod backend.

Only identity switching and network simulation are controlled by demo mode.

---

# 26. Demo Mission

Use:

```text
Campus Building B Emergency Drill
```

Team:

```text
Commander
Field Unit A
Field Unit B
Medical Unit
```

Tasks:

```text
Evacuate Building B
Check Zone C
Secure Entrance
Medical Assessment
```

Demo sequence:

```text
MISSION_CREATED
MEMBER_ASSIGNED
TASK_CREATED
TASK_ASSIGNED
TASK_STARTED
NETWORK_LOST
TASK_COMPLETED
OBSERVATION_RECORDED
NETWORK_RESTORED
SYNC_COMPLETED
MISSION_COMPLETED
```

---

# 27. Frontend Screens

## Login

Show:

- product name
- email
- password
- login
- register

## Dashboard

Show:

- active mission
- mission count
- active tasks
- team count
- network state
- sync state
- recent event stream

## Mission Operations

Show:

- mission header
- severity
- status
- team
- task list
- operational event feed
- network indicator
- sync indicator

## Offline State

Do not replace the mission page.

Show:

```text
OFFLINE MODE
LOCAL OPERATIONS ACTIVE
LAST SYNC: ...
PENDING CHANGES: 3
```

## Replay

Show:

- mission summary
- timeline
- event cards
- playback controls
- offline/sync markers

---

# 28. Design System

Recommended direction:

```text
Background: #0A0C0F
Dark elevated surfaces
Single primary accent
Green = healthy/synced
Amber = warning/pending
Red = critical/conflict
Blue = active/info
```

Typography:

```text
Inter / Space Grotesk
IBM Plex Mono for IDs, timestamps and technical metadata
```

Avoid:

- excessive gradients
- glowing neon UI
- decorative clutter
- unnecessary animations
- excessive cards

The interface should feel like an operational console.

---

# 29. State Management

Use Riverpod if already selected.

Recommended providers:

```text
authProvider
connectivityProvider
syncProvider
missionsProvider
missionProvider(missionId)
tasksProvider(missionId)
eventsProvider(missionId)
replayProvider(missionId)
```

Keep business logic out of widgets.

---

# 30. Repository Layer

Use:

```text
UI
 ↓
Provider
 ↓
Repository
 ↓
Local / Remote Data Source
```

Example:

```text
TaskRepository
 ├── RemoteTaskDataSource
 └── LocalTaskDataSource
```

This keeps offline behavior from being scattered throughout UI code.

---

# 31. Error Handling

Define application-level errors for:

```text
UNAUTHENTICATED
UNAUTHORIZED
NOT_FOUND
INVALID_STATE_TRANSITION
DUPLICATE_OPERATION
SYNC_CONFLICT
SYNC_FAILED
SERVER_UNAVAILABLE
VALIDATION_ERROR
```

Frontend should show human-readable messages.

Do not display raw stack traces.

Log detailed errors in development.

---

# 32. Security

Required:

- server-side authorization
- authenticated endpoints
- mission membership checks
- task assignment checks
- server-side state transition validation
- no secrets in Flutter
- secure production connection
- idempotency
- controlled input validation

Do not trust:

- role values from the client
- task ownership values from the client
- timestamps as authorization
- arbitrary event types

---

# 33. Testing Plan

## Unit tests

Test:

- task transition rules
- authorization rules
- idempotency
- event validation
- sync state machine
- replay ordering

## Integration tests

Test:

```text
Login
 ↓
Create mission
 ↓
Create task
 ↓
Assign task
 ↓
Update task
 ↓
Create event
 ↓
Stream update
```

## Offline integration test

```text
Login
 ↓
Load mission
 ↓
Disconnect
 ↓
Update task
 ↓
Create observation
 ↓
Verify local pending state
 ↓
Reconnect
 ↓
Sync
 ↓
Verify server state
 ↓
Verify real-time update
 ↓
Verify replay
```

---

# 34. Quality Gate

Before declaring implementation complete:

```text
flutter format
flutter analyze
flutter test
```

Also run Serverpod/server tests and verify migrations.

Check:

- clean startup
- authentication
- mission creation
- team management
- task workflow
- event creation
- real-time updates
- offline operation
- sync
- conflict visibility
- replay
- demo mode

Fix errors rather than suppressing them.

---

# 35. Implementation Order

Follow this exact order.

### Phase 1

Project inspection + Serverpod setup

### Phase 2

Theme + routing + base components

### Phase 3

Authentication

### Phase 4

Database models + migrations

### Phase 5

Mission backend + UI

### Phase 6

Team backend + UI

### Phase 7

Task backend + UI

### Phase 8

Mission events

### Phase 9

Serverpod streaming

### Phase 10

Local cache

### Phase 11

Offline mutations

### Phase 12

Synchronization

### Phase 13

Conflict visibility

### Phase 14

Mission Replay

### Phase 15

Demo mode

### Phase 16

Future Call

### Phase 17

Testing + polish

### Phase 18

Final demo verification

Do not jump directly to polish before offline synchronization works.

---

# 36. Antigravity Master Prompt

Copy the following prompt into Antigravity:

```text
You are implementing BLACKBOX, a solo-developer hackathon MVP.

BlackBox is an offline-first operations platform.

Core statement:

"The network can fail. The operation shouldn't."

The product allows a Commander to create missions, assign tasks and monitor operations. Field Operators can work against cached mission data and perform supported actions while offline. When connectivity returns, local changes synchronize with the Serverpod backend. Important actions become immutable mission events. The event history powers Mission Replay.

==================================================
NON-NEGOTIABLE TECHNOLOGY
==================================================

Frontend:
Flutter + Dart

Backend:
Serverpod

Database:
PostgreSQL through Serverpod

Use:
- Serverpod generated client
- Serverpod authentication
- Serverpod streaming
- Serverpod supported client-side/local database functionality
- Serverpod Future Calls only after the core system works

Optional:
- Riverpod
- go_router
- connectivity_plus
- google_fonts
- intl

DO NOT USE:
- Express
- Node.js backend
- MongoDB
- Firebase backend
- Socket.IO
- custom WebSocket server
- custom authentication server
- another ORM
- another synchronization framework

==================================================
FIRST STEP: INSPECT THE REPOSITORY
==================================================

Before changing anything:

1. Inspect the entire repository structure.
2. Determine whether Flutter already exists.
3. Determine whether Serverpod already exists.
4. Determine the installed Serverpod version.
5. Determine the Flutter/Dart versions.
6. Inspect existing generated Serverpod code.
7. Inspect existing database configuration.
8. Inspect existing authentication.
9. Inspect existing dependencies.
10. Inspect existing tests.

Do not delete working code.

Do not rewrite the project from scratch if a generated Serverpod structure already exists.

Do not invent APIs.

If the installed Serverpod version differs from assumptions in this prompt, use the actual installed API.

==================================================
IMPLEMENTATION PRINCIPLE
==================================================

Build in phases.

After every phase:

1. format code;
2. run static analysis;
3. run relevant tests;
4. start the app/server;
5. verify the implemented feature manually.

Do not proceed while the current phase is broken.

Critical path:

AUTH
→ MISSION
→ TASKS
→ EVENTS
→ REAL-TIME
→ OFFLINE
→ SYNC
→ REPLAY

Do not build stretch features before this path is working.

==================================================
PHASE 1 — FOUNDATION
==================================================

Set up:

- Flutter app
- Serverpod server
- generated client
- database
- routing
- theme
- basic error handling

Routes:

/login
/register
/dashboard
/mission/:id
/mission/:id/replay

Verify Flutter can communicate with Serverpod.

==================================================
PHASE 2 — UI SYSTEM
==================================================

Create a dark operational-console UI.

Background:
#0A0C0F

Use dark elevated surfaces.

Semantic colors:

green = healthy/synced
amber = pending/warning
red = critical/conflict
blue = active/informational

Typography:

Inter or Space Grotesk
IBM Plex Mono for technical metadata

Create reusable:

StatusBadge
NetworkIndicator
SyncIndicator
MissionCard
TaskCard
EventTile
MemberChip
EventTimeline
TimelineNode

Do not over-design.

==================================================
PHASE 3 — AUTH
==================================================

Use Serverpod authentication.

Implement:

register
login
logout
current-user

Roles:

COMMANDER
FIELD_OPERATOR

Do not store passwords manually.

Protect server endpoints.

==================================================
PHASE 4 — DATABASE
==================================================

Implement:

UserProfile
Mission
MissionMember
Task
MissionEvent

Mission:

id
title
description
location
severity
status
createdBy
createdAt
startedAt
completedAt

MissionMember:

id
missionId
userId
role
status
joinedAt

Task:

id
missionId
title
description
priority
status
assignedTo
createdBy
createdAt
dueAt
completedAt

MissionEvent:

id
missionId
actorId
eventType
payload
createdAt
clientCreatedAt
deviceId
idempotencyKey
source

Use enums.

Create migrations using Serverpod's actual migration workflow.

Never manually edit generated model files.

==================================================
PHASE 5 — MISSION
==================================================

Implement typed Serverpod methods:

createMission
getMission
getMyMissions
updateMission
startMission
completeMission

Commander can create/start/complete missions.

Field Operator can view missions they belong to.

==================================================
PHASE 6 — TEAM
==================================================

Implement:

addMember
removeMember
getMembers
updateMemberStatus

Only authorized Commanders can manage membership.

==================================================
PHASE 7 — TASKS
==================================================

Implement:

createTask
getTasks
getTask
assignTask
updateTaskStatus

Task states:

PENDING
ACTIVE
BLOCKED
COMPLETED

Allowed transitions:

PENDING → ACTIVE
PENDING → BLOCKED
ACTIVE → COMPLETED
ACTIVE → BLOCKED
BLOCKED → ACTIVE

Field Operators can only modify assigned tasks.

Every important task state change creates a MissionEvent.

==================================================
PHASE 8 — EVENTS
==================================================

Event types:

MISSION_CREATED
MISSION_STARTED
MISSION_COMPLETED
MEMBER_ASSIGNED
MEMBER_CHECKED_IN
TASK_CREATED
TASK_ASSIGNED
TASK_STARTED
TASK_COMPLETED
TASK_BLOCKED
OBSERVATION_RECORDED
NETWORK_LOST
NETWORK_RESTORED
SYNC_STARTED
SYNC_COMPLETED
SYNC_CONFLICT

Implement:

createEvent
getMissionEvents

Every event request must include:

missionId
eventType
payload
clientCreatedAt
deviceId
idempotencyKey

Validate event type server-side.

==================================================
PHASE 9 — REAL-TIME
==================================================

Use Serverpod streaming.

Do not create custom WebSockets.

Mission-scoped updates.

Flow:

mutation
→ endpoint
→ database
→ event
→ stream
→ connected clients

Demo:

Field Unit A completes task.

Commander sees the update without refresh.

==================================================
PHASE 10 — LOCAL DATA
==================================================

Implement local cached data for:

Mission
Task
MissionEvent

Use the supported Serverpod client-side/local database mechanism available in the installed version.

Do not create a second sync framework.

Offline UI must remain inside the current mission.

==================================================
PHASE 11 — CONNECTIVITY
==================================================

Track:

networkAvailable
serverReachable

States:

ONLINE
OFFLINE
RECONNECTING
SYNCING
SYNCED
SYNC_ERROR

Use connectivity_plus only as a network hint.

Verify Serverpod reachability before declaring synchronization possible.

==================================================
PHASE 12 — OFFLINE MUTATIONS
==================================================

Supported offline actions:

- start assigned task
- complete assigned task
- block assigned task
- create observation
- view cached mission
- view cached tasks

Every mutation immediately updates local UI.

Every mutation creates a unique local operation/idempotency key.

==================================================
PHASE 13 — SYNCHRONIZATION
==================================================

When reconnecting:

1. find pending operations;
2. mark them SYNCING;
3. submit using supported Serverpod synchronization;
4. validate response;
5. mark successful operations SYNCED;
6. surface conflicts;
7. retry transient failures;
8. update local cache.

Never silently discard local events.

Never blindly overwrite server state.

Use idempotency.

==================================================
PHASE 14 — CONFLICTS
==================================================

MVP conflict strategy:

immutable events
+
server validation
+
visible conflict

Example:

remote:
COMPLETED

local:
BLOCKED

Result:
CONFLICT

Display both states.

Do not implement CRDTs.

==================================================
PHASE 15 — REPLAY
==================================================

Implement:

/mission/:id/replay

Fetch real mission events.

Show:

timestamp
actor
event
source
sync status

Controls:

Play
Pause
1x
2x
5x
Jump

Do not use fake replay data outside demo seeding.

==================================================
PHASE 16 — DEMO MODE
==================================================

Demo identities:

COMMANDER
FIELD UNIT A
FIELD UNIT B

Controls:

ONLINE
OFFLINE
RECONNECT
CREATE SAMPLE MISSION
RESET DEMO

Demo data:

Campus Building B Emergency Drill

Tasks:

Evacuate Building B
Check Zone C
Secure Entrance
Medical Assessment

The demo must use the real Serverpod backend.

==================================================
PHASE 17 — FUTURE CALL
==================================================

Only after the core workflow is stable.

Create one scheduled escalation.

Example:

Critical task remains pending for five minutes.

Future Call runs.

Reload current state.

If still pending:
create escalation event.

If completed:
do nothing.

==================================================
PHASE 18 — TESTING
==================================================

Test:

authentication
authorization
mission creation
task transitions
event creation
idempotency
stream updates
offline actions
reconnect
sync
conflicts
replay
Future Call

Critical integration test:

login
→ create mission
→ create task
→ disconnect
→ complete task
→ create observation
→ verify pending
→ reconnect
→ synchronize
→ verify server state
→ verify Commander update
→ verify replay

==================================================
PHASE 19 — SECURITY
==================================================

Server-side:

authentication
authorization
mission membership
task assignment
state transition validation
input validation
idempotency

Never trust client role or permissions.

Never store secrets in Flutter.

==================================================
PHASE 20 — FINAL QUALITY GATE
==================================================

Run:

flutter format
flutter analyze
flutter test

Run Serverpod tests.

Verify migrations.

Verify:

- login
- mission creation
- team
- tasks
- events
- real-time
- offline
- sync
- conflict
- replay
- demo

Fix errors instead of suppressing them.

==================================================
FINAL DEMO
==================================================

Demonstrate:

1. Commander opens mission.
2. Field Unit A updates a task.
3. Commander receives live update.
4. Network is disabled.
5. Field Unit A continues working.
6. Pending changes appear.
7. Network is restored.
8. Synchronization runs.
9. Commander receives synchronized state.
10. Mission Replay displays the complete event history.

Final product statement:

"The network can fail. The operation shouldn't."

==================================================
IMPORTANT
==================================================

Do not replace Serverpod.

Do not invent framework APIs.

Do not delete generated Serverpod code.

Do not add unnecessary infrastructure.

Do not overbuild.

Make the offline → reconnect → sync → replay workflow exceptionally reliable.

The working core is more important than feature count.
```

---

# 37. Final Priority

If time becomes limited:

### Tier 1 — Must work

```text
Serverpod
Authentication
Mission
Tasks
Events
Local offline operation
Synchronization
```

### Tier 2

```text
Real-time streaming
Mission Replay
Demo mode
```

### Tier 3

```text
Future Calls
Conflict center
Reports
Analytics
Attachments
```

Do not sacrifice the offline synchronization workflow for extra features.

---

# 38. Final Acceptance Flow

BlackBox is complete when this works end-to-end:

```text
MISSION CREATED
       ↓
TEAM ASSIGNED
       ↓
TASK ASSIGNED
       ↓
LIVE UPDATE
       ↓
NETWORK LOST
       ↓
WORK CONTINUES
       ↓
LOCAL EVENTS CREATED
       ↓
NETWORK RESTORED
       ↓
SERVERPOD SYNC
       ↓
CENTRAL STATE UPDATED
       ↓
REAL-TIME UPDATE
       ↓
MISSION REPLAY
```

This sequence is the product.

Everything else supports it.
