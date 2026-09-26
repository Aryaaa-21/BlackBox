# BLACKBOX — Resilient Operations Platform

> **Offline-First Mission Coordination & Tactical Web Operations**  
> *When the network fails, the operation continues.*

---

## 1. Executive Summary & What BlackBox Is

**BlackBox** is a high-reliability, offline-first operations platform engineered to keep distributed teams, command centers, and field personnel coordinated in environments where network connectivity is intermittent, degraded, or completely severed.

Unlike standard CRUD web dashboards that fail or block users whenever an API request times out, BlackBox treats **OFFLINE as a first-class operational state**. Users remain inside the application, queue tactical actions locally, and synchronize deterministically once upstream connectivity is restored.

---

## 2. Core Operational Concept

The BlackBox architecture centers around four operational modes:

| Phase | Operational Mode | Architectural Behavior |
| :--- | :--- | :--- |
| **01** | **ONLINE** | Full bidirectional coordination, live telemetry, and low-latency Socket.IO event streaming. |
| **02** | **OFFLINE** | Zero modal interruptions. The operator continues local workflows; mutations are staged locally in high-integrity storage. |
| **03** | **RECONNECT** | Staged mutations are dispatched to the server; conflicts are resolved deterministically; state reconciles. |
| **04** | **REPLAY** | Chronological event logs allow mission reconstruction, timeline scrubber reviews, and post-mission debriefing. |

---

## 3. Technology Stack

### Frontend
- **Framework & Tooling:** React 18, TypeScript, Vite
- **Routing:** React Router v6
- **Styling:** Vanilla Tailwind CSS with custom BlackBox dark monochromatic operational design system
- **State Management:** Zustand (lightweight, reactive, normalized stores)
- **Networking:** Axios with global request/response interceptors & token injection
- **Real-Time Stream:** Socket.IO Client
- **Icons:** Lucide React
- **PWA:** Vite PWA Plugin (`vite-plugin-pwa`) with offline service worker precaching and web manifest

### Backend
- **Runtime:** Node.js (v20+ / v24)
- **Server Framework:** Express.js + TypeScript
- **Database ORM:** Mongoose (MongoDB 7+)
- **Authentication:** JSON Web Tokens (JWT) + `bcryptjs` password hashing (salt rounds: 10)
- **Validation:** Zod schemas
- **Real-Time Communication:** Socket.IO Server
- **Security:** Helmet (secure HTTP headers), CORS, sanitized error handlers
- **Logging:** Morgan

---

## 4. Monorepo Architecture & Folder Structure

BlackBox is structured as a clean, unified monorepo:

```text
blackbox/
│
├── client/                               # Frontend Web Application (React + Vite)
│   ├── public/                           # Static assets, PWA icons, favicon
│   ├── src/
│   │   ├── assets/                       # UI assets and graphics
│   │   ├── components/                   # Reusable UI components
│   │   │   ├── AppShell/                 # Sidebar, Topbar, navigation
│   │   │   ├── Common/                   # LoadingState, EmptyState, ErrorState
│   │   │   └── Connectivity/             # ConnectivityIndicator, OfflineBanner
│   │   ├── hooks/                        # Custom React hooks (useConnectivity)
│   │   ├── layouts/                      # AppShell layout with responsive drawers
│   │   ├── pages/                        # Landing, Login, Register, Dashboard, Missions, Settings, 404
│   │   ├── routes/                       # AppRoutes, ProtectedRoute
│   │   ├── services/                     # Axios API client, Socket.IO client
│   │   ├── store/                        # Zustand stores (authStore, connectivityStore, appStore)
│   │   ├── types/                        # Domain models, auth, and connectivity types
│   │   ├── App.tsx                       # Root React component
│   │   ├── index.css                     # Tailwind CSS and operational theme variables
│   │   ├── main.tsx                      # DOM entrypoint
│   │   └── vite-env.d.ts                 # Vite environment definitions
│   ├── index.html                        # HTML5 shell
│   ├── package.json                      # Frontend dependencies & scripts
│   ├── postcss.config.js                 # PostCSS Tailwind processor
│   ├── tailwind.config.js                # Custom BlackBox operational color tokens
│   ├── tsconfig.json                     # TypeScript client configuration
│   └── vite.config.ts                    # Vite bundler & PWA plugin setup
│
├── server/                               # Backend API & Real-Time Engine (Express + TS)
│   ├── src/
│   │   ├── config/                       # database.ts, env.ts
│   │   ├── controllers/                  # auth.controller.ts, health.controller.ts
│   │   ├── middleware/                   # auth.middleware.ts, error.middleware.ts, validate.middleware.ts
│   │   ├── models/                       # User.ts, Mission.ts (Mongoose)
│   │   ├── routes/                       # index.ts, auth.routes.ts, health.routes.ts
│   │   ├── services/                     # auth.service.ts
│   │   ├── sockets/                      # socket.ts (Socket.IO server)
│   │   ├── tests/                        # runTests.ts (backend integration test suite)
│   │   ├── types/                        # Server interfaces, roles, API responses
│   │   ├── utils/                        # jwt.ts, response.ts
│   │   ├── validators/                   # auth.validator.ts (Zod)
│   │   ├── app.ts                        # Express application factory
│   │   └── server.ts                     # HTTP + Socket.IO server bootstrap
│   ├── package.json                      # Server dependencies & scripts
│   ├── tsconfig.json                     # Server TypeScript configuration
│   ├── .env.example                      # Server environment template
│   └── .env                              # Server environment configuration
│
├── docs/                                 # Reference documentation & specifications
├── docker-compose.yml                    # Local MongoDB 7.0 container configuration
├── package.json                          # Root workspace runner (concurrently)
├── .gitignore                            # Monorepo ignore rules
└── README.md                             # Project manual
```

---

## 5. Environment Configuration

### Backend (`server/.env`)
Create `server/.env` based on `server/.env.example`:

```ini
PORT=5000
MONGODB_URI=mongodb://localhost:27017/blackbox
JWT_SECRET=blackbox_dev_jwt_secret_phase1_resilient_operations_2026
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
NODE_ENV=development
```

### Frontend (`client/.env`)
Create `client/.env` based on `client/.env.example`:

```ini
VITE_API_URL=http://localhost:5000/api/v1
VITE_SOCKET_URL=http://localhost:5000
```

---

## 6. Database Setup

### Option A: Local MongoDB Service
If you have MongoDB installed locally as a service on port 27017:
```bash
# Verify connection
mongosh "mongodb://localhost:27017/blackbox"
```

### Option B: Docker Compose
```bash
docker compose up -d
```

### Option C: Automated In-Memory Fallback (Built-In)
If no MongoDB instance is detected at `MONGODB_URI` during development or testing, BlackBox automatically boots an ephemeral in-memory MongoDB server (`mongodb-memory-server`) to ensure developer onboarding works with zero friction.

---

## 7. Installation & Quick Start

From the root directory:

```bash
# 1. Install root, server, and client dependencies
npm install
cd server && npm install
cd ../client && npm install
cd ..

# 2. Run both Client and Server concurrently
npm run dev
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:5000](http://localhost:5000)
- **Healthcheck:** [http://localhost:5000/api/v1/health](http://localhost:5000/api/v1/health)

---

## 8. Root Development Commands

| Command | Action |
| :--- | :--- |
| `npm run dev` | Starts both React Vite dev server and Express Nodemon server simultaneously via `concurrently`. |
| `npm run client` | Starts only the Vite frontend development server at `http://localhost:5173`. |
| `npm run server` | Starts only the Express backend development server at `http://localhost:5000`. |
| `npm run build` | Compiles both server TypeScript (`tsc`) and bundles the client with Vite + PWA. |
| `npm run lint` | Runs type verification on both client and server codebases (`tsc --noEmit`). |
| `npm test` | Runs the full integration test suite verifying health, database, auth, and Socket.IO. |

---

## 9. API Architecture & Versioning

All API routes follow the strict three-tier architecture:
$$\text{Route} \longrightarrow \text{Controller} \longrightarrow \text{Service} \longrightarrow \text{Model}$$

Every API endpoint is versioned under the `/api/v1/` prefix.

### Standard Response Format

#### Success (`2xx`):
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully"
}
```

#### Error (`4xx`, `5xx`):
```json
{
  "success": false,
  "message": "Human readable error description",
  "code": "ERROR_CODE_CONSTANT",
  "details": [ ... ]
}
```

---

## 10. API Documentation

### System Health
```http
GET /api/v1/health
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "status": "operational",
    "database": "connected",
    "realtime": "ready",
    "uptimeSeconds": 142,
    "timestamp": "2026-09-26T08:30:00.000Z",
    "version": "1.0.0-phase1"
  },
  "message": "BlackBox API is running"
}
```

---

### Authentication Endpoints

#### 1. Register Operator
```http
POST /api/v1/auth/register
Content-Type: application/json
```
**Request Body:**
```json
{
  "name": "Commander Sarah Vance",
  "email": "vance@blackbox.local",
  "password": "SecurePassword123!",
  "role": "COMMANDER"
}
```
*Roles available: `COMMANDER`, `FIELD_OPERATOR` (default).*

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "6795f7...",
      "name": "Commander Sarah Vance",
      "email": "vance@blackbox.local",
      "role": "COMMANDER",
      "createdAt": "2026-09-26T08:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "User registered successfully"
}
```

#### 2. Operator Sign In
```http
POST /api/v1/auth/login
Content-Type: application/json
```
**Request Body:**
```json
{
  "email": "vance@blackbox.local",
  "password": "SecurePassword123!"
}
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "6795f7...",
      "name": "Commander Sarah Vance",
      "email": "vance@blackbox.local",
      "role": "COMMANDER",
      "createdAt": "2026-09-26T08:30:00.000Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "message": "Login successful"
}
```

#### 3. Session Sign Out
```http
POST /api/v1/auth/logout
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": { "loggedOut": true },
  "message": "Logged out successfully"
}
```

#### 4. Current Operator Profile (Protected)
```http
GET /api/v1/auth/me
Authorization: Bearer <JWT_TOKEN>
```
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "6795f7...",
    "name": "Commander Sarah Vance",
    "email": "vance@blackbox.local",
    "role": "COMMANDER",
    "createdAt": "2026-09-26T08:30:00.000Z",
    "updatedAt": "2026-09-26T08:30:00.000Z"
  }
}
```

---

## 11. Security Foundation

1. **Password Protection:** Plain-text passwords never enter the database; hashed using `bcryptjs` with salt work factor 10.
2. **Data Sanitization:** Mongoose model transform strips `passwordHash` and internal version keys (`__v`) from all JSON serializations.
3. **HTTP Hardening:** Helmet enables defensive HTTP headers (XSS filter, frameguard, no-sniff).
4. **Validation:** All incoming request payloads validated strictly against Zod schemas before hitting business logic.
5. **Role-Based Access Control:** `requireRole("COMMANDER")` middleware enforces server-side permission checks.
6. **Safe Error Handling:** In production, internal error stacks and database connection strings are never leaked.

---

## 12. Socket.IO Real-Time Architecture

The real-time layer handles instant event propagation between command centers and operators:

```
[Browser / PWA]
      ↕ (WebSocket / Polling Transport)
[Socket.IO Server] (server/src/sockets/socket.ts)
      ↕
[Express HTTP Server] (server/src/server.ts)
```

- **Connection Lifecycle:** Detects client connect, client ping, server pong, and clean disconnects.
- **Handshake Verification:** Server emits `system:welcome` event with server time upon socket authentication.
- **Latency Telemetry:** Client sends periodic `client:ping` to measure real-time Round Trip Time (RTT) displayed live in the console header.

---

## 13. Dual-State Connectivity Abstraction

In offline-first systems, **network availability is NOT equivalent to backend reachability**.

BlackBox tracks two distinct telemetry parameters:

$$\text{networkAvailable} \quad \text{vs.} \quad \text{serverReachable}$$

| Network Available | Server Reachable | Calculated Status | Operational State |
| :---: | :---: | :---: | :--- |
| **true** | **true** | `ONLINE` | Normal real-time operational mode. |
| **true** | **false** | `RECONNECTING` | Device has Wi-Fi/cellular, but BlackBox API is unreachable or restarting. |
| **false** | **false** | `OFFLINE` | Hardware offline. Operator retains full local console access with sync queues. |

The frontend implements `useConnectivity()` and `useConnectivityStore` to monitor browser `online`/`offline` window events alongside periodic `/api/v1/health` background pings.

---

## 14. Roadmap & Future Phases

- **Phase 1 (Complete):** MERN Architecture Foundation, Dual-State Connectivity Abstraction, Responsive Shell.
- **Phase 2 (Complete):** Authentication, Users & Role-Based Access Control (COMMANDER vs. FIELD_OPERATOR, HTTP-Only Cookies, Authenticated Socket.IO Streams with User Rooms, 403 Forbidden Backend Guards).
- **Phase 3 (Next Phase):** Mission Operations Management (Missions, Tasks, Team Assignment, Severity Matrices).
- **Phase 4:** Offline Mutation Queue & Synchronization Engine (IndexedDB & Local State Reconciliation).
- **Phase 5:** Conflict Resolution Engine & Chronological Mission Replay.
- **Phase 6:** Production Hardening, Edge Deployment, Performance Benchmarks.
