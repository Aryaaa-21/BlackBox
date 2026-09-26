import { create } from 'zustand';
import { MissionEvent, PaginationMeta, ApiError, MissionEventType } from '../types';
import { missionEventApi } from '../services/missionEventApi';

interface MissionEventState {
  events: MissionEvent[];
  currentMissionId: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  pagination: PaginationMeta | null;
  hasMore: boolean;
  filterType: MissionEventType | 'ALL';

  setFilterType: (filter: MissionEventType | 'ALL') => void;
  fetchEvents: (missionId: string, page?: number) => Promise<void>;
  loadMoreEvents: () => Promise<void>;
  addEvent: (event: MissionEvent) => void;
  clearEvents: () => void;
  clearError: () => void;
}

export const useMissionEventStore = create<MissionEventState>((set, get) => ({
  events: [],
  currentMissionId: null,
  isLoading: false,
  isLoadingMore: false,
  error: null,
  pagination: null,
  hasMore: false,
  filterType: 'ALL',

  setFilterType: (filterType) => {
    set({ filterType });
  },

  fetchEvents: async (missionId: string, page = 1) => {
    const { currentMissionId } = get();
    // If opening a new mission or loading page 1, clear or initialize
    const isNewMission = currentMissionId !== missionId;

    set({
      currentMissionId: missionId,
      isLoading: page === 1,
      isLoadingMore: page > 1,
      error: null,
      ...(isNewMission ? { events: [] } : {}),
    });

    try {
      const data = await missionEventApi.getMissionEvents(missionId, {
        page,
        limit: 50,
      });

      set((state) => {
        // Merge events ensuring no duplicate IDs (Section 42 & 61)
        const existingMap = new Map(state.events.map((e) => [e.id, e]));

        if (page === 1) {
          // Fresh list
          data.events.forEach((e) => existingMap.set(e.id, e));
        } else {
          // Append older events
          data.events.forEach((e) => {
            if (!existingMap.has(e.id)) {
              existingMap.set(e.id, e);
            }
          });
        }

        const sorted = Array.from(existingMap.values()).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        return {
          events: sorted,
          pagination: data.pagination,
          hasMore: data.pagination.page < data.pagination.totalPages,
          isLoading: false,
          isLoadingMore: false,
        };
      });
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Unable to load mission activity feed.',
        isLoading: false,
        isLoadingMore: false,
      });
    }
  },

  loadMoreEvents: async () => {
    const { currentMissionId, pagination, isLoadingMore, hasMore } = get();
    if (!currentMissionId || isLoadingMore || !hasMore || !pagination) return;

    await get().fetchEvents(currentMissionId, pagination.page + 1);
  },

  addEvent: (event: MissionEvent) => {
    const { currentMissionId, events } = get();

    // Verify event belongs to current mission (Section 67 & 115)
    if (currentMissionId && event.missionId !== currentMissionId) {
      return;
    }

    // De-duplication: do not append if already present (Section 42)
    if (events.some((e) => e.id === event.id)) {
      return;
    }

    // Insert and maintain strict chronological order (newest first) (Section 61)
    const updated = [event, ...events].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    set({ events: updated });
  },

  clearEvents: () => {
    set({
      events: [],
      currentMissionId: null,
      pagination: null,
      hasMore: false,
      error: null,
      isLoading: false,
      isLoadingMore: false,
    });
  },

  clearError: () => {
    set({ error: null });
  },
}));
