import { MissionEvent, MissionEventType } from '../types';

export interface FormattedMissionEvent {
  actorName: string;
  action: string;
  targetLabel?: string;
  details?: string;
  badgeVariant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'primary';
  formattedTime: string;
  isoTime: string;
}

/**
 * Format raw MissionEvent into humanized, readable operational text (Sections 48, 49, 118)
 */
export function formatMissionEvent(event: MissionEvent): FormattedMissionEvent {
  const actorName =
    typeof event.actorId === 'object' && event.actorId !== null && 'name' in event.actorId
      ? event.actorId.name
      : 'Operator';

  const payload = event.payload || {};

  let action = 'performed action';
  let targetLabel: string | undefined = undefined;
  let details: string | undefined = undefined;
  let badgeVariant: FormattedMissionEvent['badgeVariant'] = 'default';

  switch (event.eventType) {
    case MissionEventType.MISSION_CREATED:
      action = 'created mission';
      targetLabel = (payload.title as string) || 'Mission';
      badgeVariant = 'info';
      break;

    case MissionEventType.MISSION_STARTED:
      action = 'started mission';
      targetLabel = (payload.title as string) || 'Mission';
      badgeVariant = 'success';
      break;

    case MissionEventType.MISSION_COMPLETED:
      action = 'completed mission';
      targetLabel = (payload.title as string) || 'Mission';
      badgeVariant = 'success';
      break;

    case MissionEventType.MISSION_CANCELLED:
      action = 'cancelled mission';
      targetLabel = (payload.title as string) || 'Mission';
      badgeVariant = 'danger';
      break;

    case MissionEventType.MEMBER_ASSIGNED:
      action = 'assigned operator to team';
      targetLabel = (payload.userName as string) || 'Field Operator';
      details = `Role: ${(payload.role as string) || 'FIELD_OPERATOR'}`;
      badgeVariant = 'primary';
      break;

    case MissionEventType.MEMBER_REMOVED:
      action = 'removed operator from team';
      targetLabel = (payload.userName as string) || 'Field Operator';
      badgeVariant = 'warning';
      break;

    case MissionEventType.MEMBER_REACTIVATED:
      action = 'reactivated operator';
      targetLabel = (payload.userName as string) || 'Field Operator';
      badgeVariant = 'primary';
      break;

    case MissionEventType.TASK_CREATED:
      action = 'created task';
      targetLabel = (payload.title as string) || 'Task';
      if (payload.priority) {
        details = `Priority: ${payload.priority}`;
      }
      badgeVariant = 'info';
      break;

    case MissionEventType.TASK_UPDATED:
      action = 'updated task details';
      targetLabel = (payload.title as string) || 'Task';
      badgeVariant = 'default';
      break;

    case MissionEventType.TASK_ASSIGNED:
      action = 'assigned task';
      targetLabel = (payload.title as string) || 'Task';
      if (payload.assigneeName) {
        details = `to ${payload.assigneeName}`;
      }
      badgeVariant = 'primary';
      break;

    case MissionEventType.TASK_UNASSIGNED:
      action = 'unassigned task';
      targetLabel = (payload.title as string) || 'Task';
      badgeVariant = 'warning';
      break;

    case MissionEventType.TASK_STARTED:
      action = 'started task';
      targetLabel = (payload.title as string) || 'Task';
      badgeVariant = 'info';
      break;

    case MissionEventType.TASK_BLOCKED:
      action = 'marked task as blocked';
      targetLabel = (payload.title as string) || 'Task';
      badgeVariant = 'danger';
      break;

    case MissionEventType.TASK_COMPLETED:
      action = 'completed task';
      targetLabel = (payload.title as string) || 'Task';
      badgeVariant = 'success';
      break;

    case MissionEventType.OBSERVATION_RECORDED:
      action = 'recorded field observation';
      targetLabel = (payload.title as string) || 'Observation';
      badgeVariant = 'default';
      break;

    default:
      action = String(event.eventType).toLowerCase().replace(/_/g, ' ');
      targetLabel = (payload.title as string) || undefined;
      badgeVariant = 'default';
  }

  // Format local timestamp
  const date = new Date(event.createdAt);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedTime = isToday
    ? timeString
    : `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeString}`;

  return {
    actorName,
    action,
    targetLabel,
    details,
    badgeVariant,
    formattedTime,
    isoTime: event.createdAt,
  };
}
