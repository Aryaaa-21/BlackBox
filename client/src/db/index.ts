import Dexie, { Table } from 'dexie';
import type { Mission, MissionEvent, MissionMember, SyncConflict, SyncEntityType, SyncMutation, Task, User } from '../types';
import { applyTaskMutation, assertQueueTransition, compareQueuedMutations, mappedEntityId, stablePayload } from '../services/sync-policy';
import { authoritativeVersion, preferAuthoritative } from '../services/authority';

export type MutationQueueStatus = 'PENDING' | 'SYNCING' | 'FAILED' | 'CONFLICT';

export interface QueuedMutation extends SyncMutation {
  accountId?: string;
  status: MutationQueueStatus;
  attempts: number;
  lastAttemptAt?: string;
  lastError?: string;
  errorCode?: string;
  retryable?: boolean;
  nextAttemptAt?: string;
  queueOrder?: number;
  dependsOnMutationId?: string;
  wireMutation?: SyncMutation;
}

export interface EntityIdMapping {
  accountId: string;
  entityType: SyncEntityType;
  localId: string;
  serverId: string;
  mutationId: string;
  updatedAt: string;
}

export interface ClientMetadata {
  key: string;
  value: string;
}

export interface ClientSession {
  userId: string;
  user: User;
  token: string;
  savedAt: string;
}

type ScopedRecord<T> = T & { accountId?: string };

export interface MutationStateCounts {
  pending: number;
  syncing: number;
  failed: number;
  conflicts: number;
}

class BlackBoxDatabase extends Dexie {
  missions!: Table<ScopedRecord<Mission>, string>;
  tasks!: Table<ScopedRecord<Task>, string>;
  members!: Table<ScopedRecord<MissionMember>, string>;
  events!: Table<ScopedRecord<MissionEvent>, string>;
  users!: Table<ScopedRecord<User>, string>;
  mutations!: Table<QueuedMutation, string>;
  conflicts!: Table<ScopedRecord<SyncConflict>, string>;
  metadata!: Table<ClientMetadata, string>;
  sessions!: Table<ClientSession, string>;
  idMappings!: Table<EntityIdMapping, [string, string, string]>;

  constructor() {
    super('blackbox-operational-cache');
    this.version(1).stores({
      missions: 'id, status, updatedAt, createdAt',
      tasks: 'id, missionId, status, updatedAt, createdAt',
      members: 'id, missionId, userId, status, updatedAt',
      events: 'id, missionId, eventType, createdAt, idempotencyKey',
      users: 'id, role, email, name',
      mutations: 'mutationId, missionId, entityId, status, createdAt, idempotencyKey',
      conflicts: 'id, missionId, entityId, status, detectedAt',
      metadata: 'key',
    });
    this.version(2).stores({
      missions: 'id, status, updatedAt, createdAt',
      tasks: 'id, missionId, status, updatedAt, createdAt',
      members: 'id, missionId, userId, status, updatedAt',
      events: 'id, missionId, eventType, createdAt, idempotencyKey',
      users: 'id, role, email, name',
      mutations: 'mutationId, missionId, entityId, status, createdAt, idempotencyKey',
      conflicts: 'id, missionId, entityId, status, detectedAt',
      metadata: 'key',
       sessions: 'userId, savedAt',
     });
    this.version(3).stores({
      missions: 'id, accountId, status, updatedAt, createdAt',
      tasks: 'id, accountId, missionId, status, updatedAt, createdAt',
      members: 'id, accountId, missionId, userId, status, updatedAt',
      events: 'id, accountId, missionId, eventType, createdAt, idempotencyKey',
      users: 'id, accountId, role, email, name',
      mutations: 'mutationId, accountId, missionId, entityId, status, createdAt, idempotencyKey',
      conflicts: 'id, accountId, missionId, entityId, status, detectedAt',
      metadata: 'key',
      sessions: 'userId, savedAt',
    });
    this.version(4).stores({
      mutations: 'mutationId, accountId, missionId, entityId, status, createdAt, idempotencyKey, queueOrder',
      idMappings: '[accountId+entityType+localId], accountId, serverId',
    }).upgrade(async (transaction) => {
      const mutations = await transaction.table<QueuedMutation>('mutations').toArray();
      mutations.sort(compareQueuedMutations);
      let queueOrder = 0;
      const predecessors = new Map<string, string>();
      for (const mutation of mutations) {
        // Older records already identify their actor even if they predate account scoping.
        const accountId = mutation.accountId || mutation.actorId;
        const key = `${accountId}:${mutation.entityType}:${mutation.entityId}`;
        await transaction.table('mutations').put({ ...mutation, accountId, queueOrder: ++queueOrder, dependsOnMutationId: predecessors.get(key) });
        predecessors.set(key, mutation.mutationId);
      }
      await transaction.table('metadata').put({ key: 'queueSequence', value: String(queueOrder) });
    });
  }
}

export const db = new BlackBoxDatabase();
db.mutations.hook('updating', (changes, _key, mutation) => {
  for (const key of ['mutationId', 'idempotencyKey', 'deviceId', 'actorId', 'missionId', 'entityId', 'entityType', 'operationType', 'clientCreatedAt', 'createdAt'] as const) {
    if (key in changes && (changes as Partial<QueuedMutation>)[key] !== mutation[key]) throw new Error(`Mutation identity field ${key} is immutable`);
  }
  const nextStatus = (changes as Partial<QueuedMutation>).status;
  if (nextStatus) assertQueueTransition(mutation.status, nextStatus);
  if (mutation.wireMutation) {
    for (const [key, value] of Object.entries(changes)) {
      if (!['wireMutation', 'payload', 'baseVersion', 'baseUpdatedAt'].includes(key.split('.')[0])) continue;
      const previous = key.split('.').reduce<unknown>((current, part) => current && typeof current === 'object' ? (current as Record<string, unknown>)[part] : undefined, mutation);
      if (stablePayload(value) !== stablePayload(previous)) throw new Error(`Attempted mutation field ${key} is immutable`);
    }
  }
});

async function cacheVersioned<T extends { id: string; version?: number; updatedAt: string }>(table: Table<ScopedRecord<T>, string>, record: T, accountId?: string, select = preferAuthoritative<ScopedRecord<T>>): Promise<T> {
  accountId ??= await getActiveAccountId();
  return db.transaction('rw', table, async () => {
    const previous = await table.get(record.id);
    const selected = select(previous?.accountId === accountId ? previous : undefined, { ...record, accountId });
    if (selected !== previous) await table.put(selected);
    return selected;
  });
}

export async function cacheMission(mission: Mission, accountId?: string): Promise<Mission> { return cacheVersioned(db.missions, mission, accountId); }
export async function cacheMissions(missions: Mission[], accountId?: string): Promise<Mission[]> { accountId ??= await getActiveAccountId(); return db.transaction('rw', db.missions, () => Promise.all(missions.map((mission) => cacheMission(mission, accountId)))); }
export async function cacheTask(task: Task, accountId?: string): Promise<Task> { return cacheVersioned(db.tasks, task, accountId); }
export async function cacheTasks(tasks: Task[], accountId?: string): Promise<Task[]> { accountId ??= await getActiveAccountId(); return db.transaction('rw', db.tasks, () => Promise.all(tasks.map((task) => cacheTask(task, accountId)))); }
export async function cacheMembers(members: MissionMember[], accountId?: string): Promise<MissionMember[]> { accountId ??= await getActiveAccountId(); return db.transaction('rw', db.members, () => Promise.all(members.map((member) => cacheMember(member, accountId)))); }
export async function cacheMember(member: MissionMember, accountId?: string): Promise<MissionMember> { return cacheVersioned(db.members, member, accountId); }
export async function cacheEvent(event: MissionEvent, accountId?: string): Promise<MissionEvent> {
  accountId ??= await getActiveAccountId();
  return db.transaction('rw', db.events, async () => {
    const previous = await db.events.get(event.id);
    // Authoritative events are immutable, keyed by stable server ID. A pending row
    // can never replace one, including when replay and realtime race.
    if (previous && previous.accountId === accountId && previous.source !== 'LOCAL') return previous;
    const selected = { ...event, accountId };
    await db.events.put(selected);
    return selected;
  });
}
export async function cacheEvents(events: MissionEvent[], accountId?: string): Promise<MissionEvent[]> { accountId ??= await getActiveAccountId(); return db.transaction('rw', db.events, () => Promise.all(events.map((event) => cacheEvent(event, accountId)))); }
export async function cacheUsers(users: User[], accountId?: string): Promise<void> { accountId ??= await getActiveAccountId(); await db.users.bulkPut(users.map((record) => ({ ...record, accountId }))); }
export async function cacheConflict(conflict: SyncConflict, accountId?: string): Promise<SyncConflict> {
  return cacheVersioned(db.conflicts, conflict, accountId, (current, incoming) => {
    const selected = preferAuthoritative(current, incoming);
    // A delayed provisional CONFLICT acknowledgement cannot reopen a resolution.
    if (current && current.status !== 'OPEN' && incoming.status === 'OPEN' && (authoritativeVersion(incoming) ?? -1) <= (authoritativeVersion(current) ?? -1)) return current;
    return selected;
  });
}

export async function getCachedMissions(): Promise<Mission[]> {
  const accountId = await getActiveAccountId();
  if (!accountId) return [];
  return db.missions.orderBy('createdAt').reverse().filter((mission) => mission.accountId === accountId).toArray();
}

export async function getCachedMission(missionId: string): Promise<Mission | undefined> {
  const accountId = await getActiveAccountId();
  if (!accountId) return undefined;
  const mission = await db.missions.get(missionId);
  return mission?.accountId === accountId ? mission : undefined;
}

export async function getCachedTasks(missionId: string, accountId?: string): Promise<Task[]> {
  accountId ??= await getActiveAccountId();
  if (!accountId) return [];
  const [tasks, mutations, mappings] = await Promise.all([
    db.tasks.filter((task) => task.accountId === accountId && (typeof task.missionId === 'string' ? task.missionId : task.missionId.id) === missionId).toArray(),
    getAccountMutations(accountId), getIdMappings(accountId),
  ]);
  const projected = new Map(tasks.map((task) => [mappedEntityId('TASK', task.id, mappings), { ...task, id: mappedEntityId('TASK', task.id, mappings) }]));
  const baselines = new Map(projected);
  const projectedMutations = new Set<string>();
  for (const mutation of mutations) {
    if (mutation.entityType !== 'TASK' || mutation.missionId !== missionId) continue;
    const id = mappedEntityId('TASK', mutation.entityId, mappings);
    const task = projected.get(id);
    // A higher server version is authoritative even while an old local mutation
    // waits to be rejected/reconciled. Keep that work in the queue, not on top of it.
    if (task?.version !== undefined && mutation.baseVersion !== undefined && task.version > mutation.baseVersion) continue;
    if (task?.version !== undefined && mutation.baseVersion === undefined && mutation.operationType !== 'CREATE_TASK' && mutation.baseUpdatedAt !== baselines.get(id)?.updatedAt && !projectedMutations.has(mutation.dependsOnMutationId || '')) continue;
    if (task && mutation.status !== 'CONFLICT') {
      projected.set(id, { ...task, ...applyTaskMutation(task, mutation), localPending: true });
      projectedMutations.add(mutation.mutationId);
    }
  }
  return [...projected.values()];
}

export async function getCachedTask(taskId: string, accountId?: string): Promise<Task | undefined> {
  accountId ??= await getActiveAccountId();
  if (!accountId) return undefined;
  const id = await resolveEntityId('TASK', taskId, accountId);
  const task = await db.tasks.get(id);
  if (task?.accountId !== accountId) return undefined;
  const missionId = typeof task.missionId === 'string' ? task.missionId : task.missionId.id;
  return (await getCachedTasks(missionId, accountId)).find((item) => item.id === id);
}

export async function getCachedMembers(missionId: string): Promise<MissionMember[]> {
  const accountId = await getActiveAccountId();
  if (!accountId) return [];
  return db.members.where('missionId').equals(missionId).filter((member) => member.accountId === accountId).toArray();
}

export async function getCachedEvents(missionId: string, accountId?: string): Promise<MissionEvent[]> {
  accountId ??= await getActiveAccountId();
  if (!accountId) return [];
  const events = await db.events.where('missionId').equals(missionId).filter((event) => event.accountId === accountId).toArray();
  const unique = new Map<string, MissionEvent>();
  const authoritativeKeys = new Set(events.filter((event) => event.source !== 'LOCAL' && event.idempotencyKey).map((event) => event.idempotencyKey));
  for (const event of events) {
    if (event.source === 'LOCAL' && event.idempotencyKey && authoritativeKeys.has(event.idempotencyKey)) continue;
    if (!unique.has(event.id) || unique.get(event.id)?.source === 'LOCAL') unique.set(event.id, event);
  }
  return [...unique.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export async function getCachedConflicts(missionId: string): Promise<SyncConflict[]> {
  const accountId = await getActiveAccountId();
  if (!accountId) return [];
  const conflicts = await db.conflicts.where('missionId').equals(missionId).filter((conflict) => conflict.accountId === accountId).toArray();
  return conflicts.filter((conflict) => conflict.status === 'OPEN').sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}

export async function getCachedConflict(conflictId: string): Promise<SyncConflict | undefined> {
  const accountId = await getActiveAccountId();
  if (!accountId) return undefined;
  const conflict = await db.conflicts.get(conflictId);
  return conflict?.accountId === accountId ? conflict : undefined;
}

export async function getCachedOpenConflicts(): Promise<SyncConflict[]> {
  const accountId = await getActiveAccountId();
  if (!accountId) return [];
  return db.conflicts.where('status').equals('OPEN').filter((conflict) => conflict.accountId === accountId).sortBy('detectedAt').then((items) => items.reverse());
}

export async function getDeviceId(): Promise<string> {
  return db.transaction('rw', db.metadata, async () => {
    const existing = await db.metadata.get('deviceId');
    if (existing?.value) return existing.value;
    const deviceId = `device-${createUuid()}`;
    await db.metadata.add({ key: 'deviceId', value: deviceId });
    return deviceId;
  });
}

export async function getAccountMutations(accountId: string): Promise<QueuedMutation[]> {
  return (await db.mutations.where('accountId').equals(accountId).toArray()).sort(compareQueuedMutations);
}

export async function getIdMappings(accountId: string): Promise<EntityIdMapping[]> {
  return db.idMappings.where('accountId').equals(accountId).toArray();
}

export async function resolveEntityId(entityType: SyncEntityType, entityId: string, accountId?: string): Promise<string> {
  accountId ??= await getActiveAccountId();
  if (!accountId) return entityId;
  return (await db.idMappings.get([accountId, entityType, entityId]))?.serverId || entityId;
}

export async function getPendingMutations(limit = 20): Promise<QueuedMutation[]> {
  const accountId = await getActiveAccountId();
  return accountId ? (await getAccountMutations(accountId)).filter((mutation) => mutation.status === 'PENDING').slice(0, limit) : [];
}

export async function getMutationStateCounts(): Promise<MutationStateCounts> {
  const accountId = await getActiveAccountId();
  if (!accountId) return { pending: 0, syncing: 0, failed: 0, conflicts: 0 };
  const count = (status: MutationQueueStatus) => db.mutations.where('status').equals(status).filter((mutation) => mutation.accountId === accountId).count();
  const [pending, syncing, failed, conflicts] = await Promise.all([count('PENDING'), count('SYNCING'), count('FAILED'), count('CONFLICT')]);
  return { pending: pending + syncing, syncing, failed, conflicts };
}

export async function getMutationsByStatus(status: MutationQueueStatus): Promise<QueuedMutation[]> {
  const accountId = await getActiveAccountId();
  return accountId ? (await getAccountMutations(accountId)).filter((mutation) => mutation.status === status) : [];
}

export async function saveSession(session: ClientSession): Promise<void> {
  await db.transaction('rw', db.sessions, db.metadata, async () => {
    await db.sessions.put(session);
    await db.metadata.put({ key: 'activeAccountId', value: session.userId });
  });
  persistSessionToken(session);
}

export async function getCachedSession(): Promise<ClientSession | undefined> {
  const activeAccount = await db.metadata.get('activeAccountId');
  if (!activeAccount?.value) return undefined;
  return db.sessions.get(activeAccount.value);
}

export async function clearSession(userId?: string): Promise<void> {
  const activeAccount = await db.metadata.get('activeAccountId');
  const accountId = userId || activeAccount?.value;
  if (!userId || activeAccount?.value === userId) clearPersistedSessionToken();
  if (accountId) await db.sessions.delete(accountId);
  if (!userId || activeAccount?.value === userId) {
    await db.metadata.delete('activeAccountId');
  }
}

export async function getActiveAccountId(): Promise<string | undefined> {
  return (await db.metadata.get('activeAccountId'))?.value;
}

export function getPersistedSessionToken(): string | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  const activeAccountId = localStorage.getItem('blackbox.activeAccountId');
  if (!activeAccountId) return undefined;
  return localStorage.getItem(`blackbox.session.${activeAccountId}`) || undefined;
}

export async function cacheEntity(entityType: SyncEntityType, entity: Record<string, unknown>, accountId?: string): Promise<void> {
  accountId ??= await getActiveAccountId();
  if (!accountId || typeof entity.id !== 'string') return;
  if (entityType === 'MISSION') await cacheMission(entity as unknown as Mission, accountId);
  if (entityType === 'MEMBER') await cacheMember(entity as unknown as MissionMember, accountId);
  if (entityType === 'TASK') await cacheTask(entity as unknown as Task, accountId);
  if (entityType === 'EVENT') await cacheEvent(entity as unknown as MissionEvent, accountId);
}

/** Direct API responses must obey the same version ordering as persistent writes. */
export async function preferCachedEntity(entityType: SyncEntityType, entity: Record<string, unknown>, accountId?: string): Promise<Record<string, unknown>> {
  accountId ??= await getActiveAccountId();
  if (typeof entity.id !== 'string') return entity;
  const table = entityType === 'MISSION' ? db.missions : entityType === 'MEMBER' ? db.members : entityType === 'TASK' ? db.tasks : db.events;
  const cached = await table.get(entity.id);
  if (!cached || cached.accountId !== accountId) return entity;
  if (entityType === 'EVENT') return cached as unknown as Record<string, unknown>;
  return preferAuthoritative(cached, entity as unknown as typeof cached) as unknown as Record<string, unknown>;
}

export async function deleteCachedEntity(entityType: SyncEntityType, entityId: string): Promise<void> {
  if (entityType === 'MISSION') await db.missions.delete(entityId);
  if (entityType === 'MEMBER') await db.members.delete(entityId);
  if (entityType === 'TASK') await db.tasks.delete(entityId);
  if (entityType === 'EVENT') await db.events.delete(entityId);
}

export function createUuid(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  throw new Error('Secure random UUID generation is unavailable; refusing to create an unstable mutation identity');
}

/** Query-specific snapshots distinguish an empty successful response from an unprimed cache. */
export function cacheResponseKey(scope: string, query?: object): string {
  const entries = Object.entries(query || {}).filter(([, value]) => value !== undefined && value !== '').sort(([a], [b]) => a.localeCompare(b));
  return `${scope}:${JSON.stringify(entries)}`;
}

export async function cacheResponse<T>(key: string, value: T, accountId?: string): Promise<void> {
  accountId ??= await getActiveAccountId();
  if (accountId) await db.metadata.put({ key: `cache:${accountId}:${key}`, value: JSON.stringify(value) });
}

export async function getCachedResponse<T>(key: string, accountId?: string): Promise<T | undefined> {
  accountId ??= await getActiveAccountId();
  if (!accountId) return undefined;
  const cached = await db.metadata.get(`cache:${accountId}:${key}`);
  if (!cached) return undefined;
  try { return JSON.parse(cached.value) as T; } catch { return undefined; }
}

function persistSessionToken(session: ClientSession): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('blackbox.activeAccountId', session.userId);
  localStorage.setItem(`blackbox.session.${session.userId}`, session.token);
}

function clearPersistedSessionToken(): void {
  if (typeof localStorage === 'undefined') return;
  const activeAccountId = localStorage.getItem('blackbox.activeAccountId');
  if (activeAccountId) localStorage.removeItem(`blackbox.session.${activeAccountId}`);
  localStorage.removeItem('blackbox.activeAccountId');
}
