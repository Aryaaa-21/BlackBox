# BLACKBOX — Resilient Operations Platform

> **Offline-First Mission Coordination & Tactical Operations**  
> *"The network can fail. The operation shouldn't."*

---

## 1. Executive Summary & What BlackBox Is

**BlackBox** is a resilient, offline-first operational platform engineered to keep command centers and field operatives coordinated in environments where network connectivity is intermittent, degraded, or completely severed.

Unlike traditional web applications that stall, show blocking spinners, or drop mutations when connectivity drops, BlackBox treats **OFFLINE as a first-class operational state**. Users remain inside the application, tasks continue to transition, operational logs are appended to local IndexedDB storage, mutations queue deterministically, and upon reconnection the Phase 7 synchronization engine resolves divergences with full forensic audit replay.

---

## 2. Core Architecture & Operational Lifecycle

```
ONLINE (Socket.IO Stream)
   │
   ▼ [Network Severed / Simulated Offline]
OFFLINE OPERATIONS (IndexedDB Cache + Client State Machine)
   │  • Tasks execute locally
   │  • Local MissionEvents appended
   │  • Mutation Queue records pending actions
   │
   ▼ [Network Restored]
PUSH SYNCHRONIZATION (Phase 7 Sync Engine)
   │  • Batches queued mutations to /api/v1/sync
   │  • Server validates against MongoDB & emits live room broadcasts
   │  • Detects upstream conflicts (e.g., remote server override)
   │
   ▼ [Conflict Detected]
EXPLICIT CONFLICT RESOLUTION
   │  • Side-by-side visual diff (Local Offline vs. Server State)
   │  • Operator selects "Keep My Change" or "Keep Server"
   │
   ▼
FORENSIC MISSION REPLAY
      • Reconstructs exact second-by-second historical operational state
```

---

## 3. Technology Stack

### Frontend
- **Framework & Language:** React 18, TypeScript, Vite
- **Styling:** Vanilla Tailwind CSS with custom BlackBox dark cyber-tactical design system
- **State Management:** Zustand (reactive, normalized stores for missions, tasks, team, replay, offline, and connectivity)
- **Local Storage:** IndexedDB (via Dexie-compatible indexed database) for missions, tasks, members, events, and mutation queue
- **Networking:** Axios with request/response interceptors & token injection
- **Real-Time Stream:** Socket.IO Client (room-based dispatching)
- **PWA:** Vite PWA Plugin (`vite-plugin-pwa`) with offline service worker precaching and manifest

### Backend
- **Runtime:** Node.js (v20+ / v24)
- **Server Framework:** Express.js + TypeScript
- **Database:** MongoDB (v7+) with Mongoose schemas
- **Authentication:** JSON Web Tokens (JWT) + `bcryptjs` password hashing
- **Validation:** Zod schemas for all request payloads
- **Real-Time Engine:** Socket.IO Server with operational mission rooms
- **Security:** Helmet, CORS, sanitized error handlers, and isolated demo endpoints

---

## 4. Environment Variables

### Backend Configuration (`server/.env`)
```bash
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/blackbox
JWT_SECRET=super-secret-blackbox-tactical-jwt-key-2026
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
ENABLE_DEMO_MODE=true
```

### Frontend Configuration (`client/.env`)
```bash
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
VITE_ENABLE_DEMO_MODE=true
```

---

## 5. How to Run Locally

### 1. Start MongoDB
Ensure MongoDB is running locally on port 27017:
```bash
mongod
# Or using Docker:
docker run -d -p 27017:27017 --name blackbox-mongo mongo:7
```

### 2. Install Dependencies & Build Backend
```bash
cd server
npm install
npm run build
npm run dev
```
The server will start on `http://localhost:5000`.

### 3. Install Dependencies & Start Frontend
```bash
cd ../client
npm install
npm run dev
```
Open your browser to `http://localhost:5173`.

---

## 6. How to Run Automated Tests

The backend test suite covers all Phase 1 through Phase 9 functionality (Authentication, Mission Lifecycle, Team Roster, Task State Machine, Real-Time Socket Events, Sync Engine, Conflict Resolution, Mission Replay, and Demo Mode):

```bash
cd server
npm run test
```
**Current Test Status:** `230 PASSED, 0 FAILED`

To build both client and server for production verification:
```bash
# Server build
cd server && npm run build

# Client build
cd ../client && npm run build
```

---

## 7. Hackathon Demo Guide & Feature Scenarios

BlackBox features a built-in **Phase 9 Demo HUD** (floating tab at the bottom right) designed for presentation to evaluators. It exercises **real backend endpoints, real IndexedDB, real Socket.IO, and real MongoDB** (no fake state).

### Step 1: Initialize / Reset Demo
Click the floating **`DEMO HUD`** button in the bottom right corner and select:
**`[ ↺ Reset Demo Environment ]`** $\to$ **`Confirm Demo Reset`**.
- Resets demo database cleanly.
- Seeds the standard mission: **Campus Emergency Operations**.
- Creates 4 pre-configured users (Commander Marcus Cole, Operator Arjun Mehta, Operator Priya Sharma, Operator Rahul Sen).
- Seeds 5 realistic tasks and 14 historical MissionEvents.
- Automatically authenticates as Commander Marcus Cole.

### Step 2: Demonstrate Real-Time Operations (ONLINE)
- View the active mission with its 5 tasks, team roster, and live activity feed.
- Notice the top-right connectivity pill: **`LIVE`** with RTT latency telemetry.

### Step 3: Demonstrate Complete Network Loss (OFFLINE)
- In the **DEMO HUD**, click **`[ ✕ Simulate Offline ]`**.
- The top banner turns red: **`OFFLINE MODE: No network connection detected`**.
- The connectivity indicator updates to **`OFFLINE`** and Socket.IO disconnects.
- Navigate to task **`Inspect Main Gate`** and click **`COMPLETE`**.
- The task completes immediately in IndexedDB, and displays a pulsing **`PENDING SYNC`** badge.
- Refresh the browser (`F5`): The task remains completed and the mutation remains queued in IndexedDB.

### Step 4: Demonstrate Push Synchronization (RECONNECT)
- In the **DEMO HUD**, click **`[ ⚡ Restore Network (Sync) ]`**.
- Sockets reconnect; the Phase 7 sync engine automatically dispatches queued mutations to `POST /api/v1/sync`.
- The server updates MongoDB, writes a `TASK_COMPLETED` MissionEvent, and acknowledges the mutation.
- The task badge flips to **`SYNCED`**, and the Sync Status Panel shows **`All changes synced`**.

### Step 5: Demonstrate Conflict Detection & Resolution
- In the **DEMO HUD**, click **`[ ⚡ Trigger Conflict ]`**.
- The server diverges the task upstream to `BLOCKED` with an emergency reason.
- Upon synchronization, the Phase 7 sync engine detects version divergence and presents the **`ConflictDialog`**:
  - **Your Offline Change:** `COMPLETED`
  - **Current Server State:** `BLOCKED`
- Click **`Keep My Change →`**.
- The client dispatches resolution to `/api/v1/sync/conflicts/:id/resolve`, applying `COMPLETED` and logging `CONFLICT_RESOLVED`.

### Step 6: Demonstrate Forensic Mission Replay
- Click the prominent **`View Replay`** button on the mission header.
- The **Mission Replay Workspace** displays the complete chronological event stream:
  - Timeline scrubber with play/pause (`Space`), step forward (`Right Arrow`), step backward (`Left Arrow`).
  - Reconstructed state panel showing task states and team status at any exact millisecond.
  - Event telemetry details with actor identities and payloads.

---

## 8. Demo Runbook Reference

For a live presentation runbook with exact presenter script timings, refer to:  
[`docs/DEMO_RUNBOOK.md`](file:///c:/Users/Arya%20Bhagat/Desktop/BlackBox/docs/DEMO_RUNBOOK.md)

---

## 9. Security & Production Safeguards

- **Isolated Demo Mode:** Demo accounts and missions use the dedicated `@demo.blackbox.internal` namespace. Resetting demo data never affects regular users.
- **Environment Gate:** In production environments (`ENABLE_DEMO_MODE=false`), demo endpoints (`/api/v1/demo/*`) are completely disabled and return `403 DEMO_MODE_DISABLED`.
- **Zero Sensitive Data Leaks:** Password hashes, JWT secrets, and connection strings are excluded from API payloads, IndexedDB, and client builds.
