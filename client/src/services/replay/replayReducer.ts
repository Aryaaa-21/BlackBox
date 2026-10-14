/**
 * Phase 8 — Mission Replay
 * Replay Reducer — pure, deterministic state reconstruction engine.
 *
 * Given a stream of historical MissionEvents and a target event index or timestamp,
 * reconstructs the EXACT operational state (mission, tasks, team, observations, conflicts)
 * at that precise moment in history without querying current database state or mutating live stores.
 */

import {
  ReplayEvent,
  ReplayMissionState,
  ReplayTask,
  ReplayMember,
  ReplayObservation,
  ReplayConflict,
} from '../../types/replay';

export function createInitialReplayState(missionTitle = 'Mission'): ReplayMissionState {
  return {
    missionStatus: 'DRAFT',
    missionTitle,
    members: [],
    tasks: [],
    observations: [],
    conflicts: [],
    connectivity: 'ONLINE',
    activeTaskCount: 0,
    completedTaskCount: 0,
    blockedTaskCount: 0,
    pendingTaskCount: 0,
    teamMemberCount: 0,
  };
}

/**
 * Apply a single historical event to the replay state immutably.
 */
export function applyEvent(
  state: ReplayMissionState,
  event: ReplayEvent
): ReplayMissionState {
  const payload = event.payload || {};
  const actorName = event.actor?.name || 'Operator';
  const targetId = event.targetId || (payload.taskId as string) || (payload.memberId as string);

  switch (event.eventType) {
    // ----------------------------------------------------
    // Mission Lifecycle
    // ----------------------------------------------------
    case 'MISSION_CREATED': {
      const title =
        typeof payload.title === 'string'
          ? payload.title
          : state.missionTitle;
      return {
        ...state,
        missionTitle: title,
        missionStatus: 'DRAFT',
      };
    }

    case 'MISSION_STARTED': {
      return {
        ...state,
        missionStatus: 'ACTIVE',
      };
    }

    case 'MISSION_COMPLETED': {
      return {
        ...state,
        missionStatus: 'COMPLETED',
      };
    }

    case 'MISSION_CANCELLED': {
      return {
        ...state,
        missionStatus: 'CANCELLED',
      };
    }

    // ----------------------------------------------------
    // Team Operations
    // ----------------------------------------------------
    case 'MEMBER_ASSIGNED': {
      const memberUserId =
        targetId ||
        (payload.userId as string) ||
        (payload.memberId as string) ||
        `member-${state.members.length + 1}`;
      const memberName =
        (payload.name as string) ||
        (payload.memberName as string) ||
        event.targetName ||
        'Unit Member';
      const role = (payload.role as string) || 'FIELD_OPERATOR';

      const existingIndex = state.members.findIndex(
        (m) => m.userId === memberUserId || m.id === memberUserId
      );

      let updatedMembers: ReplayMember[];
      if (existingIndex >= 0) {
        updatedMembers = [...state.members];
        updatedMembers[existingIndex] = {
          ...updatedMembers[existingIndex],
          status: 'ACTIVE',
          name: memberName || updatedMembers[existingIndex].name,
          role,
        };
      } else {
        const newMember: ReplayMember = {
          id: memberUserId,
          userId: memberUserId,
          name: memberName,
          email: typeof payload.email === 'string' ? payload.email : undefined,
          role,
          status: 'ACTIVE',
          checkedIn: false,
          joinedAt: event.createdAt,
        };
        updatedMembers = [...state.members, newMember];
      }

      return {
        ...state,
        members: updatedMembers,
        teamMemberCount: updatedMembers.filter((m) => m.status === 'ACTIVE').length,
      };
    }

    case 'MEMBER_REMOVED': {
      const memberUserId = targetId || (payload.userId as string);
      const updatedMembers = state.members.map((m) =>
        m.userId === memberUserId || m.id === memberUserId
          ? { ...m, status: 'REMOVED' as const }
          : m
      );
      return {
        ...state,
        members: updatedMembers,
        teamMemberCount: updatedMembers.filter((m) => m.status === 'ACTIVE').length,
      };
    }

    case 'MEMBER_REACTIVATED': {
      const memberUserId = targetId || (payload.userId as string);
      const updatedMembers = state.members.map((m) =>
        m.userId === memberUserId || m.id === memberUserId
          ? { ...m, status: 'ACTIVE' as const }
          : m
      );
      return {
        ...state,
        members: updatedMembers,
        teamMemberCount: updatedMembers.filter((m) => m.status === 'ACTIVE').length,
      };
    }

    case 'MEMBER_CHECKED_IN': {
      const memberUserId = event.actor?.id || targetId;
      const updatedMembers = state.members.map((m) =>
        m.userId === memberUserId || m.id === memberUserId
          ? { ...m, checkedIn: true }
          : m
      );
      return {
        ...state,
        members: updatedMembers,
      };
    }

    // ----------------------------------------------------
    // Task Operations
    // ----------------------------------------------------
    case 'TASK_CREATED': {
      const taskId = targetId || (payload.id as string) || `task-${state.tasks.length + 1}`;
      const title =
        (payload.title as string) ||
        event.targetName ||
        'Untitled Directive';
      const description = payload.description as string | undefined;
      const priority = (payload.priority as string) || 'MEDIUM';

      const existingIndex = state.tasks.findIndex((t) => t.id === taskId);
      if (existingIndex >= 0) {
        return state;
      }

      const newTask: ReplayTask = {
        id: taskId,
        title,
        description,
        priority,
        status: 'PENDING',
        assignedTo: null,
        history: [
          {
            eventType: 'TASK_CREATED',
            timestamp: event.createdAt,
            actorName,
            details: `Task created with priority ${priority}`,
          },
        ],
      };

      const updatedTasks = [...state.tasks, newTask];
      return computeTaskCounts({
        ...state,
        tasks: updatedTasks,
      });
    }

    case 'TASK_ASSIGNED': {
      const taskId = targetId || (payload.taskId as string);
      if (!taskId) return state;

      const assigneeId = (payload.assignedTo as string) || (payload.userId as string) || 'assigned';
      const assigneeName =
        (payload.assignedToName as string) ||
        (payload.assigneeName as string) ||
        'Operator';

      const updatedTasks = state.tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            assignedTo: { id: assigneeId, name: assigneeName },
            history: [
              ...t.history,
              {
                eventType: 'TASK_ASSIGNED',
                timestamp: event.createdAt,
                actorName,
                details: `Assigned to ${assigneeName}`,
              },
            ],
          };
        }
        return t;
      });

      return computeTaskCounts({
        ...state,
        tasks: updatedTasks,
      });
    }

    case 'TASK_UNASSIGNED': {
      const taskId = targetId || (payload.taskId as string);
      if (!taskId) return state;

      const updatedTasks = state.tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            assignedTo: null,
            history: [
              ...t.history,
              {
                eventType: 'TASK_UNASSIGNED',
                timestamp: event.createdAt,
                actorName,
                details: 'Unassigned',
              },
            ],
          };
        }
        return t;
      });

      return computeTaskCounts({
        ...state,
        tasks: updatedTasks,
      });
    }

    case 'TASK_STARTED': {
      const taskId = targetId || (payload.taskId as string);
      if (!taskId) return state;

      const updatedTasks = state.tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            status: 'ACTIVE' as const,
            startedAt: event.createdAt,
            history: [
              ...t.history,
              {
                eventType: 'TASK_STARTED',
                timestamp: event.createdAt,
                actorName,
                details: 'Status changed to ACTIVE',
              },
            ],
          };
        }
        return t;
      });

      return computeTaskCounts({
        ...state,
        tasks: updatedTasks,
      });
    }

    case 'TASK_BLOCKED': {
      const taskId = targetId || (payload.taskId as string);
      if (!taskId) return state;

      const reason =
        (payload.reason as string) ||
        (payload.blockedReason as string) ||
        'Operational impediment';

      const updatedTasks = state.tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            status: 'BLOCKED' as const,
            blockedAt: event.createdAt,
            blockedReason: reason,
            history: [
              ...t.history,
              {
                eventType: 'TASK_BLOCKED',
                timestamp: event.createdAt,
                actorName,
                details: `Blocked: ${reason}`,
              },
            ],
          };
        }
        return t;
      });

      return computeTaskCounts({
        ...state,
        tasks: updatedTasks,
      });
    }

    case 'TASK_COMPLETED': {
      const taskId = targetId || (payload.taskId as string);
      if (!taskId) return state;

      const updatedTasks = state.tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            status: 'COMPLETED' as const,
            completedAt: event.createdAt,
            history: [
              ...t.history,
              {
                eventType: 'TASK_COMPLETED',
                timestamp: event.createdAt,
                actorName,
                details: 'Status changed to COMPLETED',
              },
            ],
          };
        }
        return t;
      });

      return computeTaskCounts({
        ...state,
        tasks: updatedTasks,
      });
    }

    case 'TASK_UPDATED': {
      const taskId = targetId || (payload.taskId as string);
      if (!taskId) return state;

      const updatedTasks = state.tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            title: typeof payload.title === 'string' ? payload.title : t.title,
            description: typeof payload.description === 'string' ? payload.description : t.description,
            priority: typeof payload.priority === 'string' ? payload.priority : t.priority,
            history: [
              ...t.history,
              {
                eventType: 'TASK_UPDATED',
                timestamp: event.createdAt,
                actorName,
                details: 'Parameters updated',
              },
            ],
          };
        }
        return t;
      });

      return computeTaskCounts({
        ...state,
        tasks: updatedTasks,
      });
    }

    // ----------------------------------------------------
    // Field Observations
    // ----------------------------------------------------
    case 'OBSERVATION_RECORDED': {
      const obs: ReplayObservation = {
        id: event.id,
        recordedBy: event.actor?.id || 'unknown',
        recordedByName: actorName,
        timestamp: event.createdAt,
        payload,
      };
      return {
        ...state,
        observations: [...state.observations, obs],
      };
    }

    // ----------------------------------------------------
    // Network Connectivity
    // ----------------------------------------------------
    case 'NETWORK_LOST': {
      return {
        ...state,
        connectivity: 'OFFLINE',
      };
    }

    case 'NETWORK_RESTORED': {
      return {
        ...state,
        connectivity: 'ONLINE',
      };
    }

    // ----------------------------------------------------
    // Concurrency & Sync Conflicts
    // ----------------------------------------------------
    case 'SYNC_CONFLICT': {
      const conflictId = (payload.conflictId as string) || event.id;
      const conflict: ReplayConflict = {
        id: conflictId,
        taskId: targetId || (payload.taskId as string),
        taskTitle: event.targetName || (payload.taskTitle as string),
        localState: payload.localState as Record<string, unknown> | undefined,
        serverState: payload.serverState as Record<string, unknown> | undefined,
        resolution: (payload.resolution as string) || 'OPEN',
        detectedAt: event.createdAt,
        resolvedAt: (payload.resolvedAt as string) || undefined,
      };

      const existingIndex = state.conflicts.findIndex((c) => c.id === conflictId);
      let updatedConflicts: ReplayConflict[];
      if (existingIndex >= 0) {
        updatedConflicts = [...state.conflicts];
        updatedConflicts[existingIndex] = conflict;
      } else {
        updatedConflicts = [...state.conflicts, conflict];
      }

      return {
        ...state,
        conflicts: updatedConflicts,
      };
    }

    default:
      // Unknown or unsupported event type: do not crash, return unchanged state
      return state;
  }
}

function computeTaskCounts(state: ReplayMissionState): ReplayMissionState {
  let pending = 0;
  let active = 0;
  let blocked = 0;
  let completed = 0;

  for (const t of state.tasks) {
    switch (t.status) {
      case 'PENDING':
        pending++;
        break;
      case 'ACTIVE':
        active++;
        break;
      case 'BLOCKED':
        blocked++;
        break;
      case 'COMPLETED':
        completed++;
        break;
    }
  }

  return {
    ...state,
    pendingTaskCount: pending,
    activeTaskCount: active,
    blockedTaskCount: blocked,
    completedTaskCount: completed,
  };
}

/**
 * Reconstruct state at a specific event index with checkpoint acceleration.
 */
export class ReplayStateReconstructor {
  private checkpoints: Map<number, ReplayMissionState> = new Map();
  private CHECKPOINT_INTERVAL = 25;
  private missionTitle: string;
  private events: ReplayEvent[] = [];

  constructor(events: ReplayEvent[], missionTitle = 'Mission') {
    this.events = events;
    this.missionTitle = missionTitle;
    this.buildCheckpoints();
  }

  private buildCheckpoints(): void {
    let currentState = createInitialReplayState(this.missionTitle);
    this.checkpoints.set(-1, currentState);

    for (let i = 0; i < this.events.length; i++) {
      currentState = applyEvent(currentState, this.events[i]);
      if ((i + 1) % this.CHECKPOINT_INTERVAL === 0 || i === this.events.length - 1) {
        this.checkpoints.set(i, currentState);
      }
    }
  }

  /**
   * Fast state reconstruction at a target event index.
   */
  public getStateAtIndex(targetIndex: number): ReplayMissionState {
    if (this.events.length === 0 || targetIndex < 0) {
      return createInitialReplayState(this.missionTitle);
    }

    const clampedIndex = Math.min(targetIndex, this.events.length - 1);

    // Find nearest checkpoint <= clampedIndex
    let nearestCheckpointIndex = -1;
    for (const key of this.checkpoints.keys()) {
      if (key <= clampedIndex && key > nearestCheckpointIndex) {
        nearestCheckpointIndex = key;
      }
    }

    let state = this.checkpoints.get(nearestCheckpointIndex) || createInitialReplayState(this.missionTitle);

    // Apply incremental events from checkpoint up to clampedIndex
    for (let i = nearestCheckpointIndex + 1; i <= clampedIndex; i++) {
      state = applyEvent(state, this.events[i]);
    }

    return state;
  }

  /**
   * Reconstruct state at a specific ISO timestamp.
   */
  public getStateAtTime(isoTimestamp: string): ReplayMissionState {
    const targetMs = new Date(isoTimestamp).getTime();
    let targetIndex = -1;

    for (let i = 0; i < this.events.length; i++) {
      const eventMs = new Date(this.events[i].createdAt).getTime();
      if (eventMs <= targetMs) {
        targetIndex = i;
      } else {
        break;
      }
    }

    return this.getStateAtIndex(targetIndex);
  }
}
