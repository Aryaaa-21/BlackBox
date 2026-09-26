import { create } from 'zustand';
import { ConnectivityStatus, SystemHealthData, ApiResponse } from '../types';
import { api } from '../services/api';

interface ConnectivityStateStore {
  networkAvailable: boolean;
  serverReachable: boolean;
  status: ConnectivityStatus;
  realtimeConnected: boolean;
  lastCheckedAt: number | null;
  latencyMs: number | null;
  systemHealth: SystemHealthData | null;
  checkCount: number;

  setNetworkAvailable: (available: boolean) => void;
  setServerReachable: (reachable: boolean) => void;
  setRealtimeConnected: (connected: boolean) => void;
  setLatency: (ms: number) => void;
  checkServerHealth: () => Promise<boolean>;
}

export const useConnectivityStore = create<ConnectivityStateStore>((set, get) => {
  const computeStatus = (network: boolean, server: boolean, checkCount: number): ConnectivityStatus => {
    if (!network) {
      return 'OFFLINE';
    }
    if (!server) {
      // If network is on, but server ping failed, we are in reconnecting / trying to reach backend state
      return checkCount > 0 ? 'RECONNECTING' : 'OFFLINE';
    }
    return 'ONLINE';
  };

  const initialNetwork = typeof navigator !== 'undefined' ? navigator.onLine : true;

  return {
    networkAvailable: initialNetwork,
    serverReachable: false,
    status: initialNetwork ? 'RECONNECTING' : 'OFFLINE',
    realtimeConnected: false,
    lastCheckedAt: null,
    latencyMs: null,
    systemHealth: null,
    checkCount: 0,

    setNetworkAvailable: (available: boolean) => {
      const { serverReachable, checkCount } = get();
      const status = computeStatus(available, serverReachable, checkCount);
      set({ networkAvailable: available, status });
    },

    setServerReachable: (reachable: boolean) => {
      const { networkAvailable, checkCount } = get();
      const status = computeStatus(networkAvailable, reachable, checkCount);
      set({ serverReachable: reachable, status });
    },

    setRealtimeConnected: (connected: boolean) => {
      set({ realtimeConnected: connected });
    },

    setLatency: (ms: number) => {
      set({ latencyMs: ms });
    },

    checkServerHealth: async (): Promise<boolean> => {
      const currentNetwork = typeof navigator !== 'undefined' ? navigator.onLine : true;
      if (!currentNetwork) {
        set({
          networkAvailable: false,
          serverReachable: false,
          status: 'OFFLINE',
          lastCheckedAt: Date.now(),
        });
        return false;
      }

      const start = Date.now();
      try {
        const response = await api.get<ApiResponse<SystemHealthData>>('/health', {
          timeout: 4000,
        });

        const latency = Date.now() - start;
        const isHealthy = response.data && response.data.success;
        const newCount = get().checkCount + 1;

        set({
          networkAvailable: true,
          serverReachable: isHealthy,
          status: isHealthy ? 'ONLINE' : 'RECONNECTING',
          latencyMs: latency,
          lastCheckedAt: Date.now(),
          systemHealth: response.data.data,
          checkCount: newCount,
        });

        return isHealthy;
      } catch {
        const newCount = get().checkCount + 1;
        set({
          networkAvailable: currentNetwork,
          serverReachable: false,
          status: currentNetwork ? 'RECONNECTING' : 'OFFLINE',
          latencyMs: null,
          lastCheckedAt: Date.now(),
          checkCount: newCount,
        });
        return false;
      }
    },
  };
});
