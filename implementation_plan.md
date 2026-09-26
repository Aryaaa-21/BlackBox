# BlackBox — Complete 10-Phase Implementation Plan

## Agent Instruction Document

This document is the implementation roadmap for building **BlackBox** from top to bottom.

The agent should use this document as the primary execution plan and work through the phases **in order**.

The project must be implemented as a real, integrated product — not as a disconnected frontend mockup and backend prototype.

---

# 1. Product Definition

## BlackBox

BlackBox is an **offline-first operations platform**.

It allows a Commander to:

- create missions;
- manage team members;
- create and assign tasks;
- monitor mission activity;
- receive real-time updates;
- review the complete mission history.

Field Operators can:

- access synchronized mission data;
- work on assigned tasks;
- record operational observations;
- continue supported operations when the network disappears;
- synchronize their changes when connectivity returns.

The central product idea is:

> **The network can fail. The operation shouldn't.**

---

# 2. Core Product Flow

The entire system revolves around this flow:

```text
NORMAL OPERATION
       ↓
NETWORK FAILS
       ↓
WORK CONTINUES LOCALLY
       ↓
LOCAL CHANGES STORED
       ↓
NETWORK RETURNS
       ↓
SERVERPOD SYNCHRONIZATION
       ↓
CENTRAL STATE UPDATED
       ↓
REAL-TIME UPDATE
       ↓
MISSION REPLAY
```

This flow is the most important part of the project.

Everything else supports this workflow.

---

# 3. Critical Implementation Principle

Do NOT build the frontend completely first and the backend afterward.

Build every feature as a vertical slice:

```text
DATABASE
   ↓
SERVERPOD ENDPOINT
   ↓
REPOSITORY
   ↓
STATE MANAGEMENT
   ↓
UI
   ↓
TEST
```

Example:

```text
MISSION

Database
   ↓
MissionEndpoint
   ↓
MissionRepository
   ↓
MissionProvider
   ↓
MissionScreen
   ↓
Integration Test
```

Then continue to the next feature.

This prevents frontend/backend integration problems.

---

# 4. Technology Direction

## Frontend

Use:

- Flutter
- Dart
- Riverpod if required
- go_router
- connectivity_plus
- google_fonts
- intl

## Backend

Use:

- Serverpod
- Serverpod generated client
- Serverpod authentication
- Serverpod endpoints
- Serverpod streaming
- Serverpod Future Calls where useful

## Database

Use:

- PostgreSQL through Serverpod
- Serverpod migrations

## Local Data

Use the supported Serverpod client-side/local database and synchronization capabilities available in the installed Serverpod version.

---

# 5. Strict Technology Rules

DO NOT introduce:

- Express
- Node.js backend
- MongoDB
- Firebase backend
- Socket.IO
- custom WebSocket server
- custom authentication backend
- second ORM
- separate synchronization framework

Serverpod must be the actual backend.

Do not use Serverpod as a decorative dependency on top of another backend.

---

# 6. First Action — Inspect Existing Repository

Before changing code, inspect the repository completely.

Determine:

1. Flutter version
2. Dart version
3. Serverpod version
4. Existing Flutter structure
5. Existing Serverpod structure
6. Generated Serverpod client
7. Database configuration
8. Existing authentication
9. Existing dependencies
10. Existing tests
11. Existing migrations
12. Existing environment/configuration files

Do not destroy existing working code.

Do not rewrite the repository from scratch if a generated Serverpod project already exists.

Do not invent Serverpod APIs.

If the installed Serverpod version differs from this document, use the APIs actually available in that version.

---

# PHASE 1 — FOUNDATION & ARCHITECTURE

## Goal

Get the complete technical foundation working.

---

## Backend

Set up:

- Serverpod server
- PostgreSQL
- generated Serverpod client
- server configuration
- environment configuration
- migration system
- endpoint structure
- service/repository structure
- error handling

Suggested structure:

```text
server/
├── endpoints/
├── services/
├── database/
├── future_calls/
└── server.dart
```

Do not manually duplicate generated Serverpod code.

---

## Frontend

Set up:

- Flutter application
- routing
- theme
- typography
- global state management
- Serverpod client initialization
- connectivity service skeleton
- reusable UI components
- error handling

Suggested screens:

```text
/login
/register
/dashboard
/mission/:id
/mission/:id/replay
```

---

## Basic UI

Create the BlackBox shell.

Build:

- app navigation
- application header
- base layout
- theme
- buttons
- inputs
- cards
- status badges
- loading states
- error states

Do not build fake business functionality yet.

---

## Phase 1 Acceptance Test

The following must work:

```text
START SERVERPOD
      ↓
START FLUTTER
      ↓
FLUTTER CONNECTS TO SERVERPOD
      ↓
ROUTING WORKS
      ↓
APPLICATION LOADS
```

Do not proceed until this works.

---

# PHASE 2 — AUTHENTICATION & USERS

## Goal

Create the identity and permission foundation.

---

## Backend

Use Serverpod authentication.

Implement:

```text
register
login
logout
getCurrentUser
```

Create application profile:

```text
UserProfile
```

Fields:

```text
id
authUserId
displayName
role
createdAt
```

---

## Roles

Use:

```text
COMMANDER
FIELD_OPERATOR
```

---

## Authorization Foundation

Create reusable server-side authorization checks:

```text
isAuthenticated()
isCommander()
isMissionMember()
isTaskAssignee()
```

Do not rely on frontend role checks for security.

---

## Frontend

Create:

```text
LoginScreen
RegisterScreen
Session handling
Logout
```

After login:

```text
Authentication
      ↓
Current User
      ↓
Role
      ↓
Dashboard
```

---

## Phase 2 Acceptance Test

```text
REGISTER
   ↓
LOGIN
   ↓
SESSION PERSISTS
   ↓
DASHBOARD
   ↓
LOGOUT
```

Also test:

```text
FIELD OPERATOR
      ↓
TRIES COMMANDER ACTION
      ↓
SERVER REJECTS
```

---

# PHASE 3 — MISSION MANAGEMENT

## Goal

Create the main operational container.

Everything else exists inside a Mission.

---

## Database

Create:

```text
Mission
```

Fields:

```text
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
```

---

## Mission Status

```text
DRAFT
ACTIVE
COMPLETED
CANCELLED
```

---

## Backend

Create:

```text
MissionEndpoint
```

Methods:

```text
createMission()
getMission()
getMyMissions()
updateMission()
startMission()
completeMission()
```

Validate:

- authentication
- role
- ownership
- mission membership
- status transitions

---

## Frontend

Build:

```text
Dashboard
Mission List
Create Mission
Mission Overview
Mission Status
```

Dashboard should show:

```text
Active Missions
Active Tasks
Team Count
Recent Activity
```

Some dashboard values can remain empty until later phases implement the underlying data.

Do not fake final data.

---

## Phase 3 Acceptance Test

```text
COMMANDER
   ↓
CREATE MISSION
   ↓
MISSION APPEARS
   ↓
OPEN MISSION
   ↓
START MISSION
   ↓
STATUS = ACTIVE
```

---

# PHASE 4 — TEAM & TASK OPERATIONS

## Goal

Turn a Mission into a real operational workspace.

This phase includes:

- team management
- task management
- task assignment
- task state transitions

---

# 4A — Team Backend

Create:

```text
MissionMember
```

Fields:

```text
id
missionId
userId
role
status
joinedAt
```

Methods:

```text
addMember()
removeMember()
getMembers()
updateMemberStatus()
```

Only authorized Commanders can manage membership.

---

# 4B — Task Backend

Create:

```text
Task
```

Fields:

```text
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
```

---

## Task Status

```text
PENDING
ACTIVE
BLOCKED
COMPLETED
```

---

## Task Priority

```text
LOW
MEDIUM
HIGH
CRITICAL
```

---

## Task State Machine

The backend must enforce valid transitions.

Allowed:

```text
PENDING → ACTIVE
PENDING → BLOCKED

ACTIVE → COMPLETED
ACTIVE → BLOCKED

BLOCKED → ACTIVE
```

Invalid transitions must be rejected.

Do not rely only on frontend validation.

---

## Backend Methods

```text
createTask()
getTasks()
getTask()
assignTask()
updateTaskStatus()
```

---

## Frontend

Build:

```text
Team Panel
Task Board
Task Card
Create Task
Assign Task
Task Details
Task Status Controls
```

Example:

```text
COMMANDER
    ↓
CREATE TASK
    ↓
ASSIGN FIELD UNIT A
    ↓
FIELD UNIT A
    ↓
START TASK
    ↓
COMPLETE TASK
```

---

## Phase 4 Acceptance Test

A Mission must now contain real:

```text
TEAM
+
TASKS
```

with real Serverpod/PostgreSQL data.

---

# PHASE 5 — EVENT SYSTEM & REAL-TIME

## Goal

Make BlackBox more than a CRUD application.

Every important operation becomes an operational event.

---

# 5A — MissionEvent

Create:

```text
MissionEvent
```

Fields:

```text
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
```

---

## Event Types

Start with:

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
```

Later add:

```text
NETWORK_LOST
NETWORK_RESTORED
SYNC_STARTED
SYNC_COMPLETED
SYNC_CONFLICT
```

Do not allow arbitrary event type strings from the client.

---

# 5B — Event Endpoint

Create:

```text
EventEndpoint
```

Methods:

```text
createEvent()
getMissionEvents()
```

When a task changes:

```text
TASK UPDATE
    ↓
MISSION EVENT
```

---

# 5C — Real-Time Streaming

Use Serverpod streaming.

Do NOT build a custom WebSocket server.

Flow:

```text
USER ACTION
    ↓
SERVERPOD ENDPOINT
    ↓
DATABASE
    ↓
MISSION EVENT
    ↓
SERVERPOD STREAM
    ↓
CONNECTED CLIENTS
```

---

## Frontend

Create:

```text
Live Activity Feed
Event Timeline
Real-Time Task Updates
Real-Time Mission Updates
```

---

## Required Demo

Two clients:

```text
COMMANDER
FIELD UNIT A
```

Field Unit A completes a task.

Commander sees the update without refreshing.

---

## Phase 5 Acceptance Test

```text
FIELD UNIT A
      ↓
COMPLETE TASK
      ↓
SERVERPOD
      ↓
MISSION EVENT
      ↓
STREAM
      ↓
COMMANDER UI UPDATES
```

No refresh.

No polling.

---

# PHASE 6 — OFFLINE-FIRST LOCAL OPERATIONS

## Goal

Make BlackBox genuinely useful when connectivity disappears.

This is one of the most important phases.

---

## Important Rule

Do NOT make offline mode a fake separate screen.

The user should remain inside the current Mission.

Example:

```text
MISSION SCREEN
     +
OFFLINE STATE
     +
PERSISTENT OFFLINE INDICATOR
```

---

## Local Data

Cache:

```text
Mission
Task
MissionEvent
```

Use the supported Serverpod client-side/local database capabilities available in the installed version.

Do not create a second synchronization framework.

---

## Connectivity States

Track:

```text
networkAvailable
serverReachable
```

Expose:

```text
ONLINE
OFFLINE
RECONNECTING
```

`connectivity_plus` is only a network-state hint.

Do not assume:

```text
Wi-Fi = Serverpod available
```

---

## Supported Offline Actions

Allow:

```text
View mission
View tasks

Start task
Complete task
Block task

Create observation
```

---

## Offline Flow

```text
ONLINE
   ↓
MISSION LOADED
   ↓
NETWORK LOST
   ↓
OFFLINE STATE
   ↓
USER COMPLETES TASK
   ↓
LOCAL STATE UPDATED
   ↓
PENDING
```

The user must not be blocked.

---

## Frontend

Build:

```text
NetworkIndicator
Offline Banner
Local Badge
Pending Badge
Offline Operation Feedback
```

---

## Phase 6 Acceptance Test

Disconnect the network.

Then:

```text
OPEN MISSION
   ↓
COMPLETE TASK
   ↓
CREATE OBSERVATION
   ↓
DATA REMAINS AVAILABLE LOCALLY
```

The operation must continue.

Do not proceed if offline behavior is unreliable.

---

# PHASE 7 — SYNCHRONIZATION & CONFLICT HANDLING

## Goal

Make reconnection reliable.

The desired flow:

```text
LOCAL
  ↓
PENDING
  ↓
SYNCING
  ↓
SERVER
  ↓
SYNCED
```

---

## Sync States

Use:

```text
LOCAL
PENDING
SYNCING
SYNCED
CONFLICT
FAILED
```

---

## Backend

Use Serverpod's actual supported synchronization capabilities.

Do not invent a custom synchronization protocol if Serverpod already provides the required mechanism.

If an application-level synchronization layer is required, keep it minimal.

---

# Idempotency

Every local mutation requires:

```text
idempotencyKey
```

Server behavior:

```text
IDEMPOTENCY KEY EXISTS?
        │
    ┌───┴───┐
   YES      NO
    ↓        ↓
RETURN    PROCESS
EXISTING
RESULT
```

This prevents duplicates caused by:

- retrying
- reconnecting
- app restart
- double tap
- delayed network requests

---

# Sync Flow

When connectivity returns:

```text
1. Find pending operations
2. Mark SYNCING
3. Submit through Serverpod synchronization
4. Validate response
5. Mark successful operations SYNCED
6. Surface conflicts
7. Retry transient failures
8. Update local cache
```

Never silently discard events.

Never blindly overwrite server state.

---

# Conflict Example

Server:

```text
COMPLETED
```

Local:

```text
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

Server:
COMPLETED

Local:
BLOCKED

VIEW EVENT
```

Do not implement CRDTs for the MVP.

Do not silently delete the losing operation.

Keep the event history.

---

## Frontend

Build:

```text
SyncIndicator
Pending Changes Panel
Sync Status
Conflict Card
Retry Control
```

---

## Phase 7 Acceptance Test

This exact workflow must work:

```text
ONLINE
   ↓
CREATE TASK
   ↓
OFFLINE
   ↓
COMPLETE TASK
   ↓
CREATE OBSERVATION
   ↓
PENDING = 2
   ↓
RECONNECT
   ↓
SYNCING
   ↓
SYNCED
   ↓
COMMANDER RECEIVES UPDATE
```

This is the core BlackBox demonstration.

---

# PHASE 8 — MISSION REPLAY

## Goal

Turn the event history into a complete operational replay.

---

## Backend

Create:

```text
ReplayEndpoint
```

Method:

```text
getReplay(missionId)
```

Return actual mission events in chronological order.

---

## Frontend

Create:

```text
MissionReplayScreen
```

Display:

```text
Timestamp
Actor
Event
Source
Sync Status
```

Example:

```text
10:01  Mission Created
10:02  Team Assigned
10:04  Task Created
10:05  Task Started
10:07  Network Lost
10:08  Task Completed
10:09  Observation Recorded
10:12  Network Restored
10:12  Changes Synced
```

---

## Controls

```text
Play
Pause
1x
2x
5x
Previous
Next
Jump to Event
```

---

## Visual Event Types

Differentiate:

```text
NORMAL EVENT
OFFLINE EVENT
SYNC EVENT
CONFLICT EVENT
```

Replay must use real stored events.

Do not create a fake replay system separate from the event database.

---

## Phase 8 Acceptance Test

A completed mission must be reproducible through its actual MissionEvent history.

---

# PHASE 9 — DEMO MODE + POLISH + OPTIONAL FUTURE CALL

## Goal

Make the product presentation-ready.

---

# Demo Mode

Provide demo identities:

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
CREATE DEMO MISSION
RESET DEMO
```

The underlying application must still use the real Serverpod backend.

Only the demo controls are simulated.

---

# Demo Mission

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

---

# UI Polish

Now improve:

- spacing
- typography
- responsive layouts
- loading states
- empty states
- error states
- transitions
- animations
- status indicators
- replay animation
- accessibility
- visual consistency

Do not add visual effects that reduce operational clarity.

Avoid:

- excessive gradients
- neon effects
- unnecessary cards
- decorative animations
- visual clutter

---

# Optional Serverpod Future Call

Only implement this after the core system is stable.

Example:

```text
CRITICAL TASK
      ↓
5 MINUTE DEADLINE
      ↓
FUTURE CALL
      ↓
CHECK CURRENT TASK STATE
      ↓
STILL PENDING?
   /          \
 YES           NO
 ↓              ↓
ESCALATE      NOTHING
```

The Future Call must re-check current database state.

Never assume the task is still pending because it was pending when the call was scheduled.

---

# PHASE 9 ACCEPTANCE TEST

The application should now be:

```text
FUNCTIONAL
+
OFFLINE CAPABLE
+
SYNCHRONIZED
+
REAL-TIME
+
REPLAYABLE
+
PRESENTATION READY
```

---

# PHASE 10 — TESTING, DEPLOYMENT & FINAL DEMO

## Goal

Prove that the complete product works from top to bottom.

---

# Test 1 — Authentication

Test:

```text
Register
Login
Logout
Session persistence
Invalid credentials
Unauthorized requests
```

---

# Test 2 — Mission

Test:

```text
Create
Update
Start
Complete
Cancel
```

---

# Test 3 — Team

Test:

```text
Add member
Remove member
Update status
Authorization
```

---

# Test 4 — Tasks

Test:

```text
Create
Assign
Start
Block
Complete
Invalid transition
Unauthorized update
```

---

# Test 5 — Events

Every important action must generate:

```text
MissionEvent
```

Verify:

```text
actor
mission
event type
timestamp
source
idempotency key
```

---

# Test 6 — Real-Time

Two clients:

```text
COMMANDER
FIELD UNIT
```

Action:

```text
FIELD UNIT
    ↓
COMPLETE TASK
```

Expected:

```text
COMMANDER
    ↓
IMMEDIATE UPDATE
```

No refresh.

---

# Most Important Integration Test

## Offline → Sync → Replay

Run this exact test:

```text
1. LOGIN
       ↓
2. CREATE MISSION
       ↓
3. CREATE TASK
       ↓
4. ASSIGN TASK
       ↓
5. CONNECT SECOND CLIENT
       ↓
6. DISCONNECT NETWORK
       ↓
7. COMPLETE TASK
       ↓
8. CREATE OBSERVATION
       ↓
9. VERIFY PENDING OPERATIONS
       ↓
10. RECONNECT
       ↓
11. SYNCING
       ↓
12. SYNCED
       ↓
13. COMMANDER RECEIVES UPDATE
       ↓
14. OPEN REPLAY
       ↓
15. VERIFY COMPLETE TIMELINE
```

If this test passes, the core product is working.

---

# Final Quality Gate

Run:

```text
flutter format
flutter analyze
flutter test
```

Also run:

```text
Serverpod tests
Database migration verification
Integration tests
```

Verify:

```text
Clean startup
Authentication
Mission creation
Team management
Task workflow
Event creation
Real-time streaming
Offline operation
Synchronization
Conflict handling
Mission Replay
Demo mode
```

Fix errors.

Do not suppress errors just to get a green build.

---

# Final 10-Phase Dependency Map

| Phase | Frontend | Backend | Database | Main Output |
|---|---|---|---|---|
| **1** | Shell + Routing | Serverpod Setup | PostgreSQL Setup | Working Foundation |
| **2** | Login/Register | Authentication | User Profile | Real Users |
| **3** | Dashboard + Mission UI | Mission Endpoints | Mission | Working Missions |
| **4** | Team + Task UI | Team/Task Endpoints | Members + Tasks | Operational Workflow |
| **5** | Activity Feed | Events + Streaming | MissionEvent | Real-Time Operations |
| **6** | Offline UX | Local Data Foundation | Local Cache | Work Without Network |
| **7** | Sync UI | Sync + Idempotency | Sync Metadata | Reliable Reconnection |
| **8** | Replay UI | Replay Endpoint | Event History | Mission Reconstruction |
| **9** | Demo + Polish | Optional Future Call | Final Data | Presentation Ready |
| **10** | Testing + Deployment | Production Configuration | Migration Verification | Final Hackathon Build |

---

# What NOT To Do

Do not build like this:

```text
FRONTEND
████████████████████ 100%
        ↓
BACKEND
████████████████████ 100%
        ↓
TRY TO CONNECT EVERYTHING
```

Instead:

```text
DATABASE
   ↓
SERVERPOD ENDPOINT
   ↓
REPOSITORY
   ↓
STATE
   ↓
UI
   ↓
TEST
```

Repeat this for every feature.

---

# Critical Priority Order

If development time becomes limited, protect these features in this order:

## Tier 1 — Must Work

```text
Serverpod
Authentication
Mission
Tasks
Events
Local Offline Operation
Synchronization
```

## Tier 2 — Important

```text
Real-Time Streaming
Mission Replay
Demo Mode
```

## Tier 3 — Optional

```text
Future Calls
Conflict Center
Reports
Analytics
Attachments
```

Never sacrifice the offline → reconnect → sync workflow for additional features.

---

# Final Product Architecture

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
          │                  Authentication              │
          │                  Missions                    │
          │                  Team                        │
          │                  Tasks                       │
          │                  Events                      │
          │                  Sync                        │
          │                  Replay                      │
          │                                              │
          └────────────── SYNC ──────────────────────────┘
                                      │
                                  SERVERPOD
                                      │
                                  POSTGRESQL
```

---

# Final Acceptance Flow

BlackBox is complete when this entire sequence works:

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

---

# Agent Execution Rules

These rules must be followed throughout implementation.

## Rule 1 — Inspect Before Editing

Never assume the project structure.

Inspect first.

## Rule 2 — Preserve Existing Work

Do not delete working code without a reason.

## Rule 3 — Use Real Serverpod

Serverpod must handle the actual backend.

## Rule 4 — Do Not Invent APIs

If unsure about a Serverpod API, inspect the installed version and existing generated code.

## Rule 5 — Work Phase by Phase

Complete and test one phase before moving to the next.

## Rule 6 — Do Not Overbuild

Do not add unnecessary infrastructure.

## Rule 7 — Backend Security Is Mandatory

Frontend permission checks are not sufficient.

## Rule 8 — Offline Is a Real Operating State

Do not treat offline as an error page.

## Rule 9 — Synchronization Must Be Reliable

Never silently discard offline operations.

## Rule 10 — Test the Critical Path

The most important workflow is:

```text
ONLINE
 ↓
OFFLINE
 ↓
WORK
 ↓
RECONNECT
 ↓
SYNC
 ↓
REAL-TIME UPDATE
 ↓
REPLAY
```

---

# Final Instruction To The Agent

Build BlackBox from **Phase 1 through Phase 10 in order**.

Do not skip phases.

Do not build only the frontend.

Do not build only the backend.

Every phase must connect:

```text
DATABASE
+
SERVERPOD
+
FRONTEND
+
STATE
+
UI
+
TESTING
```

The final application must be a real working system.

The most important feature is not the dashboard.

The most important feature is:

> **A user can continue an operation when the network disappears, reconnect later, synchronize safely through Serverpod, and reconstruct the complete operation through Mission Replay.**

Final product statement:

> **The network can fail. The operation shouldn't.**
