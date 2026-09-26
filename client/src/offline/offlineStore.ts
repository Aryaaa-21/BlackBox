/**
 * Phase 6 — Offline-First Operations
 * Offline Store — Zustand store for offline/sync state management.
 *
 * Tracks:
 * - networkAvailable (navigator.onLine)
 * - serverReachable (health check)
 * - socketConnected
 * - operationalMode (ONLINE | OFFLINE | DEGRADED)
 * - pendingMutationCount (from IndexedDB)
 * - cachedAt for current mission
 *
 * This is the single source of truth for connectivity/offline state.
 * The existing connectivityStore remains for the global connectivity UI.
 * This store adds the offline operational context.
 */

import { create } from 'zustand';
import { getOrCreateDeviceId } from './db';
import { mutationQueueRepository } from './mutationQueue.repository';
import type { ConnectivityMode } from './types';

interface OfflineState {
  // Connectivity
  networkAvailable: boolean;
  serverReachable: boolean;
  socketConnected: boolean;
  mode: ConnectivityMode;

  // Device identity
  deviceId: string;

  // Pending sync state
  pendingMutationCount: number;
  pendingMutationCountForMission: number;
  currentMissionId: string | null;

  // Cache metadata for current mission
  missionCachedAt: string | null;
  isMissionCached: boolean;

  // Actions
  initialize: () => Promise<void>;
  setNetworkAvailable: (available: boolean) => void;
  setServerReachable: (reachable: boolean) => void;
  setSocketConnected: (connected: boolean) => void;
  setCurrentMission: (missionId: string | null) => void;
  refreshPendingCount: () => Promise<void>;
  refreshPendingCountForMission: (missionId: string) => Promise<void>;
  setMissionCacheInfo: (cachedAt: string | null) => void;

  // Derived
  isOperationallyOnline: () => boolean;
}

function computeMode(
  networkAvailable: boolean,
  serverReachable: boolean
): ConnectivityMode {
  if (networkAvailable && serverReachable) return 'ONLINE';
  if (!networkAvailable) return 'OFFLINE';
  // Network available but server unreachable
  return 'DEGRADED';
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  networkAvailable: typeof navigator !== 'undefined' ? navigator.onLine : true,
  serverReachable: false,
  socketConnected: false,
  mode: 'OFFLINE',
  deviceId: '',
  pendingMutationCount: 0,
  pendingMutationCountForMission: 0,
  currentMissionId: null,
  missionCachedAt: null,
  isMissionCached: false,

  initialize: async () => {
    const deviceId = await getOrCreateDeviceId();
    const count = await mutationQueueRepository.countPending();
    set({ deviceId, pendingMutationCount: count });
  },

  setNetworkAvailable: (available: boolean) => {
    const { serverReachable } = get();
    const mode = computeMode(available, available ? serverReachable : false);
    set({ networkAvailable: available, mode: available ? mode : 'OFFLINE' });
  },

  setServerReachable: (reachable: boolean) => {
    const { networkAvailable } = get();
    const mode = computeMode(networkAvailable, reachable);
    set({ serverReachable: reachable, mode });
  },

  setSocketConnected: (connected: boolean) => {
    set({ socketConnected: connected });
    // When socket connects, server is reachable
    if (connected) {
      const { networkAvailable } = get();
      set({ serverReachable: true, mode: computeMode(networkAvailable, true) });
    }
  },

  setCurrentMission: (missionId: string | null) => {
    set({ currentMissionId: missionId });
    if (missionId) {
      get().refreshPendingCountForMission(missionId);
    } else {
      set({ pendingMutationCountForMission: 0 });
    }
  },

  refreshPendingCount: async () => {
    const count = await mutationQueueRepository.countPending();
    set({ pendingMutationCount: count });
  },

  refreshPendingCountForMission: async (missionId: string) => {
    const count = await mutationQueueRepository.countPendingForMission(missionId);
    set({ pendingMutationCountForMission: count });
  },

  setMissionCacheInfo: (cachedAt: string | null) => {
    set({ missionCachedAt: cachedAt, isMissionCached: cachedAt !== null });
  },

  isOperationallyOnline: () => {
    const { mode } = get();
    return mode === 'ONLINE';
  },
}));
