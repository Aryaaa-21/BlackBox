# BlackBox — Complete Hackathon Idea & Implementation Plan

## 1. Project Identity

**Project Name:** BlackBox  
**Category:** Resilient Operations / Offline-First Coordination  
**Primary Platform:** Serverpod 4  
**Client:** Flutter  
**Backend:** Serverpod  
**Database:** Serverpod-managed PostgreSQL / embedded PostgreSQL for development  
**Core Technical Theme:** Offline-first operation + synchronization + real-time updates  
**Target:** Solo hackathon MVP

### One-line pitch

> **BlackBox is an offline-first operations platform that keeps teams coordinated when connectivity disappears and automatically synchronizes and reconstructs the operation when the network returns.**

### Short description

BlackBox is designed for situations where a team cannot assume that the internet will always be available. A commander creates an operation, assigns tasks, and receives live updates from field members. When a device loses connectivity, the user can continue working locally: completing tasks, recording observations, changing statuses, and creating incident events. Once connectivity returns, the pending changes are synchronized with the central system and the rest of the team receives the updates.

The product is intentionally focused. It is not trying to become a complete disaster-management suite. The hackathon MVP demonstrates one technically strong capability extremely well: **the operation continues even when the network does not.**

---

# 2. The Problem

Most modern web applications assume continuous connectivity.

That assumption is acceptable for normal productivity software, but it breaks down in field operations.

Examples include:

- emergency drills
- campus incidents
- industrial inspections
- construction sites
- outdoor events
- disaster-response exercises
- field research
- utility maintenance
- security operations
- remote work sites

A field worker may lose connectivity because of:

- weak cellular coverage
- overloaded networks
- damaged infrastructure
- underground or enclosed locations
- temporary network outages
- movement between coverage areas

When a conventional application loses connectivity, users often lose access to the latest information or cannot submit important updates.

The actual operational problem is therefore:

> **How can a distributed team continue recording and executing work when the network becomes unreliable, without losing the changes made during the outage?**

BlackBox addresses this problem through an offline-first architecture.

---

# 3. The Core Concept

BlackBox treats connectivity as a condition, not a requirement.

The application has two operational states:

## ONLINE

The application communicates with Serverpod.

Users can:

- see current mission state
- receive live updates
- create tasks
- update tasks
- record events
- synchronize normally

## OFFLINE

The application continues to function using local data.

Users can:

- view previously synchronized mission information
- complete tasks
- create operational events
- change allowed local statuses
- record observations
- queue changes for synchronization

The user should not have to manually rebuild the work after reconnecting.

The system automatically synchronizes pending changes.

---

# 4. Why This Is a Good Serverpod Project

The goal is not to attach Serverpod to a normal CRUD application.

BlackBox should use the platform for the parts that define the product:

1. Serverpod endpoints for typed server operations.
2. Serverpod database models for persistent mission data.
3. Serverpod client-side database for local data.
4. Serverpod's experimental synchronization capability for the offline-first workflow.
5. Serverpod streaming for real-time mission updates.
6. Serverpod authentication for user identity.
7. Serverpod Future Calls for scheduled escalation or reminders.
8. Serverpod code generation for shared types and client/server communication.
9. Serverpod's development workflow for rapid iteration.
10. Serverpod Cloud can be used for deployment if required.

Serverpod 4 currently supports client-side database tables and an experimental `sync` database mode, which is particularly relevant to this project. Serverpod also provides streaming methods over its managed WebSocket connection and Future Calls for delayed or scheduled server work.

**Important:** offline synchronization is currently documented as experimental in Serverpod 4.0. The project should therefore keep the offline workflow deliberately small and test it heavily instead of building a huge synchronization engine around it.

---

# 5. Target Users

BlackBox is intentionally broader than one emergency scenario.

## Primary user

### Commander / Coordinator

Responsible for:

- creating an operation
- assigning team members
- monitoring progress
- reviewing events
- resolving operational issues

## Secondary user

### Field Operator

Responsible for:

- viewing assigned work
- completing tasks
- recording observations
- reporting events
- continuing work during connectivity loss

---

# 6. Example Use Cases

## Use Case A — Campus Emergency Drill

A coordinator creates:

> Campus Building B Evacuation Drill

Tasks are assigned to field operators.

A field operator enters an area with no network.

The operator continues recording progress.

When connectivity returns, the events synchronize.

---

## Use Case B — Industrial Inspection

An inspector must inspect several areas of a facility.

The inspector downloads/synchronizes the mission before entering the facility.

During inspection, the network disappears.

The inspector continues recording:

- inspection completed
- issue found
- issue severity
- notes

The changes synchronize later.

---

## Use Case C — Event Operations

An event coordinator assigns teams to different zones.

A network outage occurs.

Teams continue reporting operational status.

Once connectivity returns, the command dashboard becomes current again.

---

# 7. Product Scope

## MVP

The first version should contain only:

1. Authentication
2. Mission creation
3. Mission dashboard
4. Team members
5. Task assignment
6. Task status changes
7. Operational event creation
8. Offline mode
9. Local pending-change handling
10. Synchronization after reconnect
11. Real-time updates
12. Mission Replay
13. Basic scheduled escalation

Everything else is optional.

---

# 8. Core Product Flow

```text
LOGIN
  |
  v
COMMAND DASHBOARD
  |
  v
CREATE MISSION
  |
  v
ADD TEAM
  |
  v
CREATE TASKS
  |
  v
ASSIGN TASKS
  |
  v
LIVE OPERATION
  |
  +-----------------------+
  |                       |
ONLINE                  OFFLINE
  |                       |
SERVERPOD                LOCAL DATA
  |                       |
REAL-TIME                PENDING EVENTS
  |                       |
  +----------+------------+
             |
             v
       NETWORK RESTORED
             |
             v
       SYNCHRONIZATION
             |
             v
       CENTRAL STATE
             |
             v
       MISSION REPLAY
```

---

# 9. Main Screens

Keep the application to approximately five primary screens.

## Screen 1 — Landing / Login

Purpose:

- introduce BlackBox
- sign in
- provide a clean first impression

Do not overload the landing page.

Suggested message:

> **Operations don't stop when connectivity does.**

Buttons:

- Sign In
- Create Account
- Demo Mode

---

## Screen 2 — Command Dashboard

This is the main screen.

Display:

- active missions
- mission severity
- team count
- completed tasks
- pending tasks
- current connectivity
- synchronization state
- latest events

Example:

```text
BLACKBOX

MISSION 042
BUILDING B EVACUATION

STATUS
ACTIVE

TEAM
8 MEMBERS

TASKS
6 TOTAL
3 COMPLETED
2 ACTIVE
1 PENDING

NETWORK
ONLINE

SYNC
UP TO DATE

LATEST EVENTS
12:42 Task completed
12:43 Zone C checked
12:44 Medical team assigned
```

---

## Screen 3 — Mission Operations

Show:

- mission information
- assigned members
- tasks
- task status
- priority
- operational events

Possible statuses:

```text
PENDING
ACTIVE
BLOCKED
COMPLETED
```

---

## Screen 4 — Offline Mode

This screen should make the core feature obvious.

Example:

```text
OFFLINE MODE

Connection unavailable.

LOCAL OPERATIONS ACTIVE

Last synchronization
12:42:31

Pending changes
03

You can continue working.
Changes will synchronize automatically.
```

The interface must not look broken.

Offline is a supported application state.

---

## Screen 5 — Mission Replay

This is the visual payoff.

Display the mission as a chronological timeline.

Example:

```text
12:40
MISSION CREATED

12:41
TEAM ASSIGNED

12:43
TASKS STARTED

12:45
NETWORK LOST

12:47
ZONE C CHECKED

12:49
3 PEOPLE FOUND

12:52
MEDICAL TEAM DISPATCHED

12:55
NETWORK RESTORED

12:55
3 EVENTS SYNCHRONIZED

12:56
MISSION STABILIZED
```

Optional controls:

- Play
- Pause
- Speed
- Jump to event

---

# 10. The Most Important Feature — Offline Operation

The offline experience is the feature that should receive the most development effort.

## Before going offline

The device should have the required mission information locally.

For example:

```text
Mission
Team
Tasks
Recent Events
Mission Status
```

## During offline operation

The user can make supported changes.

Example:

```text
Task #21
Status: COMPLETED
```

The application immediately updates its local UI.

It does not wait for the server.

## Internally

A local event is created:

```text
eventId
missionId
taskId
actorId
eventType
payload
createdAt
deviceId
syncStatus
```

Example:

```json
{
  "eventType": "TASK_COMPLETED",
  "missionId": 42,
  "taskId": 21,
  "actorId": "field-03",
  "createdAt": "2026-09-26T12:49:10Z",
  "syncStatus": "PENDING"
}
```

## After reconnection

The synchronization process sends pending changes to the server.

The server validates them.

Successful events become synchronized.

The UI changes from:

```text
PENDING SYNC
```

to:

```text
SYNCED
```

---

# 11. Event-Based Architecture

Do not model everything only as mutable state.

Use an event record for important operational actions.

Examples:

```text
MISSION_CREATED
TEAM_ASSIGNED
TASK_CREATED
TASK_STARTED
TASK_COMPLETED
TASK_BLOCKED
OBSERVATION_RECORDED
STATUS_CHANGED
MEMBER_CHECKED_IN
MEMBER_CHECKED_OUT
NETWORK_LOST
NETWORK_RESTORED
SYNC_STARTED
SYNC_COMPLETED
```

This gives the project a clean history.

It also makes Mission Replay possible.

---

# 12. Mission Replay

Mission Replay is derived from the event history.

The system does not need to record a video.

Instead, it reconstructs the operation from events.

Example:

```text
Event 1
Mission created

Event 2
Team assigned

Event 3
Task created

Event 4
Task started

Event 5
Network lost

Event 6
Task completed offline

Event 7
Observation created offline

Event 8
Network restored

Event 9
Events synchronized
```

The frontend converts this event sequence into a visual timeline.

---

# 13. Real-Time Updates

When users are online, BlackBox should feel live.

Example:

Field Operator:

```text
Zone C checked
```

The commander should receive the update without refreshing the page.

Serverpod streaming can be used for this.

Conceptually:

```text
FIELD OPERATOR
      |
      v
Serverpod Endpoint
      |
      v
Mission Event
      |
      v
Serverpod Stream
      |
      v
COMMAND DASHBOARD
```

Do not build a custom WebSocket layer if Serverpod's streaming functionality can handle the requirement.

---

# 14. Authentication

Use Serverpod's authentication capabilities rather than implementing a custom JWT system from scratch.

Roles can be handled at the application level:

```text
COMMANDER
FIELD_OPERATOR
OBSERVER
```

Example permissions:

| Action | Commander | Field Operator | Observer |
|---|---:|---:|---:|
| Create mission | Yes | No | No |
| Add team member | Yes | No | No |
| Create task | Yes | Limited | No |
| Update assigned task | Yes | Yes | No |
| Create event | Yes | Yes | No |
| View mission | Yes | Yes | Yes |
| View replay | Yes | Yes | Yes |
| Close mission | Yes | No | No |

For a solo MVP, implement only **Commander** and **Field Operator** first.

---

# 15. Data Model

Recommended core models:

## User

```text
id
name
email
role
createdAt
```

## Mission

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

## MissionMember

```text
id
missionId
userId
role
status
joinedAt
```

## Task

```text
id
missionId
title
description
priority
status
assignedTo
createdAt
dueAt
completedAt
```

## MissionEvent

```text
id
missionId
actorId
eventType
payload
createdAt
deviceId
syncStatus
```

## DeviceState

```text
deviceId
userId
lastSyncAt
connectionState
pendingChanges
```

## Alert

```text
id
missionId
type
message
severity
createdAt
resolvedAt
```

Do not create dozens of models for the MVP.

---

# 16. Database Strategy

Server-side persistent data:

```text
PostgreSQL
```

Client-side data:

```text
SQLite through Serverpod client-side database support
```

The server database represents the central authoritative mission state.

The client database represents the device's local working state and synchronized subset.

Serverpod 4 supports:

```text
database: client
database: server
database: all
database: sync
```

For the BlackBox offline experiment, evaluate the `sync` capability carefully and keep the number of synchronized tables small.

A practical first target is:

```text
Mission
Task
MissionEvent
```

Do not attempt to synchronize every possible entity.

---

# 17. Conflict Handling

Offline systems can encounter conflicting changes.

Example:

```text
Commander:
Task 12 = COMPLETED

Field Operator:
Task 12 = BLOCKED
```

If both changes happen independently, the system needs a deterministic rule.

For the MVP, use a simple strategy.

## Rule 1 — Events are immutable

Do not overwrite historical events.

## Rule 2 — Every event has:

```text
eventId
actorId
createdAt
deviceId
```

## Rule 3 — Server validates the final state

The server decides whether a state transition is allowed.

## Rule 4 — Conflicts are visible

Do not silently discard important changes.

Example:

```text
SYNC CONFLICT

Task 12

Remote:
COMPLETED

Local:
BLOCKED

Resolution:
CONFLICT FLAGGED
```

For the hackathon MVP, a visible conflict state is better than pretending distributed conflicts do not exist.

---

# 18. Connectivity Detection

The Flutter client should monitor connectivity.

States:

```text
ONLINE
OFFLINE
RECONNECTING
SYNCING
SYNCED
SYNC_ERROR
```

Important:

**Network connectivity does not necessarily mean the server is reachable.**

Therefore distinguish:

```text
DEVICE HAS NETWORK
```

from:

```text
SERVERPOD IS REACHABLE
```

The application should use a real server health/ping check before declaring the system synchronized.

---

# 19. Synchronization States

Use clear states:

```text
LOCAL
PENDING
SYNCING
SYNCED
CONFLICT
FAILED
```

Example UI:

```text
TASK COMPLETED
LOCAL CHANGE

PENDING SYNC
```

After connection:

```text
SYNCING...
```

Then:

```text
SYNCED
```

If something fails:

```text
SYNC FAILED
RETRYING
```

---

# 20. Scheduled Escalation

This is an optional but useful Serverpod feature.

Example:

A commander creates:

```text
Medical team must confirm arrival within 5 minutes.
```

Schedule a Future Call.

If the expected confirmation is not received, the server creates an escalation event.

Example:

```text
MEDICAL RESPONSE

Dispatch:
12:45

Confirmation:
NOT RECEIVED

12:50

ESCALATION TRIGGERED
```

This demonstrates that Serverpod is also being used for server-side scheduling.

Do not build a complex scheduler UI.

One fixed workflow is enough.

---

# 21. Suggested Serverpod Endpoints

Possible endpoint structure:

```text
auth
mission
task
event
sync
replay
stream
alert
```

### MissionEndpoint

```text
createMission()
getMission()
getMissions()
updateMission()
closeMission()
```

### TaskEndpoint

```text
createTask()
assignTask()
updateTaskStatus()
getTasks()
```

### EventEndpoint

```text
createEvent()
getMissionEvents()
```

### SyncEndpoint

```text
syncPendingEvents()
getSyncState()
```

### ReplayEndpoint

```text
getReplay()
```

### MissionStreamEndpoint

```text
missionUpdates()
```

### AlertEndpoint

```text
createAlert()
resolveAlert()
```

Keep the API surface small.

---

# 22. Flutter Application Structure

Suggested structure:

```text
blackbox/
│
├── blackbox_server/
│   ├── lib/
│   │   ├── src/
│   │   │   ├── endpoints/
│   │   │   │   ├── mission_endpoint.dart
│   │   │   │   ├── task_endpoint.dart
│   │   │   │   ├── event_endpoint.dart
│   │   │   │   ├── sync_endpoint.dart
│   │   │   │   ├── replay_endpoint.dart
│   │   │   │   └── stream_endpoint.dart
│   │   │   │
│   │   │   ├── future_calls/
│   │   │   │   └── escalation_call.dart
│   │   │   │
│   │   │   └── services/
│   │   │       ├── mission_service.dart
│   │   │       ├── sync_service.dart
│   │   │       └── event_service.dart
│   │   │
│   │   └── server.dart
│   │
│   └── config/
│
├── blackbox_client/
│   └── lib/
│
├── blackbox_flutter/
│   ├── lib/
│   │   ├── screens/
│   │   │   ├── login/
│   │   │   ├── dashboard/
│   │   │   ├── mission/
│   │   │   ├── offline/
│   │   │   └── replay/
│   │   │
│   │   ├── widgets/
│   │   │   ├── mission_card.dart
│   │   │   ├── task_card.dart
│   │   │   ├── event_timeline.dart
│   │   │   ├── network_indicator.dart
│   │   │   └── sync_indicator.dart
│   │   │
│   │   ├── services/
│   │   │   ├── connectivity_service.dart
│   │   │   └── sync_service.dart
│   │   │
│   │   └── main.dart
│   │
│   └── pubspec.yaml
│
└── README.md
```

The exact generated project structure may differ depending on the Serverpod 4 project template. Treat the above as the logical organization, not a requirement to fight the framework.

---

# 23. Technology Stack

## Required

### Frontend

- Flutter
- Dart

### Backend

- Serverpod 4
- Dart

### Database

- PostgreSQL
- Serverpod database layer
- Serverpod client-side database / SQLite

### Communication

- Serverpod generated client API
- Serverpod streaming

### Authentication

- Serverpod authentication module

### Scheduling

- Serverpod Future Calls

### Deployment

- Serverpod Cloud or another supported deployment path

---

# 24. What About MERN?

The original concept can be understood using MERN terminology:

```text
React       -> Flutter UI
Node/Express -> Serverpod backend
MongoDB     -> PostgreSQL
REST        -> Serverpod typed endpoints
Socket.IO   -> Serverpod streaming
localStorage/IndexedDB -> Serverpod client database
```

However, the hackathon is specifically about using Serverpod.

Therefore:

> **Do not build a MERN backend and merely mention Serverpod.**

That weakens the submission.

Use the architectural ideas you already understand from MERN, but implement the backend using Serverpod.

If you are more comfortable with React, do not waste the hackathon trying to force React into a Serverpod-first architecture unless the rules explicitly permit and support the exact integration you intend to use.

For this project, Flutter + Serverpod is the cleanest path because Serverpod's official workflow is designed around Flutter.

---

# 25. What You Need to Install

## 1. Git

Install Git and verify:

```bash
git --version
```

## 2. Flutter

Serverpod 4 currently requires:

```text
Flutter 3.44.4+
Dart 3.12.2+
```

Verify:

```bash
flutter --version
flutter doctor
```

Fix all major issues reported by:

```bash
flutter doctor
```

## 3. Dart

Dart is included with Flutter.

Verify:

```bash
dart --version
```

## 4. Serverpod CLI

Install:

```bash
dart install serverpod_cli
```

Verify:

```bash
serverpod
```

Or:

```bash
serverpod version
```

## 5. IDE

Recommended:

- VS Code
- Android Studio
- Cursor
- another Dart/Flutter-compatible IDE

Install the Serverpod extension if using VS Code.

## 6. Docker

For the simplest Serverpod 4 setup using embedded PostgreSQL, Docker may not be necessary.

If the selected project configuration uses Docker/PostgreSQL locally, install Docker Desktop.

Verify:

```bash
docker --version
```

Do not install unnecessary infrastructure before the generated project tells you it is required.

---

# 26. Creating the Project

Use Serverpod 4.

Recommended starting command:

```bash
serverpod quickstart blackbox
```

The current Serverpod 4 quickstart creates a full-stack project with a Serverpod server and Flutter application.

For a more configurable project:

```bash
serverpod create
```

Follow the interactive setup and enable the features required by the project.

---

# 27. First Setup Checklist

After installation:

```bash
flutter doctor
dart --version
serverpod version
```

Then:

```bash
serverpod quickstart blackbox
```

Move into the project:

```bash
cd blackbox
```

Start development:

```bash
serverpod start
```

The Serverpod 4 development workflow can generate code, run the server, and launch the companion Flutter application from the project.

---

# 28. Development Commands

Useful commands include:

```bash
serverpod start
```

Start development.

```bash
serverpod generate
```

Generate Serverpod code when needed outside the normal development workflow.

```bash
serverpod database start
```

Start the configured embedded PostgreSQL database separately when needed.

Migration commands should be used whenever the database schema changes according to the Serverpod workflow.

Before committing:

```bash
flutter analyze
flutter test
```

Also run the server tests where applicable.

---

# 29. Package Strategy

Do not install 40 Flutter packages.

Start with Serverpod's generated dependencies.

Only add packages when there is a clear need.

Potential additions:

```text
connectivity_plus
intl
go_router
flutter_riverpod
```

These are optional.

### Recommended principle

If Serverpod already provides the required functionality, use Serverpod.

Avoid adding:

- another backend SDK
- another WebSocket library
- another database ORM
- another authentication framework
- another synchronization library

The more external infrastructure you add, the less meaningful Serverpod becomes.

---

# 30. State Management

For a solo MVP, use a simple state-management approach.

Possible choices:

### Option A

Riverpod

Good if you already know it.

### Option B

Flutter built-in state management

Good if speed matters more than architecture.

Do not spend a full day debating state-management libraries.

---

# 31. UI Design Direction

BlackBox should look like an operations console rather than a generic mobile CRUD application.

Suggested visual direction:

### Background

Very dark neutral.

### Panels

Dark elevated surfaces.

### Primary accent

One strong accent color.

### Status colors

Use only where semantic:

```text
Green  = healthy / synced
Yellow = warning / pending
Red    = critical / conflict
Blue   = informational / active
```

### Typography

Use a clean technical font.

Possible:

```text
Inter
IBM Plex Sans
Space Grotesk
```

Use a monospace font only for:

- event IDs
- timestamps
- synchronization data
- technical status

---

# 32. Dashboard Layout

Recommended hierarchy:

```text
┌──────────────────────────────────────┐
│ BLACKBOX             ● ONLINE        │
├──────────────────────────────────────┤
│                                      │
│ MISSION 042                          │
│ Campus Emergency Drill               │
│                                      │
│ ACTIVE                               │
│                                      │
├──────────┬──────────┬────────────────┤
│ TEAM     │ TASKS    │ SYNC           │
│ 8        │ 6        │ UP TO DATE     │
├──────────┴──────────┴────────────────┤
│                                      │
│ ACTIVE OPERATIONS                    │
│                                      │
├──────────────────────────────────────┤
│ LIVE EVENT STREAM                    │
│                                      │
│ 12:42  Task completed                │
│ 12:43  Zone C checked                │
│ 12:44  Medical team assigned         │
│                                      │
└──────────────────────────────────────┘
```

---

# 33. Demo Simulation

Because this is a solo project, you do not need multiple physical devices.

Create a demo mode.

Possible simulated identities:

```text
COMMANDER
FIELD UNIT A
FIELD UNIT B
```

You can switch between them.

Example:

```text
SIMULATION DEVICE

Current identity:
FIELD UNIT A

[ Switch to Commander ]
[ Switch to Field Unit B ]
```

The actual Serverpod backend and synchronization should remain real.

Only the identities are simulated.

This allows one person to demonstrate a multi-user workflow.

---

# 34. The Killer Demo

The demo should take approximately three minutes.

## 0:00–0:20

Open BlackBox.

Say:

> "BlackBox is designed for operations where the network cannot be trusted."

Create a mission.

---

## 0:20–0:45

Assign:

- 3 team members
- 3 tasks

Show live status.

---

## 0:45–1:00

Switch to a field unit.

Complete a task.

Commander dashboard updates immediately.

This demonstrates real-time communication.

---

## 1:00–1:10

Disable network connectivity.

Do not explain it for too long.

Let the UI show:

```text
OFFLINE
LOCAL OPERATIONS ACTIVE
```

---

## 1:10–1:45

Perform several actions offline:

```text
Task completed
Observation added
Status changed
```

Show:

```text
3 PENDING CHANGES
```

---

## 1:45–2:00

Reconnect.

Show:

```text
SYNCING

3 EVENTS

SYNC COMPLETE
```

---

## 2:00–2:30

Return to commander dashboard.

The updates appear.

---

## 2:30–2:50

Open:

```text
MISSION REPLAY
```

Play the timeline.

---

## 2:50–3:00

End with:

> **"BlackBox doesn't assume the network will survive the operation. It makes sure the operation does."**

Stop.

Do not keep talking after the strongest point.

---

# 35. Architecture Demonstration

Show one architecture slide:

```text
                BLACKBOX
                    |
              FLUTTER CLIENT
                    |
        +-----------+-----------+
        |                       |
  CLIENT DATABASE          SERVERPOD
        |                       |
     OFFLINE               ENDPOINTS
        |                       |
        |                 STREAMING
        |                       |
        |                  AUTHENTICATION
        |                       |
        |                  FUTURE CALLS
        |                       |
        +-----------SYNC--------+
                    |
               POSTGRESQL
```

Explain only the important parts.

---

# 36. Testing Plan

The offline workflow is the most important test.

## Test 1 — Normal operation

```text
Login
Create mission
Create task
Assign task
Complete task
```

Expected:

Everything works.

## Test 2 — Offline operation

```text
Open mission
Disconnect network
Complete task
Create event
Change status
```

Expected:

Everything permitted locally works.

## Test 3 — Reconnection

```text
Reconnect
```

Expected:

Pending events synchronize.

## Test 4 — Duplicate submission

Simulate retry.

Expected:

The same event should not create duplicate operational records.

Use a unique event identifier / idempotency strategy.

## Test 5 — Conflict

Create two incompatible changes.

Expected:

Conflict is visible and deterministic.

## Test 6 — Authentication

Test:

- valid login
- invalid login
- unauthorized action
- logout
- expired session

## Test 7 — Stream

Two simulated users.

User A changes mission state.

User B receives the update without manual refresh.

## Test 8 — Future Call

Schedule a short test escalation.

Verify the event is created.

---

# 37. Security

Minimum security requirements:

- authentication for protected operations
- server-side authorization
- never trust role information supplied only by the client
- validate mission membership
- validate task ownership/assignment
- validate state transitions
- avoid exposing secrets in Flutter code
- use HTTPS in production
- avoid storing sensitive authentication data insecurely

For web authentication, use the secure authentication mechanisms recommended by Serverpod rather than manually placing tokens in browser storage.

---

# 38. Reliability Principles

BlackBox should follow these rules:

### Rule 1

Never silently discard a local operation.

### Rule 2

Every important operation gets an event ID.

### Rule 3

Events should be traceable to an actor.

### Rule 4

Synchronization should be retryable.

### Rule 5

The UI should show synchronization state.

### Rule 6

Conflicts should be visible.

### Rule 7

The server validates final state transitions.

---

# 39. What NOT to Build

As a solo participant, these features are dangerous scope expansion:

- AI chatbot
- computer vision
- facial recognition
- advanced GPS tracking
- complex GIS
- drone integration
- voice assistant
- biometric authentication
- complex analytics
- multi-tenant enterprise billing
- social networking
- messaging platform
- video calling
- custom cloud infrastructure
- custom WebSocket server
- custom authentication
- custom synchronization framework

If the core offline workflow is not perfect, none of these matter.

---

# 40. Stretch Goals

Only attempt these after the MVP works.

## Stretch Goal 1 — Conflict Center

A screen showing:

```text
3 synchronization conflicts
```

with clear resolution actions.

## Stretch Goal 2 — Scheduled Escalation

Use Serverpod Future Calls.

## Stretch Goal 3 — Attachments

Allow a field operator to attach a photo or document to an event.

Only add this if storage handling is already stable.

## Stretch Goal 4 — Location Metadata

Attach approximate operational location to events.

Do not turn this into a complete GPS-tracking system.

## Stretch Goal 5 — Mission Analytics

Show:

```text
Total duration
Offline duration
Tasks completed
Synchronization delay
Events recorded
```

## Stretch Goal 6 — Export

Generate an incident report from the event history.

---

# 41. Development Phases

## Phase 0 — Environment

Goal:

Get Serverpod running.

Tasks:

- install Flutter
- install Dart
- install Serverpod CLI
- create project
- run generated application
- verify database
- verify authentication

Definition of done:

```text
serverpod start
```

works successfully.

---

# Phase 1 — Authentication

Implement:

- sign up
- sign in
- sign out
- Commander
- Field Operator

Definition of done:

A user can securely access the application.

---

# Phase 2 — Mission Core

Implement:

- create mission
- list missions
- open mission
- mission status
- team members

Definition of done:

A commander can create and manage an operation.

---

# Phase 3 — Tasks

Implement:

- create task
- assign task
- task status
- priority
- completion

Definition of done:

A commander can distribute work.

---

# Phase 4 — Events

Implement:

- create event
- event type
- actor
- timestamp
- mission ID
- event history

Definition of done:

Important actions produce persistent events.

---

# Phase 5 — Real-Time

Implement:

- Serverpod stream
- mission updates
- live dashboard refresh

Definition of done:

A second simulated user sees updates without refreshing.

---

# Phase 6 — Offline

This is the highest-priority technical phase.

Implement:

- client-side database
- local mission cache
- local task data
- local event creation
- pending state
- synchronization

Definition of done:

A user can disconnect the network and continue the core workflow.

---

# Phase 7 — Replay

Implement:

- event timeline
- chronological ordering
- play/pause
- synchronization event visualization

Definition of done:

A completed mission can be reconstructed visually.

---

# Phase 8 — Future Call

Implement one scheduled escalation.

Definition of done:

A delayed server-side action creates an event or alert.

---

# Phase 9 — Polish

Fix:

- loading states
- empty states
- error messages
- offline indicators
- synchronization animations
- responsive layouts
- typography
- spacing
- accessibility
- performance

Do not redesign the application endlessly.

---

# Phase 10 — Demo Hardening

Test the exact demo sequence repeatedly.

Do not improvise the final demonstration.

Prepare:

```text
Demo account
Demo mission
Demo team
Demo tasks
Demo event history
Offline test
Reconnect test
Replay test
```

---

# 42. Definition of Done

BlackBox is ready for submission when all of these work:

## Product

- [ ] User can sign in.
- [ ] Commander can create a mission.
- [ ] Commander can add team members.
- [ ] Commander can create tasks.
- [ ] Tasks can be assigned.
- [ ] Field operator can update assigned tasks.
- [ ] Important actions create events.
- [ ] Mission dashboard shows current state.
- [ ] Real-time updates work.
- [ ] Offline mode works.
- [ ] Local changes survive temporary connectivity loss.
- [ ] Pending changes synchronize.
- [ ] Synchronization status is visible.
- [ ] Duplicate operations are prevented or safely handled.
- [ ] Conflicts are visible.
- [ ] Mission Replay works.
- [ ] At least one Future Call works if included.

## Technical

- [ ] Serverpod is the actual backend.
- [ ] Serverpod database is used.
- [ ] Serverpod generated client is used.
- [ ] Serverpod authentication is used.
- [ ] Serverpod streaming is used.
- [ ] Serverpod client-side/offline database functionality is tested.
- [ ] Serverpod Future Calls are used if included.
- [ ] No unnecessary custom backend infrastructure exists.
- [ ] No secrets are committed.
- [ ] Production configuration is separated from development configuration.

## Demo

- [ ] Network can be disconnected during the demo.
- [ ] App continues working.
- [ ] Offline changes are visible.
- [ ] Reconnection triggers synchronization.
- [ ] Commander receives synchronized updates.
- [ ] Replay shows the complete sequence.
- [ ] Demo can finish within three minutes.

---

# 43. Submission Positioning

Do not pitch BlackBox as:

> "An emergency app."

That makes the idea unnecessarily narrow.

Pitch it as:

> **A resilient operations platform for teams working in unreliable connectivity environments.**

Then use emergency response as the demonstration scenario.

This makes the architecture reusable.

---

# 44. The Problem-Solution Slide

## Problem

> Field operations often depend on network connectivity. When connectivity disappears, teams can lose access to current information or fail to submit critical updates.

## Solution

> BlackBox keeps essential mission data available locally, allows users to continue operating offline, and synchronizes recorded changes when connectivity returns.

## Differentiator

> The network outage is not treated as an application failure. It is treated as a normal operational state.

---

# 45. The Technology Slide

```text
CLIENT
Flutter + Dart

BACKEND
Serverpod 4

DATABASE
PostgreSQL

LOCAL DATABASE
Serverpod Client Database / SQLite

REAL-TIME
Serverpod Streaming

AUTH
Serverpod Authentication

SCHEDULING
Serverpod Future Calls

DEPLOYMENT
Serverpod Cloud
```

---

# 46. Why the Architecture Matters

The architecture is intentionally simple:

```text
Flutter
  |
  | typed generated client
  v
Serverpod
  |
  +---- PostgreSQL
  |
  +---- Authentication
  |
  +---- Streams
  |
  +---- Future Calls
  |
  +---- Synchronization
```

There is no need for:

```text
Flutter
+
Express
+
Node
+
MongoDB
+
Socket.IO
+
Redis
+
Firebase Auth
+
separate scheduler
+
custom sync service
```

That stack would create unnecessary integration work for a solo developer.

---

# 47. Risk Register

## Risk 1 — Offline sync is harder than expected

**Mitigation:**

Keep the synchronized model set small.

Start with:

```text
Mission
Task
MissionEvent
```

Build and test synchronization before adding other data.

---

## Risk 2 — Serverpod version changes

**Mitigation:**

Pin the project to the hackathon-tested Serverpod version and do not upgrade during the final build period.

---

## Risk 3 — Demo network failure behaves unpredictably

**Mitigation:**

Test the exact offline/reconnect workflow repeatedly.

Also prepare a fallback demo mode.

---

## Risk 4 — Scope explosion

**Mitigation:**

Follow the MVP list strictly.

If a feature does not improve the core story, postpone it.

---

## Risk 5 — Authentication consumes too much time

**Mitigation:**

Use Serverpod's built-in authentication instead of creating a custom authentication system.

---

# 48. Solo Developer Priority Order

If time becomes limited, prioritize in this exact order:

```text
1. Serverpod project runs
2. Authentication
3. Mission creation
4. Tasks
5. Events
6. Offline local operation
7. Synchronization
8. Real-time updates
9. Mission Replay
10. UI polish
11. Future Calls
12. Stretch features
```

If you reach item 8 and the application is stable, you already have a strong MVP.

Do not sacrifice synchronization to add five more features.

---

# 49. Minimum Demo Data

Prepare one realistic scenario.

### Mission

```text
Campus Building B Emergency Drill
```

### Team

```text
Commander
Field Unit A
Field Unit B
Medical Unit
```

### Tasks

```text
Evacuate Building B
Check Zone C
Secure Entrance
Medical Assessment
```

### Events

```text
Mission created
Team assigned
Evacuation started
Network lost
Zone C checked
People found
Medical dispatched
Network restored
Events synchronized
Mission stabilized
```

This is enough to demonstrate the entire product.

---

# 50. Recommended Demo Mode

Create a controlled demo environment.

Example:

```text
DEMO CONTROL

[ ONLINE ]
[ OFFLINE ]
[ RECONNECT ]

SIMULATED USER
[ COMMANDER ]
[ FIELD A ]
[ FIELD B ]

[ CREATE SAMPLE MISSION ]
[ RESET DEMO ]
```

This control should be hidden behind a developer/demo mode.

The production interface should remain clean.

---

# 51. Metrics to Display

Use real values generated from the application.

Examples:

```text
8
TEAM MEMBERS

12
TOTAL EVENTS

7
TASKS COMPLETED

03
OFFLINE EVENTS

00:07
OFFLINE DURATION

100%
SYNC SUCCESS
```

Do not invent performance numbers.

If you show a number, calculate it from the actual application state.

---

# 52. Optional Incident Report

If time allows, generate a final report containing:

```text
MISSION SUMMARY

Mission:
Campus Building B Emergency Drill

Duration:
16 minutes

Team:
8

Tasks:
6

Completed:
5

Blocked:
1

Offline duration:
3 minutes

Offline events:
3

Synchronization:
Successful

Timeline:
...
```

This is a useful extension because the same event history powers both Replay and reporting.

---

# 53. Final Product Architecture

```text
                         BLACKBOX
                            |
             +--------------+--------------+
             |                             |
        FLUTTER CLIENT                SERVERPOD 4
             |                             |
      +------+-------+            +--------+--------+
      |              |            |        |        |
 Local DB       UI State      Endpoints  Streams  Future Calls
      |                           |        |        |
      |                           +--------+--------+
      |                                    |
      +----------- Synchronization --------+
                                           |
                                      PostgreSQL
                                           |
                                    Mission History
```

---

# 54. Final Concept

BlackBox is not fundamentally about emergency management.

It is about **resilient software**.

The emergency scenario simply makes the problem easy to understand.

The real product principle is:

> **A temporary loss of connectivity should not cause a permanent loss of operational state.**

BlackBox therefore combines:

```text
OFFLINE-FIRST
+
REAL-TIME
+
EVENT HISTORY
+
SYNCHRONIZATION
+
SCHEDULED OPERATIONS
+
SECURE AUTHENTICATION
```

into one focused full-stack application.

---

# 55. Final Pitch

### Short pitch

> **BlackBox is an offline-first operations platform for teams working in unreliable connectivity environments. Teams can create missions, assign tasks, record events, and continue operating even after the network disappears. Local changes are synchronized automatically when connectivity returns, while Serverpod streams provide real-time updates when online. Every important action becomes an event, allowing the entire operation to be replayed afterward.**

### 10-second version

> **BlackBox keeps operations running when the internet stops, then synchronizes and reconstructs everything when it comes back.**

### Closing line

> **The network can fail. The operation shouldn't.**

---

# 56. Build Rule

The single most important development rule for this project:

> **Do not build more features until the offline → reconnect → synchronize → replay workflow works reliably.**

The hackathon demo should prove that workflow rather than merely describe it.

---

# 57. Current Serverpod Setup Reference

The implementation plan above is based on Serverpod 4 documentation available at the time this document was prepared.

Current Serverpod 4 documentation states that Flutter 3.44.4 or later is required, with Dart 3.12.2 included. The Serverpod CLI is installed through Dart using `dart install serverpod_cli`. The official quickstart uses `serverpod quickstart <project-name>`, and `serverpod start` runs the development stack.

Serverpod 4 also documents:

- client-side database tables backed by SQLite
- experimental synchronized tables
- managed WebSocket streaming
- built-in authentication
- Future Calls
- embedded PostgreSQL for local development
- Serverpod Cloud deployment

Because Serverpod 4's offline synchronization is currently experimental, treat synchronization as the highest-risk technical component and validate it before building the rest of the application.

---

# 58. Final Checklist Before Submission

## Environment

- [ ] Flutter installed
- [ ] Dart available
- [ ] Serverpod CLI installed
- [ ] Git installed
- [ ] IDE configured
- [ ] Docker installed only if required
- [ ] Serverpod project runs

## Backend

- [ ] Serverpod endpoints
- [ ] Database
- [ ] Authentication
- [ ] Streaming
- [ ] Synchronization
- [ ] Future Call if included

## Frontend

- [ ] Login
- [ ] Dashboard
- [ ] Mission
- [ ] Tasks
- [ ] Offline state
- [ ] Sync state
- [ ] Replay

## Reliability

- [ ] Offline test
- [ ] Reconnection test
- [ ] Duplicate test
- [ ] Conflict test
- [ ] Authentication test
- [ ] Stream test

## Presentation

- [ ] Problem explained in 20 seconds
- [ ] Solution explained in 20 seconds
- [ ] Live operation shown
- [ ] Network disconnected
- [ ] Offline operation shown
- [ ] Reconnection shown
- [ ] Synchronization shown
- [ ] Replay shown
- [ ] Serverpod architecture explained
- [ ] No unnecessary features demonstrated

---

# 59. Final Definition

**BlackBox is complete when a judge can watch the following happen without explanation:**

```text
MISSION CREATED
      ↓
TEAM ASSIGNED
      ↓
LIVE UPDATE
      ↓
NETWORK DISCONNECTED
      ↓
WORK CONTINUES
      ↓
LOCAL EVENTS RECORDED
      ↓
NETWORK RESTORED
      ↓
SERVERPOD SYNCHRONIZES
      ↓
COMMANDER RECEIVES UPDATES
      ↓
MISSION REPLAYED
```

That is the product.

Everything else is secondary.
