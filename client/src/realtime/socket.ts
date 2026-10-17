import { io, Socket } from 'socket.io-client';
import type {
  Mission, MissionEvent, MissionMember, SocketWelcome, SyncConflict, Task,
} from '../types';

export interface MissionTaskPayload { missionId: string; task: Task; }
export interface MemberPayload { missionId: string; member: MissionMember; userId?: string; }
export interface ConflictResolvedPayload {
  conflictId: string;
  version?: number;
  resolution: 'KEEP_LOCAL' | 'KEEP_SERVER' | 'MERGE';
  entityType: string;
  entityId: string;
  entity?: Record<string, unknown>;
}

export interface ServerToClientEvents {
  'system:welcome': (payload: SocketWelcome) => void;
  'mission:created': (mission: Mission) => void;
  'mission:updated': (mission: Mission) => void;
  'mission:started': (mission: Mission) => void;
  'mission:completed': (mission: Mission) => void;
  'mission:cancelled': (mission: Mission) => void;
  'mission:member_added': (payload: MemberPayload) => void;
  'mission:member_removed': (payload: MemberPayload) => void;
  'mission:member_reactivated': (payload: MemberPayload) => void;
  'mission:event_created': (payload: { missionId: string; event: MissionEvent }) => void;
  'task:created': (payload: MissionTaskPayload) => void;
  'task:updated': (payload: MissionTaskPayload) => void;
  'task:assigned': (payload: MissionTaskPayload) => void;
  'task:unassigned': (payload: MissionTaskPayload) => void;
  'task:status_changed': (payload: MissionTaskPayload) => void;
  'sync:conflict_resolved': (payload: ConflictResolvedPayload) => void;
  'server:pong': (payload: { sentAt: number; receivedAt: number }) => void;
  connect: () => void;
  disconnect: (reason: string) => void;
  connect_error: (error: Error) => void;
}

export interface ClientToServerEvents {
  'mission:join': (data: string | { missionId: string }, callback?: (response: { success: boolean; error?: string; room?: string }) => void) => void;
  'mission:leave': (data: string | { missionId: string }) => void;
  'client:ping': (data: { sentAt: number }) => void;
}

function socketUrl(): string | undefined {
  const env = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
  if (env?.VITE_SOCKET_URL) return env.VITE_SOCKET_URL;
  if (env?.VITE_API_URL) return env.VITE_API_URL.replace(/\/api\/v1\/?$/, '');
  return typeof window !== 'undefined' ? window.location.origin : undefined;
}

export function createRealtimeSocket(token?: string): Socket<ServerToClientEvents, ClientToServerEvents> {
  return io(socketUrl(), {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    ...(token ? { auth: { token } } : {}),
  });
}

export function joinMission(socket: Socket<ServerToClientEvents, ClientToServerEvents>, missionId: string): Promise<{ success: boolean; error?: string; room?: string }> {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ success: false, error: 'MISSION_JOIN_TIMEOUT' }), 10000);
    socket.emit('mission:join', { missionId }, (response) => {
      clearTimeout(timeout);
      resolve(response);
    });
  });
}

export function leaveMission(socket: Socket<ServerToClientEvents, ClientToServerEvents>, missionId: string): void {
  socket.emit('mission:leave', { missionId });
}

export function pingRealtime(socket: Socket<ServerToClientEvents, ClientToServerEvents>): void {
  socket.emit('client:ping', { sentAt: Date.now() });
}

export function subscribeToMissionEvents(
  socket: Socket<ServerToClientEvents, ClientToServerEvents>,
  handlers: Partial<{ [K in keyof ServerToClientEvents]: ServerToClientEvents[K] }>
): () => void {
  const subscriptions = Object.entries(handlers) as Array<[keyof ServerToClientEvents, (...args: never[]) => void]>;
  subscriptions.forEach(([event, handler]) => socket.on(event, handler));
  return () => subscriptions.forEach(([event, handler]) => socket.off(event, handler));
}

export type RealtimeConflict = SyncConflict;
