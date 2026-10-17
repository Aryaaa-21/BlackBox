import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import { createRealtimeSocket, joinMission, leaveMission, subscribeToMissionEvents, type ClientToServerEvents, type ServerToClientEvents } from '../realtime/socket';
import { cacheSingleEvent, cacheSingleMission, cacheSingleTask, useOperationsStore } from './operations.store';
import { useSyncStore } from './sync.store';
import { cacheEntity, cacheMember, getPersistedSessionToken } from '../db';
import type { SocketWelcome } from '../types';

type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface RealtimeState {
  connected: boolean;
  welcome: SocketWelcome | null;
  lastError: string | null;
  socket: RealtimeSocket | null;
  missionIds: string[];
  cleanupListeners: (() => void) | null;
  connect: (token?: string) => RealtimeSocket;
  disconnect: () => void;
  joinMission: (missionId: string) => Promise<{ success: boolean; error?: string; room?: string }>;
  leaveMission: (missionId: string) => void;
}

export const useRealtimeStore = create<RealtimeState>((set, get) => ({
  connected: false,
  welcome: null,
  lastError: null,
  socket: null,
  missionIds: [],
  cleanupListeners: null,
  connect: (token) => {
    const missionIds = get().missionIds;
    get().disconnect();
    set({ missionIds });
    const socket = createRealtimeSocket(token || getPersistedSessionToken());
    let hasConnected = false;
    const publish = (work: Promise<unknown>) => { void work.catch((error: unknown) => set({ lastError: error instanceof Error ? error.message : 'Unable to cache realtime update' })); };
    const unsubscribe = subscribeToMissionEvents(socket, {
      connect: () => {
        const recovering = hasConnected;
        hasConnected = true;
        set({ connected: true, lastError: null });
        // Socket.IO only guarantees delivery while connected. On a reconnect,
        // rejoin first and then backfill the durable REST/cache projections so
        // updates committed during the disconnect cannot leave the UI stale.
        void Promise.all(get().missionIds.map(async (missionId) => {
          await joinMission(socket, missionId);
          if (recovering) {
            const operations = useOperationsStore.getState();
            await Promise.all([
              operations.loadTasks(missionId),
              operations.loadMembers(missionId),
              operations.loadEvents(missionId, { limit: 100 }),
              useSyncStore.getState().refresh(missionId),
            ]);
          }
        })).catch((error: unknown) => set({ lastError: error instanceof Error ? error.message : 'Unable to recover realtime state' }));
      },
      disconnect: () => set({ connected: false }),
      connect_error: (error) => set({ connected: false, lastError: error.message }),
      'system:welcome': (welcome) => set({ welcome }),
      'mission:created': (mission) => publish(cacheSingleMission(mission)),
      'mission:updated': (mission) => publish(cacheSingleMission(mission)),
      'mission:started': (mission) => publish(cacheSingleMission(mission)),
      'mission:completed': (mission) => publish(cacheSingleMission(mission)),
      'mission:cancelled': (mission) => publish(cacheSingleMission(mission)),
      'task:created': ({ task }) => publish(cacheSingleTask(task)),
      'task:updated': ({ task }) => publish(cacheSingleTask(task)),
      'task:assigned': ({ task }) => publish(cacheSingleTask(task)),
      'task:unassigned': ({ task }) => publish(cacheSingleTask(task)),
      'task:status_changed': ({ task }) => publish(cacheSingleTask(task)),
      'mission:member_added': ({ member }) => publish(cacheMember(member).then((selected) => useOperationsStore.getState().upsertMember(selected))),
      'mission:member_removed': ({ member }) => publish(cacheMember(member).then((selected) => useOperationsStore.getState().upsertMember(selected))),
      'mission:member_reactivated': ({ member }) => publish(cacheMember(member).then((selected) => useOperationsStore.getState().upsertMember(selected))),
      'mission:event_created': ({ event }) => publish(cacheSingleEvent(event)),
      'sync:conflict_resolved': (event) => { publish(useSyncStore.getState().handleConflictResolved(event)); publish(cacheEntity(event.entityType as 'MISSION' | 'MEMBER' | 'TASK' | 'EVENT', event.entity || {})); },
    });
    set({ socket, connected: socket.connected, cleanupListeners: unsubscribe });
    return socket;
  },
  disconnect: () => {
    const socket = get().socket;
    get().cleanupListeners?.();
    if (socket) {
      socket.disconnect();
    }
    set({ socket: null, connected: false, welcome: null, missionIds: [], cleanupListeners: null });
  },
  joinMission: async (missionId) => {
    const socket = get().socket;
    if (!socket) return Promise.reject(new Error('Realtime socket is not connected'));
    if (!socket.connected) {
      await waitForSocketConnection(socket);
    }
    const result = await joinMission(socket, missionId);
    if (result.success) set((state) => ({ missionIds: state.missionIds.includes(missionId) ? state.missionIds : [...state.missionIds, missionId] }));
    return result;
  },
  leaveMission: (missionId) => {
    const socket = get().socket;
    if (socket?.connected) leaveMission(socket, missionId);
    set((state) => ({ missionIds: state.missionIds.filter((id) => id !== missionId) }));
  },
}));

function waitForSocketConnection(socket: RealtimeSocket): Promise<void> {
  if (socket.connected) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onError);
      reject(new Error('Realtime connection timed out'));
    }, 10000);
    const onConnect = () => {
      clearTimeout(timeout);
      socket.off('connect_error', onError);
      resolve();
    };
    const onError = (error: Error) => {
      clearTimeout(timeout);
      socket.off('connect', onConnect);
      reject(error);
    };
    socket.once('connect', onConnect);
    socket.once('connect_error', onError);
  });
}
