import { create } from 'zustand';
import { MissionMember, ApiError } from '../types';
import { teamApi } from '../services/teamApi';

interface TeamState {
  members: MissionMember[];
  isLoading: boolean;
  isAdding: boolean;
  isRemoving: boolean;
  error: string | null;

  fetchMembers: (missionId: string, includeRemoved?: boolean) => Promise<void>;
  addMember: (missionId: string, userId: string) => Promise<MissionMember>;
  removeMember: (missionId: string, userId: string) => Promise<void>;
  clearMembers: () => void;
  clearError: () => void;

  // Real-time synchronization handlers (Section 60 & 63)
  handleMemberAdded: (member: MissionMember) => void;
  handleMemberRemoved: (userId: string) => void;
  handleMemberReactivated: (member: MissionMember) => void;
}

export const useTeamStore = create<TeamState>((set) => ({
  members: [],
  isLoading: false,
  isAdding: false,
  isRemoving: false,
  error: null,

  fetchMembers: async (missionId: string, includeRemoved?: boolean) => {
    set({ isLoading: true, error: null });
    try {
      const members = await teamApi.getMissionMembers(missionId, includeRemoved);
      set({ members, isLoading: false });
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Unable to load mission team members.',
        isLoading: false,
      });
    }
  },

  addMember: async (missionId: string, userId: string) => {
    set({ isAdding: true, error: null });
    try {
      const member = await teamApi.addMissionMember(missionId, userId);
      set((state) => {
        // If reactivated or new
        const exists = state.members.some((m) => m.userId.id === userId);
        return {
          members: exists
            ? state.members.map((m) => (m.userId.id === userId ? member : m))
            : [...state.members, member],
          isAdding: false,
        };
      });
      return member;
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Failed to add operator to team.',
        isAdding: false,
      });
      throw err;
    }
  },

  removeMember: async (missionId: string, userId: string) => {
    set({ isRemoving: true, error: null });
    try {
      await teamApi.removeMissionMember(missionId, userId);
      set((state) => ({
        members: state.members.filter((m) => m.userId.id !== userId),
        isRemoving: false,
      }));
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Failed to remove operator from team.',
        isRemoving: false,
      });
      throw err;
    }
  },

  clearMembers: () => {
    set({ members: [], error: null });
  },

  clearError: () => {
    set({ error: null });
  },

  handleMemberAdded: (member: MissionMember) => {
    set((state) => {
      if (state.members.some((m) => m.id === member.id || m.userId.id === member.userId.id)) {
        return state;
      }
      return { members: [...state.members, member] };
    });
  },

  handleMemberRemoved: (userId: string) => {
    set((state) => ({
      members: state.members.filter((m) => m.userId.id !== userId),
    }));
  },

  handleMemberReactivated: (member: MissionMember) => {
    set((state) => {
      const exists = state.members.some((m) => m.userId.id === member.userId.id);
      return {
        members: exists
          ? state.members.map((m) => (m.userId.id === member.userId.id ? member : m))
          : [...state.members, member],
      };
    });
  },
}));
