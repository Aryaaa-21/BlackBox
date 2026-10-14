/**
 * Phase 8 — Mission Replay
 * Event Formatter — transforms raw ReplayEvents into clean,
 * human-readable, presentation-ready ReplayEventViewModels.
 * Decouples presentation logic completely from JSX views.
 */

import { ReplayEvent, ReplayEventViewModel, ReplayCategoryFilter } from '../../types/replay';

export function categorizeEvent(eventType: string): ReplayCategoryFilter {
  if (eventType.startsWith('MISSION_')) return 'MISSION';
  if (eventType.startsWith('TASK_')) return 'TASKS';
  if (eventType.startsWith('MEMBER_')) return 'TEAM';
  if (eventType.startsWith('OBSERVATION_')) return 'OBSERVATIONS';
  if (eventType.startsWith('NETWORK_')) return 'NETWORK';
  if (eventType.startsWith('SYNC_')) return 'SYNC';
  return 'ALL';
}

function getBadgeColors(eventType: string, isConflict: boolean, isNetwork: boolean) {
  if (isConflict) {
    return {
      bg: 'bg-orange-500/10',
      text: 'text-orange-400',
      border: 'border-orange-500/30',
      dot: 'bg-orange-400',
    };
  }

  if (isNetwork) {
    return {
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      border: 'border-purple-500/30',
      dot: 'bg-purple-400',
    };
  }

  switch (eventType) {
    case 'MISSION_CREATED':
    case 'MISSION_STARTED':
      return {
        bg: 'bg-cyan-500/10',
        text: 'text-cyan-400',
        border: 'border-cyan-500/30',
        dot: 'bg-cyan-400',
      };
    case 'MISSION_COMPLETED':
    case 'TASK_COMPLETED':
      return {
        bg: 'bg-emerald-500/10',
        text: 'text-emerald-400',
        border: 'border-emerald-500/30',
        dot: 'bg-emerald-400',
      };
    case 'MISSION_CANCELLED':
    case 'TASK_BLOCKED':
      return {
        bg: 'bg-rose-500/10',
        text: 'text-rose-400',
        border: 'border-rose-500/30',
        dot: 'bg-rose-400',
      };
    case 'TASK_STARTED':
    case 'TASK_ASSIGNED':
      return {
        bg: 'bg-blue-500/10',
        text: 'text-blue-400',
        border: 'border-blue-500/30',
        dot: 'bg-blue-400',
      };
    case 'MEMBER_ASSIGNED':
    case 'MEMBER_CHECKED_IN':
      return {
        bg: 'bg-indigo-500/10',
        text: 'text-indigo-400',
        border: 'border-indigo-500/30',
        dot: 'bg-indigo-400',
      };
    case 'OBSERVATION_RECORDED':
      return {
        bg: 'bg-amber-500/10',
        text: 'text-amber-400',
        border: 'border-amber-500/30',
        dot: 'bg-amber-400',
      };
    default:
      return {
        bg: 'bg-slate-500/10',
        text: 'text-slate-400',
        border: 'border-slate-500/30',
        dot: 'bg-slate-400',
      };
  }
}

export function formatReplayEvent(event: ReplayEvent): ReplayEventViewModel {
  const category = categorizeEvent(event.eventType);
  const payload = event.payload || {};
  const actorName = event.actor?.name || 'Operator';
  const isConflict = event.eventType === 'SYNC_CONFLICT';
  const isNetwork = event.eventType === 'NETWORK_LOST' || event.eventType === 'NETWORK_RESTORED';
  const isLocal = event.source === 'LOCAL' || event.syncState === 'PENDING';

  const badgeColor = getBadgeColors(event.eventType, isConflict, isNetwork);

  const targetName =
    event.targetName ||
    (typeof payload.title === 'string' ? payload.title : undefined) ||
    (typeof payload.taskTitle === 'string' ? payload.taskTitle : undefined) ||
    (typeof payload.memberName === 'string' ? payload.memberName : undefined);

  let title = event.eventType.replace(/_/g, ' ').toLowerCase();
  // Capitalize first letter
  title = title.charAt(0).toUpperCase() + title.slice(1);

  let description = `${actorName} executed ${title.toLowerCase()}`;

  switch (event.eventType) {
    case 'MISSION_CREATED':
      title = 'Mission Created';
      description = `${actorName} established mission directive: "${targetName || payload.title || 'Untitled'}"`;
      break;
    case 'MISSION_STARTED':
      title = 'Mission Initiated';
      description = `${actorName} transitioned mission status to ACTIVE`;
      break;
    case 'MISSION_COMPLETED':
      title = 'Mission Completed';
      description = `${actorName} marked mission operations as successfully COMPLETED`;
      break;
    case 'MISSION_CANCELLED':
      title = 'Mission Cancelled';
      description = `${actorName} cancelled mission operations`;
      break;

    case 'MEMBER_ASSIGNED':
      title = 'Team Member Deployed';
      description = `${actorName} deployed ${targetName || payload.memberName || 'member'} (${payload.role || 'OPERATOR'}) to mission unit`;
      break;
    case 'MEMBER_REMOVED':
      title = 'Member Decommissioned';
      description = `${actorName} removed ${targetName || 'member'} from tactical unit`;
      break;
    case 'MEMBER_CHECKED_IN':
      title = 'Operator Checked In';
      description = `${actorName} checked in and verified operational readiness`;
      break;

    case 'TASK_CREATED':
      title = 'Task Created';
      description = `${actorName} created task: "${targetName || payload.title || 'Untitled Task'}" [Priority: ${payload.priority || 'MEDIUM'}]`;
      break;
    case 'TASK_ASSIGNED': {
      const assignee =
        typeof payload.assignedToName === 'string'
          ? payload.assignedToName
          : typeof payload.assigneeName === 'string'
          ? payload.assigneeName
          : 'operator';
      title = 'Task Assigned';
      description = `${actorName} assigned "${targetName || 'Task'}" to ${assignee}`;
      break;
    }
    case 'TASK_UNASSIGNED':
      title = 'Task Unassigned';
      description = `${actorName} removed assignment from "${targetName || 'Task'}"`;
      break;
    case 'TASK_STARTED':
      title = 'Task Commenced';
      description = `${actorName} commenced operational work on "${targetName || 'Task'}" (ACTIVE)`;
      break;
    case 'TASK_BLOCKED': {
      const reason = typeof payload.reason === 'string' ? payload.reason : typeof payload.blockedReason === 'string' ? payload.blockedReason : 'Equipment or tactical constraint';
      title = 'Task Blocked';
      description = `${actorName} reported "${targetName || 'Task'}" BLOCKED: "${reason}"`;
      break;
    }
    case 'TASK_COMPLETED':
      title = 'Task Completed';
      description = `${actorName} completed directive "${targetName || 'Task'}"`;
      break;
    case 'TASK_UPDATED':
      title = 'Task Parameters Updated';
      description = `${actorName} updated parameters for "${targetName || 'Task'}"`;
      break;

    case 'OBSERVATION_RECORDED': {
      const notes = typeof payload.notes === 'string' ? payload.notes : typeof payload.text === 'string' ? payload.text : 'Tactical observation';
      title = 'Field Observation';
      description = `${actorName} recorded observation: "${notes}"`;
      break;
    }

    case 'NETWORK_LOST':
      title = 'Network Offline';
      description = 'Terminal transitioned to offline operational mode. Local mutation queue active.';
      break;
    case 'NETWORK_RESTORED':
      title = 'Network Restored';
      description = 'Communication uplink restored. Resuming live telemetry and sync.';
      break;
    case 'SYNC_STARTED':
      title = 'Sync Initiated';
      description = 'Transmitting pending offline mutation batch to central command';
      break;
    case 'SYNC_COMPLETED':
      title = 'Sync Completed';
      description = `Offline mutations successfully applied to server`;
      break;
    case 'SYNC_CONFLICT': {
      const resolution = typeof payload.resolution === 'string' ? payload.resolution : 'Pending resolution';
      title = 'Sync Conflict';
      description = `Concurrency divergence on "${targetName || 'Entity'}" · Resolution: ${resolution}`;
      break;
    }
    default:
      title = event.eventType.replace(/_/g, ' ');
      description = `${actorName} recorded ${title}`;
      break;
  }

  const d = new Date(event.createdAt);
  const formattedTime = !isNaN(d.getTime())
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : 'Unknown time';

  return {
    id: event.id,
    eventType: event.eventType,
    category,
    title,
    description,
    actorName,
    actorRole: event.actor?.role,
    timestamp: event.createdAt,
    formattedTime,
    source: event.source,
    syncState: event.syncState,
    isLocal,
    isConflict,
    isNetwork,
    badgeColor,
    targetName,
    details: payload,
  };
}
