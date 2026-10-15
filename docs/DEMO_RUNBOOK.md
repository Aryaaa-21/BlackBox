# BLACKBOX // PHASE 9 DEMO RUNBOOK
## Hackathon Live Demonstration & Presentation Script

> **Core Principle:** *"The network can fail. The operation shouldn't."*

This runbook provides the exact, foolproof step-by-step procedure for demonstrating BlackBox to hackathon evaluators and judges. The entire demo exercises **real MongoDB, real IndexedDB, real Socket.IO, real mutation queues, and the real Phase 7 sync engine** (zero fake state).

---

## 1. PRE-DEMO CHECKLIST & PREREQUISITES

### Services
1. **MongoDB**: Running locally or via connection URI.
   ```bash
   mongod
   # OR docker run -d -p 27017:27017 --name blackbox-mongo mongo:7
   ```
2. **Backend**:
   ```bash
   cd server
   npm run build
   npm run dev
   # Server listens on http://localhost:5000 (API at http://localhost:5000/api/v1)
   ```
3. **Frontend**:
   ```bash
   cd client
   npm run dev
   # Client runs at http://localhost:5173
   ```

### Demo Mode Environment
Ensure the backend has demo mode enabled (default is `true` in development):
- In `server/.env`: `ENABLE_DEMO_MODE=true`
- In `client/.env`: `VITE_ENABLE_DEMO_MODE=true`

---

## 2. THE 3-MINUTE PRESENTATION SCRIPT

### [00:00 - 00:30] Introduction & Value Proposition
1. Open browser to **`http://localhost:5173`**.
2. **Presenter Statement:**
   > *"BlackBox is an offline-first operations platform designed for contested, remote, or degraded environments where connectivity cannot be guaranteed. In disaster relief or emergency response, losing the network shouldn't mean losing the mission."*
3. Point out the operational Landing Page:
   - Resilient Operations Platform branding
   - Live Connectivity indicator in the top right
   - Click the cyan **`ENTER OPERATIONS (DEMO)`** button (or click **DEMO HUD** $\to$ **Reset Demo Environment**).
4. System automatically resets the demo database cleanly and drops into the command console.

---

### [00:30 - 01:00] Operational Baseline & Real-Time Sync
1. Open the demo mission: **`Campus Emergency Operations`**.
2. Point out the operational layout:
   - **Mission Header**: Status (`ACTIVE`), Severity (`HIGH`), Location (`Narula Institute Campus`).
   - **Operational Team**: Commander Marcus Cole, Field Operators (Arjun Mehta, Priya Sharma, Rahul Sen).
   - **Active Tasks**: 5 realistic tasks with priorities and statuses.
   - **Live Activity Feed**: Historical events already present.
   - **Persistent Connectivity**: Shows `LIVE` in green with real-time RTT latency.
3. **Presenter Statement:**
   > *"Everything is currently connected. Command centers and field operatives are collaborating over Socket.IO."*

---

### [01:00 - 01:45] Simulating Network Loss & Offline-First Execution
1. Open the floating **DEMO HUD** (bottom-right tab) and click:
   - **`[ ✕ Simulate Offline ]`**
2. Observe immediate UI reaction:
   - Top banner switches to: **`OFFLINE MODE: No network connection detected. Operating in local-resilience mode.`**
   - Connectivity badge switches to: **`OFFLINE`** (red indicator).
   - Socket.IO stream disconnects.
3. **Presenter Statement:**
   > *"The network is gone, but the operation continues. Field operators are never locked out."*
4. Find the task **`Inspect Main Gate`** (currently `ACTIVE`):
   - Click the green **`COMPLETE`** button.
5. **Observe immediate local execution:**
   - Task immediately flips to **`COMPLETED`**.
   - A pulsing amber badge appears on the task: **`PENDING SYNC`**.
   - Activity feed records the action with a **`Pending Sync`** tag.
   - DEMO HUD counter updates to: **`1 Q`** (1 pending mutation stored in browser IndexedDB).
6. **Hard Refresh the Browser** (`F5` or `Ctrl+R`):
   - When the page reloads, BlackBox loads all state directly from local IndexedDB cache.
   - The task remains **`COMPLETED`**.
   - The mutation is still safely queued in the IndexedDB mutation queue.
7. **Presenter Statement:**
   > *"Even if the device loses power or the tab is closed, offline mutations are preserved in browser storage."*

---

### [01:45 - 02:15] Reconnection & Push Synchronization
1. Open the **DEMO HUD** and click:
   - **`[ ⚡ Restore Network (Sync) ]`**
2. **Observe automatic Phase 7 sync engine execution:**
   - Connectivity indicator shifts: `OFFLINE` $\to$ `SYNCING` $\to$ `LIVE`.
   - Socket.IO reconnects.
    - Sync engine automatically batches the offline mutation to `/api/v1/sync`.
   - Server validates state machine, updates MongoDB, writes immutable `TASK_COMPLETED` MissionEvent.
   - Server acknowledges mutation; IndexedDB removes item from queue.
   - Task badge flips from `PENDING SYNC` to **`SYNCED`** (emerald).
   - Sync Panel reports: **`All changes synced`**.
3. **Presenter Statement:**
   > *"The connection returned, the sync engine validated the mutation, updated the central database, and reconciled local state without human intervention."*

---

### [02:15 - 02:45] Intentional Conflict Demonstration & Explicit Resolution
1. **Presenter Statement:**
   > *"What happens when operations diverge while offline? BlackBox doesn't silently discard work. It makes conflicts visible and actionable."*
2. While offline or before an update:
   - Click **DEMO HUD** $\to$ **`[ ⚡ Trigger Conflict ]`**.
   - *Backend divergence:* Server directly updates task `Inspect Main Gate` to `BLOCKED` with an emergency security lockout reason.
3. As the local client reconnects or performs an update, the Phase 7 sync engine detects a version and status divergence (`task.updatedAt > mutation.baseUpdatedAt`).
4. **The `ConflictDialog` pops up on screen:**
   - Displays side-by-side comparison:
     - **Your Offline Change**: `COMPLETED`
     - **Current Server State**: `BLOCKED` (Reason: Emergency security lockout)
   - Offers explicit resolution choices:
     - `[ ← Keep Server ]`
     - `[ Keep My Change → ]`
5. Click **`Keep My Change →`**.
6. The client calls `/api/v1/sync/conflicts/:id/resolve`, the server validates and applies `COMPLETED`, records a `CONFLICT_RESOLVED` event, and the conflict dismisses.

---

### [02:45 - 03:00] Forensic Mission Replay & Conclusion
1. In the Mission Header, click the prominent **`View Replay`** button (or click **DEMO HUD** $\to$ **`▶ Open Replay`**).
2. The **Mission Replay Workspace** opens:
   - Clearly marked: **`HISTORICAL REPLAY MODE // READ ONLY`**.
   - Shows the complete chronological timeline reconstructed from immutable `MissionEvents`.
   - Events displayed:
     1. Mission Created
     2. Mission Started
     3. Team Assigned
     4. Tasks Created & Assigned
     5. Offline Task Status Transitions
     6. Server Divergence (Task Blocked)
     7. Conflict Resolution
     8. Final Operational State
3. Press **`Space`** or click **`Play`** to watch the scrubber reconstruct the past state second-by-second.
4. **Presenter Closing Statement:**
   > *"From initial dispatch to offline execution, automatic sync, visible conflict resolution, and post-mission audit replay—BlackBox ensures that:*
   >
   > ***The network can fail. The operation shouldn't.***
   >
   > *Thank you. We are ready for your questions."*

---

## 3. DEMO RESET & RECOVERY

If anything unexpected occurs or you wish to restart the demo from scratch:
1. Click **DEMO HUD** $\to$ **`[ ↺ Reset Demo Environment ]`**.
2. Click **`Confirm Demo Reset`**.
3. In under 1 second:
   - Server wipes demo records.
   - Re-seeds fresh "Campus Emergency Operations" mission, 4 users, and 5 tasks.
   - Clears local IndexedDB queue and conflicts.
   - Automatically re-authenticates as Commander Marcus Cole.
   - Re-navigates to the fresh demo mission.
