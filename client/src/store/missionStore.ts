import { create } from 'zustand';
import {
  Mission,
  MissionStats,
  PaginationMeta,
  MissionFilters,
  CreateMissionPayload,
  UpdateMissionPayload,
  ApiError,
} from '../types';
import { missionApi } from '../services/missionApi';
import { socketService } from '../services/socket';
import { missionRepository } from '../offline/mission.repository';

interface MissionState {
  missions: Mission[];
  selectedMission: Mission | null;
  stats: MissionStats | null;
  pagination: PaginationMeta | null;
  filters: MissionFilters;

  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isActionLoading: boolean;
  error: string | null;

  // Actions
  fetchMissions: (filters?: MissionFilters) => Promise<void>;
  fetchMission: (missionId: string) => Promise<Mission>;
  createMission: (payload: CreateMissionPayload) => Promise<Mission>;
  updateMission: (missionId: string, payload: UpdateMissionPayload) => Promise<Mission>;
  startMission: (missionId: string) => Promise<Mission>;
  completeMission: (missionId: string) => Promise<Mission>;
  cancelMission: (missionId: string) => Promise<Mission>;
  fetchStats: () => Promise<void>;

  setFilters: (filters: MissionFilters) => void;
  clearSelectedMission: () => void;
  clearError: () => void;

  // Real-time synchronization
  joinMissionRoom: (missionId: string) => void;
  leaveMissionRoom: (missionId: string) => void;
  handleRealtimeMissionUpdate: (mission: Mission) => void;
  handleRealtimeMissionCreated: (mission: Mission) => void;
}

export const useMissionStore = create<MissionState>((set, get) => ({
  missions: [],
  selectedMission: null,
  stats: null,
  pagination: null,
  filters: { page: 1, limit: 20 },

  isLoading: false,
  isCreating: false,
  isUpdating: false,
  isActionLoading: false,
  error: null,

  fetchMissions: async (newFilters?: MissionFilters) => {
    const currentFilters = get().filters;
    const combinedFilters = { ...currentFilters, ...newFilters };
    set({ isLoading: true, error: null, filters: combinedFilters });

    try {
      const data = await missionApi.getMissions(combinedFilters);
      set({
        missions: data.missions,
        pagination: data.pagination,
        isLoading: false,
      });
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Unable to load missions.',
        isLoading: false,
      });
    }
  },

  fetchMission: async (missionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const mission = await missionApi.getMission(missionId);
      // Phase 6: cache to IndexedDB for offline access
      missionRepository.cacheMission(mission).catch(() => {});
      set({ selectedMission: mission, isLoading: false });
      return mission;
    } catch (err: unknown) {
      const error = err as ApiError;

      // Phase 6: fall back to IndexedDB cache if network fails
      if (error.code === 'NETWORK_UNAVAILABLE' || !navigator.onLine) {
        const cached = await missionRepository.getCachedMission(missionId);
        if (cached) {
          set({ selectedMission: cached, isLoading: false });
          return cached;
        }
      }

      set({
        error: error.message || 'Mission not found.',
        isLoading: false,
      });
      throw err;
    }
  },

  createMission: async (payload: CreateMissionPayload) => {
    set({ isCreating: true, error: null });
    try {
      const mission = await missionApi.createMission(payload);
      set((state) => ({
        missions: [mission, ...state.missions],
        selectedMission: mission,
        isCreating: false,
      }));
      // Refresh stats in background
      get().fetchStats();
      return mission;
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Failed to create mission.',
        isCreating: false,
      });
      throw err;
    }
  },

  updateMission: async (missionId: string, payload: UpdateMissionPayload) => {
    set({ isUpdating: true, error: null });
    try {
      const updatedMission = await missionApi.updateMission(missionId, payload);
      set((state) => ({
        selectedMission: state.selectedMission?.id === missionId ? updatedMission : state.selectedMission,
        missions: state.missions.map((m) => (m.id === missionId ? updatedMission : m)),
        isUpdating: false,
      }));
      return updatedMission;
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Failed to update mission.',
        isUpdating: false,
      });
      throw err;
    }
  },

  startMission: async (missionId: string) => {
    set({ isActionLoading: true, error: null });
    try {
      const updatedMission = await missionApi.startMission(missionId);
      set((state) => ({
        selectedMission: state.selectedMission?.id === missionId ? updatedMission : state.selectedMission,
        missions: state.missions.map((m) => (m.id === missionId ? updatedMission : m)),
        isActionLoading: false,
      }));
      get().fetchStats();
      return updatedMission;
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Failed to start mission.',
        isActionLoading: false,
      });
      throw err;
    }
  },

  completeMission: async (missionId: string) => {
    set({ isActionLoading: true, error: null });
    try {
      const updatedMission = await missionApi.completeMission(missionId);
      set((state) => ({
        selectedMission: state.selectedMission?.id === missionId ? updatedMission : state.selectedMission,
        missions: state.missions.map((m) => (m.id === missionId ? updatedMission : m)),
        isActionLoading: false,
      }));
      get().fetchStats();
      return updatedMission;
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Failed to complete mission.',
        isActionLoading: false,
      });
      throw err;
    }
  },

  cancelMission: async (missionId: string) => {
    set({ isActionLoading: true, error: null });
    try {
      const updatedMission = await missionApi.cancelMission(missionId);
      set((state) => ({
        selectedMission: state.selectedMission?.id === missionId ? updatedMission : state.selectedMission,
        missions: state.missions.map((m) => (m.id === missionId ? updatedMission : m)),
        isActionLoading: false,
      }));
      get().fetchStats();
      return updatedMission;
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Failed to cancel mission.',
        isActionLoading: false,
      });
      throw err;
    }
  },

  fetchStats: async () => {
    try {
      const stats = await missionApi.getMissionStats();
      set({ stats });
    } catch {
      // Non-critical, ignore or keep previous stats
    }
  },

  setFilters: (newFilters: MissionFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  clearSelectedMission: () => {
    set({ selectedMission: null, error: null });
  },

  clearError: () => {
    set({ error: null });
  },

  joinMissionRoom: (missionId: string) => {
    const socket = socketService.getSocket();
    if (socket && socket.connected) {
      socket.emit('mission:join', missionId, (res?: { success: boolean; error?: string }) => {
        if (res && !res.success) {
          console.warn(`[Socket] Denied access to mission room ${missionId}:`, res.error);
        } else {
          console.log(`[Socket] Authorized and joined mission room ${missionId}`);
        }
      });
    }
  },

  leaveMissionRoom: (missionId: string) => {
    const socket = socketService.getSocket();
    if (socket && socket.connected) {
      socket.emit('mission:leave', missionId);
      console.log(`[Socket] Left mission room ${missionId}`);
    }
  },

  handleRealtimeMissionUpdate: (updatedMission: Mission) => {
    set((state) => {
      const isSelected = state.selectedMission?.id === updatedMission.id;
      const missions = state.missions.map((m) =>
        m.id === updatedMission.id ? updatedMission : m
      );

      return {
        selectedMission: isSelected ? updatedMission : state.selectedMission,
        missions,
      };
    });
    // Update stats whenever a mission status changed
    get().fetchStats();
  },

  handleRealtimeMissionCreated: (newMission: Mission) => {
    set((state) => {
      // Avoid duplicate insertion
      if (state.missions.some((m) => m.id === newMission.id)) {
        return state;
      }
      return {
        missions: [newMission, ...state.missions],
      };
    });
    get().fetchStats();
  },
}));
