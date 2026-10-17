# BlackBox Deployment Guide

## Status and topology

This repository contains deployment configuration and a local production simulation. It is **not** an external cloud deployment. A production deployment should use a managed MongoDB replica set or mongos, an HTTPS frontend origin, and a backend reachable by both REST and Socket.IO WebSocket traffic.

```text
Browser / PWA
     |
     v
Frontend static host or nginx
     |
     +--> Express API + Socket.IO
                 |
                 v
          MongoDB replica set / mongos
```

## Prerequisites

- Node.js 22+ and npm.
- Docker 29+ and Docker Compose v2 for the local production simulation.
- MongoDB replica set or mongos for transactional entity, MissionEvent, and idempotency writes.
- HTTPS in staging/production. Secure cookies and WebSocket upgrades must be preserved by the reverse proxy.

## Environment variables

Backend-only secrets must never be placed in `VITE_*` variables because Vite embeds those values into public browser assets.

Required backend variables:

```text
NODE_ENV=production
PORT=5000
MONGODB_URI=<managed MongoDB replica-set or mongos URI>
JWT_SECRET=<random secret, at least 32 characters>
JWT_EXPIRES_IN=7d
CLIENT_URL=https://console.example.com
CORS_ORIGINS=https://console.example.com
ENABLE_DEMO_MODE=false
ALLOW_INSECURE_HTTP=false
```

`DEMO_PASSWORD` is only for an isolated non-production demo environment. Do not enable demo mode in production.

Public frontend build-time variables:

```text
VITE_API_URL=https://api.example.com/api/v1
VITE_SOCKET_URL=https://api.example.com
```

Start from `server/.env.example` and `client/.env.example`. Inject real production values through the hosting platform's secret/configuration store; do not commit `.env` files.

## Local production simulation

The production simulation uses a single-node MongoDB replica set for transaction compatibility. It is not highly available production MongoDB.

```bash
docker compose -f docker-compose.prod-sim.yml config
JWT_SECRET="$(openssl rand -base64 48)" docker compose -f docker-compose.prod-sim.yml build
JWT_SECRET="$(openssl rand -base64 48)" docker compose -f docker-compose.prod-sim.yml up -d
docker compose -f docker-compose.prod-sim.yml ps
curl --fail http://127.0.0.1:5000/api/v1/health/ready
```

On PowerShell, set `$env:JWT_SECRET` before `docker compose up -d`.

Stop the simulation with:

```bash
docker compose -f docker-compose.prod-sim.yml down
```

The MongoDB volume is named `blackbox-prod-mongodb-data`. Remove it only when intentionally discarding local data.

## Image builds

```bash
docker build -f Dockerfile.server -t blackbox-server .
docker build -f Dockerfile.client \
  --build-arg VITE_API_URL=https://api.example.com/api/v1 \
  --build-arg VITE_SOCKET_URL=https://api.example.com \
  -t blackbox-client .
```

The server image runs the compiled `server/dist/server.js` as the non-root `node` user. The client image serves the Vite output with nginx and includes SPA fallback routing.

## Database readiness

Transactions require a MongoDB replica set or mongos. Before a production rollout:

1. Provision authenticated MongoDB with TLS, backups, retention, and restore testing.
2. Verify the connection URI includes the correct replica-set/mongos settings.
3. Run the application against a staging database and allow Mongoose model initialization to create declared indexes as a controlled deployment step.
4. Verify indexes and query plans for mission/task/event/replay/conflict/idempotency workloads.
5. Never run destructive index synchronization against production data without review.

Important indexes are declared on users, missions, tasks, mission members, MissionEvents, ProcessedMutations, and SyncConflicts. Unique protections include user email, mission membership, event idempotency, mutation idempotency, and conflict idempotency.

## Health and readiness

- `GET /api/v1/health/live` checks that the process is alive.
- `GET /api/v1/health/ready` checks MongoDB ping and transaction capability, returning HTTP 503 when the service cannot safely accept protected writes.
- `GET /api/v1/health` remains the compatibility health summary.

Route REST and Socket.IO traffic through the same backend origin or configure the reverse proxy for WebSocket upgrade headers. Do not expose MongoDB directly to the public Internet.

## HTTPS, CORS, and cookies

Production `CLIENT_URL` and `CORS_ORIGINS` must be explicit origins, not `*`. Use HTTPS, preserve `HttpOnly`, `Secure`, and `SameSite=Strict` authentication cookie attributes, and verify that the proxy forwards the original scheme correctly. If frontend and API use different sites, review cookie policy and deployment topology before changing it.

## Verification checklist

After deployment configuration is supplied:

1. `GET /api/v1/health/ready` returns 200.
2. User login/logout works and protected routes reject unauthenticated requests.
3. Mission, team, task, observation, sync, conflict, and replay flows work.
4. Browser network controls demonstrate cached mission data and queued mutations after reload.
5. Reconnection produces one logical server entity/event per idempotent mutation.
6. Two browser contexts receive Socket.IO mission updates without refresh.
7. Service-worker application-shell caching is verified on the deployed HTTPS origin.
8. Logs contain startup, database, authentication, sync, and unexpected-error signals without passwords, tokens, or connection strings.

## Scaling and operations

Multiple backend instances require a shared Socket.IO adapter and a deployment strategy that preserves authentication and connection handling. MongoDB backups and restore drills are operational requirements, not substitutes for application tests. Roll back application images using the previous immutable image tag while keeping database migrations/index changes backward compatible.

No cloud provider credentials or deployment access are configured in this workspace. Therefore this document represents prepared and locally verifiable deployment configuration, not proof of an external production deployment.
