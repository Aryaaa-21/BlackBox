/**
 * Phase 8 — Mission Replay
 * Replay Store — Zustand store for complete mission replay lifecycle,
 * state reconstruction caching, event selection, and playback coordination.
 * Completely decoupled from the live operational stores.
 */

import { create } from 'zustand';
import {
  ReplayEvent,
  ReplayEventViewModel,
  ReplaySummary,
  ReplayMissionState,
  ReplayFilters,
  ReplayCategoryFilter,
} from '../types/replay';
import { replayApi } from '../services/replayApi';
import { formatReplayEvent } from '../services/replay/eventFormatter';
import {
  ReplayStateReconstructor,
  createInitialReplayState,
} from '../services/replay/replayReducer';

interface MissionMeta {
  id: string;
  title: string;
  description: string;
  location: string;
  status: string;
  severity: string;
  createdBy: unknown;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ReplayStoreState {
  // Mission and Event Stream
  mission: MissionMeta | null;
  events: ReplayEvent[];
  viewModels: ReplayEventViewModel[];
  summary: ReplaySummary | null;

  // Replay Position & State
  currentIndex: number;
  currentEvent: ReplayEvent | null;
  reconstructedState: ReplayMissionState;
  reconstructor: ReplayStateReconstructor | null;

  // Playback Control
  isPlaying: boolean;
  playbackSpeed: number;

  // Inspection Selection
  selectedEventId: string | null;
  selectedTaskId: string | null;
  selectedMemberId: string | null;

  // Filtering
  filters: ReplayFilters;
  filteredIndices: number[];

  // Loading & Error
  isLoading: boolean;
  error: string | null;

  // Actions
  loadReplay: (missionId: string) => Promise<void>;
  setCurrentIndex: (index: number) => void;
  seekToEventId: (eventId: string) => void;
  seekToTime: (isoTimestamp: string) => void;
  stepForward: () => void;
  stepBackward: () => void;
  resetReplay: () => void;
  skipToEnd: () => void;
  setIsPlaying: (playing: boolean) => void;
  setPlaybackSpeed: (speed: number) => void;
  selectEvent: (eventId: string | null) => void;
  selectTask: (taskId: string | null) => void;
  selectMember: (memberId: string | null) => void;
  setCategoryFilter: (category: ReplayCategoryFilter) => void;
  setSearchFilter: (search: string) => void;
  setActorFilter: (actorId?: string) => void;
  clearFilters: () => void;
  clearReplay: () => void;
}

function computeFilteredIndices(
  viewModels: ReplayEventViewModel[],
  filters: ReplayFilters
): number[] {
  const { category, actorId, search } = filters;
  const searchLower = search ? search.trim().toLowerCase() : '';

  const indices: number[] = [];
  for (let i = 0; i < viewModels.length; i++) {
    const vm = viewModels[i];

    // Category filter
    if (category !== 'ALL' && vm.category !== category) {
      continue;
    }

    // Actor filter
    if (actorId && vm.actorName !== actorId) {
      continue;
    }

    // Search query
    if (searchLower) {
      const matchTitle = vm.title.toLowerCase().includes(searchLower);
      const matchDesc = vm.description.toLowerCase().includes(searchLower);
      const matchActor = vm.actorName.toLowerCase().includes(searchLower);
      const matchTarget = vm.targetName ? vm.targetName.toLowerCase().includes(searchLower) : false;
      if (!matchTitle && !matchDesc && !matchActor && !matchTarget) {
        continue;
      }
    }

    indices.push(i);
  }

  return indices;
}

export const useReplayStore = create<ReplayStoreState>((set, get) => ({
  mission: null,
  events: [],
  viewModels: [],
  summary: null,

  currentIndex: -1,
  currentEvent: null,
  reconstructedState: createInitialReplayState(),
  reconstructor: null,

  isPlaying: false,
  playbackSpeed: 1,

  selectedEventId: null,
  selectedTaskId: null,
  selectedMemberId: null,

  filters: {
    category: 'ALL',
  },
  filteredIndices: [],

  isLoading: false,
  error: null,

  loadReplay: async (missionId: string) => {
    set({ isLoading: true, error: null, isPlaying: false });

    try {
      const data = await replayApi.getMissionReplay(missionId);
      const events = data.events || [];
      const viewModels = events.map(formatReplayEvent);
      const reconstructor = new ReplayStateReconstructor(events, data.mission.title);

      const initialIndex = events.length > 0 ? 0 : -1;
      const initialCurrentEvent = initialIndex >= 0 ? events[initialIndex] : null;
      const initialReconstructed = reconstructor.getStateAtIndex(initialIndex);

      const filteredIndices = computeFilteredIndices(viewModels, get().filters);

      set({
        mission: data.mission as any,
        events,
        viewModels,
        summary: data.summary,
        currentIndex: initialIndex,
        currentEvent: initialCurrentEvent,
        reconstructedState: initialReconstructed,
        reconstructor,
        selectedEventId: initialCurrentEvent?.id || null,
        filteredIndices,
        isLoading: false,
        error: null,
      });
    } catch (err: unknown) {
      const e = err as { message?: string };
      set({
        isLoading: false,
        error: e.message || 'Unable to load mission replay',
      });
    }
  },

  setCurrentIndex: (index: number) => {
    const { events, reconstructor } = get();
    if (events.length === 0) return;

    const clamped = Math.max(0, Math.min(index, events.length - 1));
    const event = events[clamped];
    const reconstructedState = reconstructor
      ? reconstructor.getStateAtIndex(clamped)
      : get().reconstructedState;

    set({
      currentIndex: clamped,
      currentEvent: event,
      reconstructedState,
      selectedEventId: event.id,
    });
  },

  seekToEventId: (eventId: string) => {
    const { events } = get();
    const index = events.findIndex((e) => e.id === eventId);
    if (index >= 0) {
      get().setCurrentIndex(index);
    }
  },

  seekToTime: (isoTimestamp: string) => {
    const { reconstructor, events } = get();
    if (!reconstructor || events.length === 0) return;

    const targetMs = new Date(isoTimestamp).getTime();
    let targetIndex = 0;
    for (let i = 0; i < events.length; i++) {
      if (new Date(events[i].createdAt).getTime() <= targetMs) {
        targetIndex = i;
      } else {
        break;
      }
    }
    get().setCurrentIndex(targetIndex);
  },

  stepForward: () => {
    const { currentIndex, events } = get();
    if (currentIndex < events.length - 1) {
      get().setCurrentIndex(currentIndex + 1);
    } else {
      // Reached end, pause
      set({ isPlaying: false });
    }
  },

  stepBackward: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      get().setCurrentIndex(currentIndex - 1);
    }
  },

  resetReplay: () => {
    set({ isPlaying: false });
    get().setCurrentIndex(0);
  },

  skipToEnd: () => {
    const { events } = get();
    set({ isPlaying: false });
    if (events.length > 0) {
      get().setCurrentIndex(events.length - 1);
    }
  },

  setIsPlaying: (playing: boolean) => {
    const { currentIndex, events } = get();
    // If playing from end, restart from beginning
    if (playing && currentIndex >= events.length - 1 && events.length > 0) {
      get().setCurrentIndex(0);
    }
    set({ isPlaying: playing });
  },

  setPlaybackSpeed: (speed: number) => {
    set({ playbackSpeed: speed });
  },

  selectEvent: (eventId: string | null) => {
    set({ selectedEventId: eventId });
  },

  selectTask: (taskId: string | null) => {
    set({ selectedTaskId: taskId });
  },

  selectMember: (memberId: string | null) => {
    set({ selectedMemberId: memberId });
  },

  setCategoryFilter: (category: ReplayCategoryFilter) => {
    const updatedFilters = { ...get().filters, category };
    const filteredIndices = computeFilteredIndices(get().viewModels, updatedFilters);
    set({ filters: updatedFilters, filteredIndices });
  },

  setSearchFilter: (search: string) => {
    const updatedFilters = { ...get().filters, search };
    const filteredIndices = computeFilteredIndices(get().viewModels, updatedFilters);
    set({ filters: updatedFilters, filteredIndices });
  },

  setActorFilter: (actorId?: string) => {
    const updatedFilters = { ...get().filters, actorId };
    const filteredIndices = computeFilteredIndices(get().viewModels, updatedFilters);
    set({ filters: updatedFilters, filteredIndices });
  },

  clearFilters: () => {
    const defaultFilters: ReplayFilters = { category: 'ALL' };
    const filteredIndices = computeFilteredIndices(get().viewModels, defaultFilters);
    set({ filters: defaultFilters, filteredIndices });
  },

  clearReplay: () => {
    set({
      mission: null,
      events: [],
      viewModels: [],
      summary: null,
      currentIndex: -1,
      currentEvent: null,
      reconstructedState: createInitialReplayState(),
      reconstructor: null,
      isPlaying: false,
      selectedEventId: null,
      selectedTaskId: null,
      selectedMemberId: null,
      filteredIndices: [],
      error: null,
    });
  },
}));
