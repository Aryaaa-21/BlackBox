# BlackBox — Feature List

> **"The network can fail. The operation shouldn't."**

---

## 🏗️ Core Architecture Features

| Feature | Priority | Status |
|---|---|---|
| Offline-First Architecture | 🔴 Critical | Planned |
| Serverpod 4 Backend | 🔴 Critical | Planned |
| Flutter + Dart Client | 🔴 Critical | Planned |
| PostgreSQL (Server DB) | 🔴 Critical | Planned |
| SQLite / Serverpod Client DB (Local DB) | 🔴 Critical | Planned |
| Serverpod Code Generation (shared types) | 🔴 Critical | Planned |

---

## 🔐 Authentication & Authorization

| Feature | Description |
|---|---|
| **Sign Up** | New user registration via Serverpod auth |
| **Sign In** | Secure login via Serverpod auth |
| **Sign Out** | Session termination |
| **Role: Commander** | Full control – create missions, assign team, manage tasks |
| **Role: Field Operator** | Limited – view & update assigned tasks, record events |
| **Role: Observer** *(stretch)* | Read-only view of mission state |
| **Server-side Authorization** | Validate permissions on every endpoint |
| **Session Management** | Secure token handling, no secrets in Flutter code |

---

## 🗺️ Mission Management

| Feature | Description |
|---|---|
| **Create Mission** | Title, description, location, severity, status |
| **List Missions** | View active/past missions on command dashboard |
| **Open Mission** | Drill into mission details |
| **Mission Status** | `ACTIVE`, `COMPLETED`, `CLOSED` |
| **Close Mission** | Commander finalizes the operation |
| **Mission Severity** | Priority/danger level indicator |

---

## 👥 Team Management

| Feature | Description |
|---|---|
| **Add Team Members** | Commander adds users to a mission |
| **Member Roles** | Per-mission role assignment |
| **Member Status** | Checked in / checked out state |
| **Member Check-In / Check-Out** | Field operators log presence |

---

## ✅ Task Management

| Feature | Description |
|---|---|
| **Create Task** | Title, description, priority, due date |
| **Assign Task** | Link task to a field operator |
| **Task Statuses** | `PENDING` → `ACTIVE` → `BLOCKED` / `COMPLETED` |
| **Task Priority** | Low / Medium / High / Critical |
| **Update Task Status** | Field operators change status of assigned tasks |
| **Task Completion** | Mark task done, creates a `TASK_COMPLETED` event |

---

## 📋 Operational Events

| Feature | Description |
|---|---|
| **Event Creation** | Any important action produces a logged event |
| **Event Types** | `MISSION_CREATED`, `TEAM_ASSIGNED`, `TASK_CREATED`, `TASK_STARTED`, `TASK_COMPLETED`, `TASK_BLOCKED`, `OBSERVATION_RECORDED`, `STATUS_CHANGED`, `MEMBER_CHECKED_IN`, `MEMBER_CHECKED_OUT`, `NETWORK_LOST`, `NETWORK_RESTORED`, `SYNC_STARTED`, `SYNC_COMPLETED` |
| **Event Metadata** | `eventId`, `missionId`, `actorId`, `deviceId`, `createdAt`, `syncStatus` |
| **Immutable History** | Events are never overwritten, only appended |
| **Observation Recording** | Field operators log free-text observations |

---

## 📡 Real-Time Updates (Online Mode)

| Feature | Description |
|---|---|
| **Serverpod Streaming** | Live push of mission updates to connected clients |
| **Live Dashboard Refresh** | Commander sees field updates without manual refresh |
| **Live Event Feed** | Scrolling event stream on dashboard |
| **Connectivity Indicator** | `ONLINE` / `OFFLINE` / `RECONNECTING` badge |

---

## 📴 Offline Mode (Core Differentiator)

| Feature | Description |
|---|---|
| **Connectivity Detection** | Distinguishes "device has network" vs "server is reachable" |
| **Local Mission Cache** | Mission + tasks + events pre-cached locally |
| **Offline Task Completion** | Complete tasks without server connection |
| **Offline Event Creation** | Observations & status changes queued locally |
| **Offline Status Changes** | Allowed status transitions work without network |
| **Pending Change Counter** | "3 PENDING CHANGES" visible UI indicator |
| **Offline Mode Screen** | Dedicated screen — "LOCAL OPERATIONS ACTIVE" |
| **Last Sync Timestamp** | Shows when data was last synced |
| **No Broken UI** | Offline is a supported state, not an error |

---

## 🔄 Synchronization

| Feature | Description |
|---|---|
| **Auto-Sync on Reconnect** | Pending events sent to server automatically |
| **Sync States** | `LOCAL` → `PENDING` → `SYNCING` → `SYNCED` / `CONFLICT` / `FAILED` |
| **Idempotent Events** | Same event ID never creates duplicate records |
| **Retry on Failure** | Failed syncs are retried |
| **Server Validation** | Server validates state transitions before accepting |
| **Sync Status UI** | Visual indicator of sync progress |
| **Conflict Detection** | Conflicting offline changes flagged, not silently discarded |
| **Conflict Visibility** | "SYNC CONFLICT — Task 12: Remote = COMPLETED, Local = BLOCKED" |

---

## 🎬 Mission Replay

| Feature | Description |
|---|---|
| **Chronological Event Timeline** | Replay entire mission from event log |
| **Play / Pause** | Animated timeline playback |
| **Speed Control** | Slow/normal/fast replay |
| **Jump to Event** | Seek to specific timeline event |
| **Sync Event Visualization** | Shows when network lost/restored/synced |
| **Event-Driven Reconstruction** | No video recording needed — events rebuild the story |

---

## ⏰ Scheduled Escalation (Serverpod Future Calls)

| Feature | Description |
|---|---|
| **Task Response Deadline** | Commander sets confirmation window (e.g. 5 min) |
| **Escalation Trigger** | If no confirmation received, server auto-creates alert |
| **Escalation Event** | `ESCALATION_TRIGGERED` appears in event history |
| **Alert Model** | `id`, `missionId`, `type`, `message`, `severity`, `createdAt`, `resolvedAt` |

---

## 🖥️ Application Screens

| Screen | Purpose |
|---|---|
| **1. Landing / Login** | Sign in, create account, demo mode |
| **2. Command Dashboard** | Mission overview, live event feed, team/task stats |
| **3. Mission Operations** | Tasks, members, events, status management |
| **4. Offline Mode** | Clear offline state, pending changes, last sync |
| **5. Mission Replay** | Interactive timeline playback |

---

## 🎮 Demo / Dev Mode

| Feature | Description |
|---|---|
| **Demo Mode** | Pre-seeded mission data for presentations |
| **Simulated Identities** | Switch between Commander / Field A / Field B |
| **Online/Offline Toggle** | Manually trigger connectivity simulation |
| **Reset Demo** | Wipe and recreate demo data |
| **Sample Mission** | "Campus Building B Emergency Drill" pre-loaded |

---

## 📊 Metrics Display

| Metric | Description |
|---|---|
| Team Members | Active participants in mission |
| Total Events | All recorded operational events |
| Tasks Completed | Completed vs total |
| Offline Events | Changes recorded while disconnected |
| Offline Duration | Total time spent in offline mode |
| Sync Success Rate | Percentage of syncs completed successfully |

---

## 🎯 Stretch Goals (Post-MVP)

| Feature | Priority |
|---|---|
| Conflict Resolution Center screen | ⭐ High |
| Scheduled Escalation full UI | ⭐ High |
| Photo/file attachment to events | 🟡 Medium |
| Location metadata on events | 🟡 Medium |
| Mission Analytics screen | 🟡 Medium |
| Incident Report export (PDF/text) | 🟢 Low |
| Observer role | 🟢 Low |

---

## ❌ Explicitly Out of Scope

- AI chatbot / computer vision
- GPS tracking / complex GIS
- Drone integration / voice assistant
- Biometric authentication
- Video calling / social networking
- Custom WebSocket server
- Custom authentication system
- Custom synchronization framework
- Multi-tenant billing
- Complex analytics dashboards

---

> **The single rule:** Do not build more features until the  
> **offline → reconnect → synchronize → replay** workflow works reliably.
