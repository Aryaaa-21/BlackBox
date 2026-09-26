# BlackBox — Frontend Development Plan (Flutter)

> **Platform:** Flutter + Dart  
> **State Management:** Riverpod (recommended) or Flutter built-in  
> **Routing:** go_router  
> **Design:** Dark operations console aesthetic — Inter / IBM Plex Sans / Space Grotesk

---

## Phase 0 — Project Setup & Scaffolding

**Goal:** Get the Flutter project running with Serverpod-generated client.

### Tasks
- [ ] Run `serverpod quickstart blackbox` to generate full-stack project
- [ ] Verify Flutter app boots via `serverpod start`
- [ ] Confirm generated Serverpod client is wired to Flutter project
- [ ] Set up `go_router` for navigation between screens
- [ ] Set up `flutter_riverpod` (or chosen state manager)
- [ ] Add `connectivity_plus` for network monitoring
- [ ] Configure `pubspec.yaml` with only essential packages
- [ ] Set up folder structure:
  ```
  blackbox_flutter/lib/
  ├── screens/
  │   ├── login/
  │   ├── dashboard/
  │   ├── mission/
  │   ├── offline/
  │   └── replay/
  ├── widgets/
  ├── services/
  ├── providers/
  └── main.dart
  ```

### Definition of Done
> Flutter app runs, routes to placeholder screens, Serverpod client initializes without errors.

---

## Phase 1 — Design System & Theme

**Goal:** Establish the BlackBox visual identity before building screens.

### Tasks
- [ ] Define `AppTheme` with dark background (`#0A0C0F` or similar very dark neutral)
- [ ] Configure elevated dark surface panels
- [ ] Set primary accent color (one strong color — e.g. electric blue `#2563EB` or amber `#F59E0B`)
- [ ] Define semantic status colors:
  - `green` — synced / healthy
  - `yellow` — pending / warning  
  - `red` — conflict / critical
  - `blue` — active / informational
- [ ] Set up Google Fonts: Inter (body), IBM Plex Mono (timestamps/IDs)
- [ ] Create shared `AppColors`, `AppTextStyles`, `AppSpacing` constants
- [ ] Build reusable `StatusBadge` widget (renders colored pill: ACTIVE, OFFLINE, SYNCED, etc.)
- [ ] Build `NetworkIndicator` widget (green dot = online, red = offline, pulsing = syncing)
- [ ] Build `SyncIndicator` widget showing sync state with icon + label

### Definition of Done
> Design tokens defined. Network and sync widgets render correctly with all states.

---

## Phase 2 — Authentication Screens

**Goal:** Users can sign up, sign in, and be directed to the correct role view.

### Screens
- `LoginScreen` — email + password sign in
- `RegisterScreen` — sign up with name, email, password, role selection

### Tasks
- [ ] Build `LoginScreen` with:
  - BlackBox logo / title
  - Email + password fields
  - Sign In button
  - Link to Register
  - Demo Mode button (placeholder for now)
  - Loading and error states
- [ ] Build `RegisterScreen` with:
  - Name, email, password inputs
  - Role selector (Commander / Field Operator)
  - Create Account button
- [ ] Wire screens to Serverpod auth endpoints
- [ ] On successful login, navigate to `DashboardScreen`
- [ ] Store and manage auth session (Serverpod session token)
- [ ] Handle invalid login gracefully (show error message)
- [ ] Implement logout from any screen

### Design Notes
- Dark screen with centered card
- Tagline: **"Operations don't stop when connectivity does."**

### Definition of Done
> A user can create an account and sign in. Auth session persists across hot restarts.

---

## Phase 3 — Command Dashboard Screen

**Goal:** The main hub showing all active missions, key stats, and live event feed.

### Screen
- `DashboardScreen`

### Tasks
- [ ] Build mission list showing:
  - Mission title
  - Status badge (`ACTIVE` / `COMPLETED`)
  - Severity indicator
  - Team count
  - Task progress (e.g. "3/6 TASKS")
- [ ] Build stats row per mission: Team / Tasks / Sync state
- [ ] Build "LIVE EVENT STREAM" panel with scrolling event cards
- [ ] Show `NetworkIndicator` and `SyncIndicator` in app bar / top area
- [ ] Add "Create Mission" button → opens `CreateMissionSheet`
- [ ] Build `CreateMissionSheet` (bottom sheet / dialog):
  - Title, description, location, severity
  - Submit creates mission via Serverpod endpoint
- [ ] Navigate to `MissionScreen` on mission tap
- [ ] Show empty state if no missions

### Widgets to Build
- `MissionCard` — displays mission summary
- `EventTile` — single event row in feed
- `StatChip` — small metric pill

### Definition of Done
> Commander sees their missions. Can create a new mission. Live event feed visible.

---

## Phase 4 — Mission Operations Screen

**Goal:** Deep view of one mission — tasks, team, events, status controls.

### Screen
- `MissionScreen`

### Tasks
- [ ] Display mission header: title, status, location, severity
- [ ] Build `TeamSection`:
  - List of members with role and status
  - "Add Member" button for Commanders
- [ ] Build `TaskSection`:
  - List of tasks with status badges and priority
  - "Create Task" FAB for Commanders
  - Task cards with: title, assignee, priority, status
  - Tap task → `TaskDetailSheet`
- [ ] Build `TaskDetailSheet`:
  - Shows full task info
  - Status change dropdown/buttons
  - Only allowed transitions shown
  - Field Operators: only their assigned tasks editable
- [ ] Build "Create Task" sheet with: title, description, assign-to selector, priority, due date
- [ ] Build `EventSection`:
  - Chronological event list for this mission
  - Event types shown with icon/label
  - "Add Observation" button
- [ ] Close Mission button (Commander only)

### Widgets to Build
- `TaskCard`
- `MemberChip`
- `EventTimeline`

### Definition of Done
> Commander can assign tasks to field operators. Field operators can update task status. Events are recorded.

---

## Phase 5 — Real-Time Updates

**Goal:** Dashboard and mission screen update live when any user makes a change.

### Tasks
- [ ] Connect `MissionStreamEndpoint` Serverpod stream in `DashboardScreen`
- [ ] Use `StreamBuilder` / Riverpod `StreamProvider` to consume live updates
- [ ] On new `MissionEvent` received via stream:
  - Append to event feed on Dashboard
  - Refresh task statuses on MissionScreen
  - Update team member status
- [ ] Show subtle animation when new event arrives (e.g. flash / slide-in)
- [ ] Handle stream disconnection gracefully (reconnect on resume)
- [ ] Test with two simulated users: Field operator action → commander sees update

### Definition of Done
> Two users, same mission. One acts → the other sees the update without refresh. No polling.

---

## Phase 6 — Offline Mode Screen & UX

**Goal:** When connectivity is lost, the app gracefully switches to offline mode — NOT breaks.

### Screen
- `OfflineScreen` (shown as overlay or dedicated route when network lost)

### Tasks
- [ ] Implement `ConnectivityService`:
  - Monitor `connectivity_plus` for network change
  - Ping Serverpod health endpoint to confirm server reachability
  - Expose connectivity state: `ONLINE`, `OFFLINE`, `RECONNECTING`
- [ ] On network loss:
  - Show `OFFLINE MODE` banner (non-intrusive top bar or full overlay)
  - Continue showing cached mission/task data from local DB
  - Disable server-dependent actions gracefully
- [ ] Allow while offline:
  - Task status updates (queued locally)
  - Creating observations/events (stored locally with `syncStatus: PENDING`)
  - Viewing all cached mission data
- [ ] Show pending change count: "3 PENDING CHANGES"
- [ ] Show last sync timestamp: "Last synchronized 12:42:31"
- [ ] Show message: "You can continue working. Changes will synchronize automatically."
- [ ] Local DB write: on every offline action, save event with `syncStatus = PENDING`

### `OfflineScreen` Layout
```
OFFLINE MODE
────────────────────────
Connection unavailable.

LOCAL OPERATIONS ACTIVE

Last synchronization: 12:42:31
Pending changes: 03

You can continue working.
Changes will synchronize automatically.
```

### Definition of Done
> Network disabled → app shows offline state. User completes tasks. 3 pending events stored locally.

---

## Phase 7 — Synchronization UI

**Goal:** When connectivity returns, pending changes sync and the UI reflects it clearly.

### Tasks
- [ ] Implement `SyncService` on Flutter side:
  - On connectivity restored: read all `PENDING` local events
  - Send to `SyncEndpoint.syncPendingEvents()`
  - Update `syncStatus` of each event to `SYNCING` → `SYNCED` / `CONFLICT` / `FAILED`
- [ ] Show during sync: "SYNCING... 3 EVENTS"
- [ ] Show on completion: "SYNC COMPLETE ✓"
- [ ] Show on conflict: `SYNC CONFLICT` alert card with details (local vs remote state)
- [ ] Show on failure: "SYNC FAILED — RETRYING"
- [ ] Update task and mission UI to reflect newly synced state
- [ ] Prevent duplicate submissions (use eventId for idempotency check)

### Sync State Indicator
All states must be visually distinct:
| State | Color | Label |
|---|---|---|
| `LOCAL` | Grey | "LOCAL" |
| `PENDING` | Yellow | "PENDING SYNC" |
| `SYNCING` | Blue pulsing | "SYNCING..." |
| `SYNCED` | Green | "SYNCED ✓" |
| `CONFLICT` | Red | "CONFLICT" |
| `FAILED` | Red | "SYNC FAILED" |

### Definition of Done
> Network restored → pending events sync. UI transitions through SYNCING → SYNCED. Commander dashboard updates.

---

## Phase 8 — Mission Replay Screen

**Goal:** Visually reconstruct the entire mission from its event log.

### Screen
- `ReplayScreen`

### Tasks
- [ ] Fetch full event history from `ReplayEndpoint.getReplay(missionId)`
- [ ] Render chronological timeline of events with timestamps
- [ ] Each event shown as a timeline node:
  ```
  12:40  ● MISSION CREATED
  12:41  ● TEAM ASSIGNED
  12:43  ● TASKS STARTED
  12:45  🔴 NETWORK LOST
  12:47  ● ZONE C CHECKED (offline)
  12:55  🟢 NETWORK RESTORED
  12:55  ⟳ 3 EVENTS SYNCHRONIZED
  12:56  ● MISSION STABILIZED
  ```
- [ ] Play / Pause button — animates through timeline
- [ ] Speed control (1x / 2x / 5x)
- [ ] Jump-to-event by tapping any node
- [ ] Highlight offline events differently (e.g. dashed border)
- [ ] Highlight sync events with special icon

### Widgets to Build
- `TimelineNode`
- `ReplayController`

### Definition of Done
> Replay screen loads mission history and plays through events. Offline and sync events visually distinct.

---

## Phase 9 — Demo Mode

**Goal:** Allow solo developer to demonstrate multi-user workflow from one device.

### Tasks
- [ ] Add hidden "Demo Control Panel" accessible via long-press on logo or debug flag
- [ ] Demo control panel contains:
  - **Simulated Identity Switcher**: Commander / Field Unit A / Field Unit B
  - **Network Simulator**: ONLINE / OFFLINE / RECONNECT buttons
  - **Create Sample Mission** button (seeds demo data)
  - **Reset Demo** button (wipes and re-seeds)
- [ ] Each identity switch re-authenticates with the corresponding demo account
- [ ] Seeded demo data:
  - Mission: "Campus Building B Emergency Drill"
  - Team: Commander, Field Unit A, Field Unit B, Medical Unit
  - Tasks: Evacuate Building B, Check Zone C, Secure Entrance, Medical Assessment

### Definition of Done
> Full 3-minute demo sequence can be executed without any extra setup.

---

## Phase 10 — Polish & Hardening

**Goal:** Make the UI feel premium and resilient for the demo.

### Tasks
- [ ] All loading states handled (shimmer / skeleton loaders)
- [ ] All empty states handled (no missions, no tasks, no events)
- [ ] All error states shown clearly (network error, server error, auth error)
- [ ] Animations:
  - Event feed slide-in
  - Sync indicator pulse animation
  - Replay timeline animation
  - Status badge transition
- [ ] Responsive layout (tablet-friendly is a bonus)
- [ ] Typography audit: consistent use of Inter / IBM Plex Mono
- [ ] Spacing/padding consistency
- [ ] Accessibility: sufficient contrast, tap target sizes
- [ ] Run `flutter analyze` — zero warnings
- [ ] Test on target demo device
- [ ] Rehearse exact demo sequence 5+ times

### Definition of Done
> App feels premium. Zero crashes in demo sequence. All states visually polished.

---

## Screen Summary

| Screen | Route | Priority |
|---|---|---|
| Landing / Login | `/login` | Phase 2 |
| Register | `/register` | Phase 2 |
| Dashboard | `/dashboard` | Phase 3 |
| Mission Operations | `/mission/:id` | Phase 4 |
| Offline Mode overlay | N/A (state-driven) | Phase 6 |
| Mission Replay | `/mission/:id/replay` | Phase 8 |
| Demo Control Panel | Hidden | Phase 9 |

---

## Widget Library

| Widget | Used In |
|---|---|
| `NetworkIndicator` | All screens (app bar) |
| `SyncIndicator` | Dashboard, Mission |
| `StatusBadge` | Mission cards, task cards |
| `MissionCard` | Dashboard |
| `TaskCard` | Mission screen |
| `EventTile` | Dashboard feed, Mission events |
| `EventTimeline` | Replay screen |
| `MemberChip` | Mission screen |
| `TimelineNode` | Replay screen |

---

## Packages

| Package | Purpose |
|---|---|
| `serverpod_flutter` | Core Serverpod client |
| `connectivity_plus` | Network state monitoring |
| `go_router` | Navigation/routing |
| `flutter_riverpod` | State management |
| `google_fonts` | Inter + IBM Plex Mono |
| `intl` | Date/time formatting |
