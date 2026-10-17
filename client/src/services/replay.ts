import type { Mission, MissionEvent, MissionMember, ReplayNormalizedEvent, Task } from '../types';

export type ReplayEvent = MissionEvent | ReplayNormalizedEvent;
export type HistoricalMission = Partial<Mission> & { id: string; missingFields: string[] };
export type HistoricalTask = Partial<Task> & { id: string; assigneeName?: string | null; missingFields: string[] };
export type HistoricalMember = Partial<MissionMember> & { id: string; name?: string; checkedInAt?: string; missingFields: string[] };
export interface ReplayTimelineEntry {
  id: string;
  eventType: string;
  createdAt: string | null;
  event: unknown;
  applied: boolean;
  warnings: string[];
}
export interface ReplayConflict {
  id: string;
  entityId?: string;
  entityType?: string;
  status: 'OPEN' | 'RESOLVED';
  detectedAt?: string;
  resolvedAt?: string;
  resolution?: string;
  localState?: Record<string, unknown>;
  serverState?: Record<string, unknown>;
  resolvedEntityState?: Record<string, unknown>;
  history: Array<{ eventId: string; at: string; action: 'DETECTED' | 'RESOLVED'; resolution?: string }>;
}
export interface ReplayState {
  missionId: string | null;
  mission: HistoricalMission | null;
  tasks: Record<string, HistoricalTask>;
  members: Record<string, HistoricalMember>;
  observations: Array<{ eventId: string; createdAt: string; text?: string; payload: Record<string, unknown> }>;
  network: 'UNKNOWN' | 'ONLINE' | 'OFFLINE';
  sync: 'UNKNOWN' | 'SYNCING' | 'COMPLETED' | 'CONFLICT';
  conflicts: Record<string, ReplayConflict>;
  timeline: ReplayTimelineEntry[];
  warnings: string[];
}

/** No current mission/task/member data enters this state, even for filtered pages. */
export function createEmptyReplayState(): ReplayState {
  return { missionId: null, mission: null, tasks: {}, members: {}, observations: [], network: 'UNKNOWN', sync: 'UNKNOWN', conflicts: {}, timeline: [], warnings: [] };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): string | undefined { return typeof value === 'string' && value.length ? value : undefined; }
function validDate(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function clone(value: unknown, seen = new Set<unknown>()): unknown {
  if (value && typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    const result = Array.isArray(value) ? value.map((item) => clone(item, seen)) : Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item, seen)]));
    seen.delete(value);
    return result;
  }
  return value;
}
function fields(source: Record<string, unknown>, strings: readonly string[], enums: Record<string, readonly string[]> = {}): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of strings) if (typeof source[key] === 'string' && (!key.endsWith('At') || validDate(source[key]))) result[key] = source[key];
  for (const [key, values] of Object.entries(enums)) if (typeof source[key] === 'string' && values.includes(source[key])) result[key] = source[key];
  if (typeof source.version === 'number' && Number.isSafeInteger(source.version) && source.version >= 0) result.version = source.version;
  return result;
}
const priorities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const taskStatuses = ['PENDING', 'ACTIVE', 'BLOCKED', 'COMPLETED'];
const missionStatuses = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'];
function missing(value: object, required: string[]): string[] { return required.filter((key) => (value as Record<string, unknown>)[key] === undefined); }
function referenceFields(source: Record<string, unknown>, result: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (typeof source[key] === 'string' || (record(source[key]) && text(source[key].id))) result[key] = clone(source[key]);
}
function nullableDates(source: Record<string, unknown>, result: Record<string, unknown>, keys: string[]) {
  for (const key of keys) if (source[key] === null || validDate(source[key]) || (key in source && source[key] === undefined)) result[key] = source[key];
}
function missionFields(payload: Record<string, unknown>) {
  const result = fields(payload, ['title', 'description', 'location', 'createdAt', 'updatedAt'], { status: missionStatuses, severity: priorities });
  referenceFields(payload, result, ['createdBy']);
  nullableDates(payload, result, ['startedAt', 'completedAt', 'cancelledAt']);
  return result;
}
function taskFields(payload: Record<string, unknown>) {
  const result = fields(payload, ['title', 'description', 'createdAt', 'updatedAt'], { status: taskStatuses, priority: priorities });
  referenceFields(payload, result, ['createdBy']);
  nullableDates(payload, result, ['startedAt', 'blockedAt', 'completedAt']);
  if (typeof payload.assignedTo === 'string' || payload.assignedTo === null) result.assignedTo = payload.assignedTo;
  else if (record(payload.assignedTo) && text(payload.assignedTo.id)) result.assignedTo = clone(payload.assignedTo);
  else if ('assignedTo' in payload && payload.assignedTo === undefined) result.assignedTo = undefined;
  // Older demo histories recorded the title under taskTitle.
  if (!result.title && typeof payload.taskTitle === 'string') result.title = payload.taskTitle;
  if (typeof payload.assigneeName === 'string') result.assigneeName = payload.assigneeName;
  if (typeof payload.assignedToName === 'string') result.assigneeName = payload.assignedToName;
  if (!result.assigneeName && record(payload.assignedTo) && text(payload.assignedTo.name)) result.assigneeName = payload.assignedTo.name;
  if (payload.assignedTo === null || ('assigneeName' in payload && payload.assigneeName === undefined)) result.assigneeName = undefined;
  return result;
}
function memberFields(payload: Record<string, unknown>) {
  const result = fields(payload, ['userId', 'createdAt', 'updatedAt', 'joinedAt', 'checkedInAt'], { status: ['INVITED', 'ACTIVE', 'REMOVED'], role: ['COMMANDER', 'FIELD_OPERATOR'] });
  referenceFields(payload, result, ['userId']);
  nullableDates(payload, result, ['joinedAt']);
  const name = text(payload.userName) || text(payload.memberName) || text(payload.name) || (record(payload.userId) ? text(payload.userId.name) : undefined);
  if (name) result.name = name;
  return result;
}

/** Pure reducer. Input is ordered history; malformed entries remain visible and cannot stop later events. */
export function replayReducer(previous: ReplayState, input: ReplayEvent | unknown): ReplayState {
  const raw = record(input) ? input : {};
  const warnings: string[] = [];
  const id = text(raw.id) || `invalid-event-${previous.timeline.length + 1}`;
  const eventType = text(raw.eventType) || 'INVALID_EVENT';
  const at = validDate(raw.createdAt) ? raw.createdAt : null;
  const entry: ReplayTimelineEntry = { id, eventType, createdAt: at, event: clone(input), applied: false, warnings };
  const state: ReplayState = { ...previous, timeline: [...previous.timeline, entry], warnings: [...previous.warnings] };
  const finish = () => {
    state.warnings.push(...warnings.map((warning) => `${id}: ${warning}`));
    return state;
  };
  if (!text(raw.id) || !text(raw.missionId) || !at || !record(raw.payload) || !text(raw.eventType)) {
    warnings.push('Malformed event: id, missionId, eventType, timestamp and object payload are required; state unchanged.');
    return finish();
  }
  if (raw.source === 'LOCAL' || raw.syncState === 'PENDING') {
    warnings.push('Pending local event excluded from authoritative history.');
    return finish();
  }
  if (previous.timeline.some((item) => item.id === id)) {
    warnings.push('Duplicate stable event ID; state unchanged.');
    return finish();
  }
  const payload = clone(raw.payload) as Record<string, unknown>;
  if (!['USER', 'SYSTEM', 'SERVER'].includes(String(raw.source))) warnings.push('Event source unavailable or unsupported.');
  for (const key of ['title', 'description', 'location', 'text', 'notes', 'userId', 'userName', 'memberName', 'taskId', 'conflictId', 'resolution', 'entityType', 'entityId']) {
    if (key === 'userId' && record(payload[key]) && text(payload[key].id)) continue;
    if (key in payload && typeof payload[key] !== 'string') warnings.push(`Malformed payload field ${key}; unavailable fields are not fabricated.`);
  }
  for (const [key, allowed] of Object.entries({ priority: priorities, severity: priorities, role: ['COMMANDER', 'FIELD_OPERATOR'], status: eventType.startsWith('MISSION_') ? missionStatuses : eventType.startsWith('MEMBER_') ? ['INVITED', 'ACTIVE', 'REMOVED'] : taskStatuses })) {
    if (key in payload && (typeof payload[key] !== 'string' || !allowed.includes(payload[key]))) warnings.push(`Malformed payload field ${key}; unsupported value ignored.`);
  }
  for (const key of ['createdAt', 'updatedAt', 'startedAt', 'completedAt', 'cancelledAt', 'blockedAt', 'joinedAt', 'checkedInAt']) {
    if (key in payload && payload[key] !== null && !validDate(payload[key])) warnings.push(`Malformed payload timestamp ${key}; unsupported value ignored.`);
  }
  if ('assignedTo' in payload && payload.assignedTo !== null && typeof payload.assignedTo !== 'string' && !(record(payload.assignedTo) && text(payload.assignedTo.id))) warnings.push('Malformed assignee reference; unsupported value ignored.');
  const missionId = raw.missionId as string;
  if (state.missionId && state.missionId !== missionId) {
    warnings.push('Event belongs to another mission; state unchanged.');
    return finish();
  }
  const targetId = text(raw.targetId);
  const updateMission = (data: Record<string, unknown>) => {
    const mission = { ...state.mission, id: missionId, ...missionFields(data), missingFields: [] } as HistoricalMission;
    mission.missingFields = missing(mission, ['title', 'description', 'location', 'severity', 'status', 'createdBy', 'createdAt', 'updatedAt']);
    mission.missingFields.push(...missing(mission, mission.status === 'ACTIVE' ? ['startedAt'] : mission.status === 'COMPLETED' ? ['startedAt', 'completedAt'] : mission.status === 'CANCELLED' ? ['cancelledAt'] : []));
    state.mission = mission;
    if (mission.missingFields.length) warnings.push(`Mission historical fields unavailable: ${mission.missingFields.join(', ')}.`);
  };
  const updateTask = (taskId: string | undefined, data: Record<string, unknown>) => {
    if (!taskId) { warnings.push('Task ID unavailable; task state unchanged.'); return false; }
    const task = { ...state.tasks[taskId], id: taskId, missionId, ...taskFields(data), missingFields: [] } as HistoricalTask;
    task.missingFields = missing(task, ['title', 'description', 'priority', 'status', 'assignedTo', 'createdBy', 'createdAt', 'updatedAt']);
    task.missingFields.push(...missing(task, task.status === 'ACTIVE' ? ['startedAt'] : task.status === 'BLOCKED' ? ['startedAt', 'blockedAt'] : task.status === 'COMPLETED' ? ['startedAt', 'completedAt'] : []));
    state.tasks = { ...state.tasks, [taskId]: task };
    if (task.missingFields.length) warnings.push(`Task ${taskId} historical fields unavailable: ${task.missingFields.join(', ')}.`);
    return true;
  };
  const updateMember = (memberId: string | undefined, data: Record<string, unknown>) => {
    if (!memberId) { warnings.push('Membership ID unavailable; member state unchanged.'); return false; }
    const member = { ...state.members[memberId], id: memberId, missionId, ...memberFields(data), missingFields: [] } as HistoricalMember;
    member.missingFields = missing(member, ['userId', 'name', 'role', 'status', 'createdAt', 'updatedAt']);
    if (member.status === 'ACTIVE') member.missingFields.push(...missing(member, ['joinedAt']));
    state.members = { ...state.members, [memberId]: member };
    if (member.missingFields.length) warnings.push(`Member ${memberId} historical fields unavailable: ${member.missingFields.join(', ')}.`);
    return true;
  };
  switch (eventType) {
    case 'MISSION_CREATED': case 'MISSION_UPDATED': updateMission(payload); entry.applied = true; break;
    case 'MISSION_STARTED': case 'MISSION_COMPLETED': case 'MISSION_CANCELLED': {
      const status = { MISSION_STARTED: 'ACTIVE', MISSION_COMPLETED: 'COMPLETED', MISSION_CANCELLED: 'CANCELLED' }[eventType];
      const timestamp = { MISSION_STARTED: 'startedAt', MISSION_COMPLETED: 'completedAt', MISSION_CANCELLED: 'cancelledAt' }[eventType];
      updateMission({ ...payload, status, [timestamp]: payload[timestamp] }); entry.applied = true; break;
    }
    case 'TASK_CREATED': case 'TASK_UPDATED': case 'TASK_ASSIGNED': case 'TASK_UNASSIGNED':
    case 'TASK_STARTED': case 'TASK_BLOCKED': case 'TASK_COMPLETED': {
      const data = { ...payload };
      if (eventType === 'TASK_UNASSIGNED') data.assignedTo = null;
      if (eventType === 'TASK_ASSIGNED') {
        if (data.assignedTo === undefined) data.assignedTo = text(data.userId);
        if (data.assignedTo === undefined) warnings.push('Assignee ID unavailable; name alone does not identify an assignee.');
        if (!text(data.assigneeName) && !text(data.assignedToName)) data.assigneeName = undefined;
      }
      if (eventType === 'TASK_STARTED') {
        data.status = 'ACTIVE';
        if (data.startedAt === undefined && !state.tasks[targetId || text(payload.taskId) || '']?.startedAt) data.startedAt = undefined;
      }
      if (eventType === 'TASK_BLOCKED') { data.status = 'BLOCKED'; data.blockedAt = payload.blockedAt; }
      if (eventType === 'TASK_COMPLETED') { data.status = 'COMPLETED'; data.completedAt = payload.completedAt; }
      entry.applied = updateTask(targetId || text(payload.taskId), data); break;
    }
    case 'MEMBER_ASSIGNED': case 'MEMBER_REACTIVATED': case 'MEMBER_REMOVED': case 'MEMBER_CHECKED_IN': {
      const data = { ...payload };
      if (eventType === 'MEMBER_ASSIGNED' || eventType === 'MEMBER_REACTIVATED') data.status = 'ACTIVE';
      if (eventType === 'MEMBER_ASSIGNED' || eventType === 'MEMBER_REACTIVATED') data.joinedAt = payload.joinedAt;
      if (eventType === 'MEMBER_REMOVED') data.status = 'REMOVED';
      if (eventType === 'MEMBER_CHECKED_IN') data.checkedInAt = at;
      entry.applied = updateMember(targetId || text(payload.memberId), data); break;
    }
    case 'OBSERVATION_RECORDED': {
      const observationText = text(payload.text) || text(payload.notes);
      if (!observationText) warnings.push('Observation text unavailable.');
      state.observations = [...state.observations, { eventId: id, createdAt: at, text: observationText, payload }];
      entry.applied = true; break;
    }
    case 'NETWORK_LOST': state.network = 'OFFLINE'; entry.applied = true; break;
    case 'NETWORK_RESTORED': state.network = 'ONLINE'; entry.applied = true; break;
    case 'SYNC_STARTED': state.sync = 'SYNCING'; entry.applied = true; break;
    case 'SYNC_COMPLETED': state.sync = 'COMPLETED'; entry.applied = true; break;
    case 'SYNC_CONFLICT': case 'CONFLICT_RESOLVED': {
      const conflictId = text(payload.conflictId);
      if (!conflictId) { warnings.push('Conflict ID unavailable; resolution cannot be correlated.'); break; }
      const prior = state.conflicts[conflictId];
      const resolved = eventType === 'CONFLICT_RESOLVED';
      const entityId = text(payload.entityId) || targetId || prior?.entityId;
      const entityType = text(payload.entityType) || text(raw.targetType) || prior?.entityType;
      const resolution = text(payload.resolution);
      if (resolved && !['KEEP_LOCAL', 'KEEP_SERVER', 'MERGE'].includes(resolution || '')) {
        warnings.push('Conflict resolution kind unavailable or invalid; state unchanged.');
        break;
      }
      const conflict: ReplayConflict = {
        ...prior, id: conflictId, entityId, entityType, status: resolved ? 'RESOLVED' : 'OPEN',
        ...(resolved ? { resolvedAt: at, resolution } : { detectedAt: at }),
        ...(record(payload.localState) ? { localState: payload.localState } : {}),
        ...(record(payload.serverState) ? { serverState: payload.serverState } : {}),
        history: [...(prior?.history || []), { eventId: id, at, action: resolved ? 'RESOLVED' : 'DETECTED', ...(resolution ? { resolution } : {}) }],
      };
      if (resolved) {
        if (record(payload.resolvedEntityState)) {
          const authoritative = payload.resolvedEntityState;
          conflict.resolvedEntityState = authoritative;
          if (entityType === 'TASK') updateTask(entityId, authoritative);
          else if (entityType === 'MISSION') updateMission(authoritative);
          else if (entityType === 'MEMBER') updateMember(entityId, authoritative);
          else warnings.push('Resolved entity type unsupported; resolution history retained.');
        } else warnings.push('Resolved authoritative state unavailable; rejected local state was not applied.');
      } else state.sync = 'CONFLICT';
      state.conflicts = { ...state.conflicts, [conflictId]: conflict };
      entry.applied = true; break;
    }
    default: warnings.push(`Unknown event type ${eventType}; state unchanged.`);
  }
  if (entry.applied) state.missionId = missionId;
  return finish();
}

/** Replay only the supplied ordered events. It deliberately accepts no current entity metadata. */
export function reconstructReplay(events: readonly unknown[]): ReplayState {
  return events.reduce<ReplayState>((state, event) => replayReducer(state, event), createEmptyReplayState());
}

/** Frame zero is empty; frame n is exactly the state after n loaded events. */
export function buildReplayFrames(events: readonly unknown[]): ReplayState[] {
  const frames = [createEmptyReplayState()];
  for (const event of events) frames.push(replayReducer(frames[frames.length - 1], event));
  return frames;
}

export function clampReplayIndex(index: number, frameCount: number): number {
  return Math.max(0, Math.min(Number.isFinite(index) ? Math.floor(index) : 0, Math.max(0, frameCount - 1)));
}

export function compareReplayEvents(a: { createdAt: string; id: string }, b: { createdAt: string; id: string }): number {
  const aTime = text(a?.createdAt) || '\uffff';
  const bTime = text(b?.createdAt) || '\uffff';
  const aId = text(a?.id) || '';
  const bId = text(b?.id) || '';
  return aTime < bTime ? -1 : aTime > bTime ? 1 : aId < bId ? -1 : aId > bId ? 1 : 0;
}

/** Stable IDs deduplicate page boundaries; pending entries never become replay history. */
export function authoritativeReplayEvents<T extends { id: string; createdAt: string; source: string; syncState?: string }>(events: readonly T[]): T[] {
  const unique = new Map<string, T>();
  const malformed: T[] = [];
  for (const event of events) {
    if (record(event) && (event.source === 'LOCAL' || event.syncState === 'PENDING')) continue;
    if (!record(event) || !text(event.id)) { malformed.push(event); continue; }
    if (!unique.has(event.id)) unique.set(event.id, event);
  }
  return [...unique.values(), ...malformed].sort(compareReplayEvents);
}
