import { create } from 'zustand';
import { liveQuery } from 'dexie';
import { eventsApi, membersApi, missionsApi, tasksApi, usersApi } from '../api';
import {
  cacheEvent, cacheMission, cacheTask,
  getCachedEvents, getCachedMembers, getCachedMissions, getCachedTasks, getCachedResponse, cacheResponseKey, getAccountMutations, getActiveAccountId, getIdMappings,
} from '../db';
import type {
  EventListData, EventQuery, Mission, MissionEvent, MissionMember, MissionQuery, MissionStats, Task, TaskQuery,
  TaskStats, User, MissionListData, MissionTasksData,
} from '../types';
import { canUseOfflineCache, mappedEntityId } from '../services/sync-policy';
import { filterEvents, filterMissions, filterTasks, paginateCached } from '../services/cache-policy';
import { mergeAuthoritativeRows, mergeTaskViews, preferAuthoritative, preferTaskView } from '../services/authority';

function mergeEvents(current: MissionEvent[], incoming: MissionEvent[]): MissionEvent[] {
  const byId = new Map(current.map((event) => [event.id, event]));
  return incoming.map((event) => {
    const previous = byId.get(event.id);
    return previous && previous.source !== 'LOCAL' ? previous : event;
  });
}

// A liveQuery result can finish after a newer optimistic write. Keep local
// rows that were not present in that older result until a later authoritative
// acknowledgement or refresh replaces them. Without this guard, an in-flight
// cache read could make an offline task/observation disappear or roll back in
// the visible store even though its IndexedDB mutation is still durable.
function mergeLiveTasks(current: Task[], incoming: Task[]): Task[] {
  const merged = mergeTaskViews(current, incoming);
  const incomingIds = new Set(incoming.map((task) => task.id));
  return [...merged, ...current.filter((task) => task.localPending === true && !incomingIds.has(task.id))];
}

function mergeLiveEvents(current: MissionEvent[], incoming: MissionEvent[]): MissionEvent[] {
  const merged = mergeEvents(current, incoming);
  const incomingIds = new Set(incoming.map((event) => event.id));
  return [...merged, ...current.filter((event) => event.source === 'LOCAL' && !incomingIds.has(event.id))];
}

interface OperationsState {
  missions: Mission[];
  missionStats: MissionStats | null;
  tasksByMission: Record<string, Task[]>;
  taskStatsByMission: Record<string, TaskStats>;
  membersByMission: Record<string, MissionMember[]>;
  eventsByMission: Record<string, MissionEvent[]>;
  users: User[];
  loading: boolean;
  error: string | null;
  upsertMission: (mission: Mission) => void;
  upsertTask: (task: Task) => void;
  upsertMember: (member: MissionMember) => void;
  upsertEvent: (event: MissionEvent) => void;
  loadMissions: (query?: MissionQuery) => Promise<Mission[]>;
  loadMissionStats: () => Promise<MissionStats>;
  loadTasks: (missionId: string, query?: TaskQuery) => Promise<Task[]>;
  loadMembers: (missionId: string, includeRemoved?: boolean) => Promise<MissionMember[]>;
  loadEvents: (missionId: string, query?: EventQuery) => Promise<EventListData>;
  searchUsers: (query?: { role?: 'COMMANDER' | 'FIELD_OPERATOR'; search?: string }) => Promise<User[]>;
  hydrateCache: (missionId?: string) => Promise<void>;
  observeCache: () => () => void;
  reset: () => void;
  clearError: () => void;
}

const messageFor = (error: unknown) => error instanceof Error ? error.message : 'Operation failed';
const canUseCachedFallback = canUseOfflineCache;

export const useOperationsStore = create<OperationsState>((set) => {
  const taskQueries = new Map<string, TaskQuery | undefined>();
  const eventQueries = new Map<string, EventQuery | undefined>();
  const withError = async <T>(run: () => Promise<T>): Promise<T> => {
    set({ loading: true, error: null });
    try { return await run(); }
    catch (error) { set({ error: messageFor(error) }); throw error; }
    finally { set({ loading: false }); }
  };

  return {
    missions: [], missionStats: null, tasksByMission: {}, taskStatsByMission: {}, membersByMission: {}, eventsByMission: {}, users: [],
    loading: false, error: null,

    upsertMission: (mission) => set((state) => ({ missions: state.missions.some((item) => item.id === mission.id) ? state.missions.map((item) => item.id === mission.id ? preferAuthoritative(item, mission) : item) : [mission, ...state.missions] })),
    upsertTask: (task) => set((state) => {
      const missionId = typeof task.missionId === 'string' ? task.missionId : task.missionId.id;
      const current = state.tasksByMission[missionId] || [];
      return { tasksByMission: { ...state.tasksByMission, [missionId]: current.some((item) => item.id === task.id) ? current.map((item) => item.id === task.id ? preferTaskView(item, task) : item) : [task, ...current] } };
    }),
    upsertMember: (member) => set((state) => {
      const current = state.membersByMission[member.missionId] || [];
      return { membersByMission: { ...state.membersByMission, [member.missionId]: current.some((item) => item.id === member.id) ? current.map((item) => item.id === member.id ? preferAuthoritative(item, member) : item) : [...current, member] } };
    }),
    upsertEvent: (event) => set((state) => {
      const current = state.eventsByMission[event.missionId] || [];
      return { eventsByMission: { ...state.eventsByMission, [event.missionId]: current.some((item) => item.id === event.id) ? mergeEvents(current, current.map((item) => item.id === event.id ? event : item)) : [event, ...current] } };
    }),

    loadMissions: (query) => withError(async () => {
      try {
        const result = await missionsApi.list(query);
        let missions = result.missions;
        set((state) => ({ missions: missions = mergeAuthoritativeRows(state.missions, missions) }));
        return missions;
      } catch (error) {
        if (!canUseCachedFallback(error)) throw error;
        const cached = await getCachedMissions();
        const snapshot = await getCachedResponse<MissionListData>(cacheResponseKey('missions', query));
        if (!cached.length && !snapshot) throw error;
        const items = snapshot ? snapshot.missions.map((mission) => cached.find((item) => item.id === mission.id) || mission) : paginateCached(filterMissions(cached, query), query, 20).items;
        let missions = filterMissions(items, query);
        set((state) => ({ missions: missions = mergeAuthoritativeRows(state.missions, missions) }));
        return missions;
      }
    }),
    loadMissionStats: () => withError(async () => {
      const stats = await missionsApi.stats();
      set({ missionStats: stats });
      return stats;
    }),
    loadTasks: (missionId, query) => withError(async () => {
      taskQueries.set(missionId, query);
      try {
        const result = await tasksApi.mission(missionId, query);
        let tasks = result.tasks;
        set((state) => ({ tasksByMission: { ...state.tasksByMission, [missionId]: tasks = mergeTaskViews(state.tasksByMission[missionId] || [], tasks) }, taskStatsByMission: { ...state.taskStatsByMission, [missionId]: result.stats } }));
        return tasks;
      } catch (error) {
        if (!canUseCachedFallback(error)) throw error;
        const cached = await getCachedTasks(missionId);
        const snapshot = await getCachedResponse<MissionTasksData>(cacheResponseKey(`tasks:${missionId}`, query));
        if (!cached.length && !snapshot) throw error;
        const ids = new Set(snapshot?.tasks.map((task) => task.id));
        const accountId = await getActiveAccountId();
        const mappings = accountId ? await getIdMappings(accountId) : [];
        for (const mapping of mappings.filter((mapping) => mapping.entityType === 'TASK')) ids.add(mapping.serverId);
        for (const mutation of accountId ? await getAccountMutations(accountId) : []) {
          if (mutation.entityType === 'TASK') ids.add(mappedEntityId('TASK', mutation.entityId, mappings));
        }
        let items = filterTasks(snapshot ? cached.filter((task) => ids.has(task.id) || task.id.startsWith('local-')) : paginateCached(filterTasks(cached, query), query).items, query);
        set((state) => ({ tasksByMission: { ...state.tasksByMission, [missionId]: items = mergeTaskViews(state.tasksByMission[missionId] || [], items) }, ...(snapshot ? { taskStatsByMission: { ...state.taskStatsByMission, [missionId]: snapshot.stats } } : {}) }));
        return items;
      }
    }),
    loadMembers: (missionId, includeRemoved) => withError(async () => {
      try {
        let members = await membersApi.list(missionId, includeRemoved);
        set((state) => ({ membersByMission: { ...state.membersByMission, [missionId]: members = mergeAuthoritativeRows(state.membersByMission[missionId] || [], members) } }));
        return members;
      } catch (error) {
        if (!canUseCachedFallback(error)) throw error;
        const cached = await getCachedMembers(missionId);
        const snapshot = await getCachedResponse<MissionMember[]>(cacheResponseKey(`members:${missionId}`, { includeRemoved: Boolean(includeRemoved) }));
        if (!cached.length && !snapshot) throw error;
        let members = (snapshot ? snapshot.map((member) => cached.find((item) => item.id === member.id) || member) : cached).filter((member) => includeRemoved || member.status !== 'REMOVED');
        set((state) => ({ membersByMission: { ...state.membersByMission, [missionId]: members = mergeAuthoritativeRows(state.membersByMission[missionId] || [], members) } }));
        return members;
      }
    }),
    loadEvents: (missionId, query) => withError(async () => {
      eventQueries.set(missionId, query);
      try {
        const result = await eventsApi.list(missionId, query);
        let events = result.events;
        set((state) => ({ eventsByMission: { ...state.eventsByMission, [missionId]: events = mergeEvents(state.eventsByMission[missionId] || [], events) } }));
        return { ...result, events };
      } catch (error) {
        if (!canUseCachedFallback(error)) throw error;
        const cached = await getCachedEvents(missionId);
        const snapshot = await getCachedResponse<EventListData>(cacheResponseKey(`events:${missionId}`, query));
        if (!cached.length && !snapshot) throw error;
        const ids = new Set(snapshot?.events.map((event) => event.id));
        const accountId = await getActiveAccountId();
        const mappings = accountId ? await getIdMappings(accountId) : [];
        for (const mapping of mappings.filter((mapping) => mapping.entityType === 'EVENT')) ids.add(mapping.serverId);
        const page = paginateCached(filterEvents(cached, query), query);
        let events = snapshot ? filterEvents(cached.filter((event) => ids.has(event.id) || event.source === 'LOCAL'), query) : page.items;
        const result = { events, pagination: snapshot?.pagination || page.pagination };
        set((state) => ({ eventsByMission: { ...state.eventsByMission, [missionId]: events = mergeEvents(state.eventsByMission[missionId] || [], events) } }));
        return { ...result, events };
      }
    }),
    searchUsers: (query) => withError(async () => {
      const users = await usersApi.search(query);
      set({ users });
      return users;
    }),
    hydrateCache: async (missionId) => {
      const missions = await getCachedMissions();
      const statePatch: Partial<OperationsState> = { missions };
      if (missionId) {
        const [tasks, members, events] = await Promise.all([
          getCachedTasks(missionId),
          getCachedMembers(missionId),
          getCachedEvents(missionId),
        ]);
        statePatch.tasksByMission = { ...useOperationsStore.getState().tasksByMission, [missionId]: tasks };
        statePatch.membersByMission = { ...useOperationsStore.getState().membersByMission, [missionId]: members };
        statePatch.eventsByMission = { ...useOperationsStore.getState().eventsByMission, [missionId]: events };
      }
      set((state) => ({ ...statePatch, missions: mergeAuthoritativeRows(state.missions, missions),
        ...(missionId ? {
          tasksByMission: { ...state.tasksByMission, [missionId]: mergeTaskViews(state.tasksByMission[missionId] || [], statePatch.tasksByMission?.[missionId] || []) },
          membersByMission: { ...state.membersByMission, [missionId]: mergeAuthoritativeRows(state.membersByMission[missionId] || [], statePatch.membersByMission?.[missionId] || []) },
          eventsByMission: { ...state.eventsByMission, [missionId]: mergeEvents(state.eventsByMission[missionId] || [], statePatch.eventsByMission?.[missionId] || []) },
        } : {}),
      }));
    },
    observeCache: () => {
      const subscription = liveQuery(async () => {
        const accountId = await getActiveAccountId();
        const allMissions = await getCachedMissions();
        const mappings = accountId ? await getIdMappings(accountId) : [];
        const mappedTaskIds = new Set(mappings.filter((mapping) => mapping.entityType === 'TASK').map((mapping) => mapping.serverId));
        for (const mutation of accountId ? await getAccountMutations(accountId) : []) {
          if (mutation.entityType === 'TASK') mappedTaskIds.add(mappedEntityId('TASK', mutation.entityId, mappings));
        }
        const mappedEventIds = new Set(mappings.filter((mapping) => mapping.entityType === 'EVENT').map((mapping) => mapping.serverId));
        const ids = new Set([...allMissions.map((mission) => mission.id), ...Object.keys(useOperationsStore.getState().tasksByMission)]);
        const entries = await Promise.all([...ids].map(async (id) => {
          const tasks = await getCachedTasks(id);
          const events = await getCachedEvents(id);
          const taskQuery = taskQueries.get(id);
          const eventQuery = eventQueries.get(id);
          const taskSnapshot = await getCachedResponse<MissionTasksData>(cacheResponseKey(`tasks:${id}`, taskQuery));
          const eventSnapshot = await getCachedResponse<EventListData>(cacheResponseKey(`events:${id}`, eventQuery));
          const taskIds = new Set(taskSnapshot?.tasks.map((task) => task.id));
          const eventIds = new Set(eventSnapshot?.events.map((event) => event.id));
          // Retain newly received realtime rows until the next authoritative list refresh.
          for (const task of useOperationsStore.getState().tasksByMission[id] || []) taskIds.add(task.id);
          for (const event of useOperationsStore.getState().eventsByMission[id] || []) eventIds.add(event.id);
          return [id,
            taskSnapshot ? filterTasks(tasks.filter((task) => taskIds.has(task.id) || task.id.startsWith('local-') || mappedTaskIds.has(task.id)), taskQuery) : paginateCached(filterTasks(tasks, taskQuery), taskQuery).items,
            eventSnapshot ? filterEvents(events.filter((event) => eventIds.has(event.id) || event.source === 'LOCAL' || mappedEventIds.has(event.id)), eventQuery) : paginateCached(filterEvents(events, eventQuery), eventQuery).items,
          ] as const;
        }));
        return { accountId, entries };
      }).subscribe({ next: ({ entries }) => {
        set((state) => ({ tasksByMission: Object.fromEntries(entries.map(([id, tasks]) => [id, mergeLiveTasks(state.tasksByMission[id] || [], tasks)])), eventsByMission: Object.fromEntries(entries.map(([id, , events]) => [id, mergeLiveEvents(state.eventsByMission[id] || [], events)])) }));
      }, error: (error: unknown) => set({ error: messageFor(error) }) });
      return () => subscription.unsubscribe();
    },
    reset: () => {
      taskQueries.clear(); eventQueries.clear();
      set({ missions: [], missionStats: null, tasksByMission: {}, taskStatsByMission: {}, membersByMission: {}, eventsByMission: {}, users: [], error: null });
    },
    clearError: () => set({ error: null }),
  };
});

export async function cacheSingleMission(mission: Mission): Promise<void> { useOperationsStore.getState().upsertMission(await cacheMission(mission)); }
export async function cacheSingleTask(task: Task): Promise<void> { useOperationsStore.getState().upsertTask(await cacheTask(task)); }
export async function cacheSingleEvent(event: MissionEvent): Promise<void> { useOperationsStore.getState().upsertEvent(await cacheEvent(event)); }
