import { api } from './api';
import { ApiResponse, MissionMember, User } from '../types';

export const teamApi = {
  /**
   * Retrieve active team members for a mission
   */
  async getMissionMembers(
    missionId: string,
    includeRemoved?: boolean
  ): Promise<MissionMember[]> {
    const response = await api.get<ApiResponse<{ members: MissionMember[] }>>(
      `/missions/${missionId}/members`,
      { params: { includeRemoved } }
    );
    return response.data.data.members;
  },

  /**
   * Add a field operator to the mission team (Commander only)
   */
  async addMissionMember(missionId: string, userId: string): Promise<MissionMember> {
    const response = await api.post<ApiResponse<{ member: MissionMember }>>(
      `/missions/${missionId}/members`,
      { userId }
    );
    return response.data.data.member;
  },

  /**
   * Remove a member from the mission team (Commander only)
   */
  async removeMissionMember(missionId: string, userId: string): Promise<MissionMember> {
    const response = await api.delete<ApiResponse<{ member: MissionMember }>>(
      `/missions/${missionId}/members/${userId}`
    );
    return response.data.data.member;
  },

  /**
   * Search available active field operators for team assignment (Section 20 & 48)
   */
  async searchFieldOperators(search?: string): Promise<User[]> {
    const response = await api.get<ApiResponse<{ users: User[] }>>('/users', {
      params: {
        role: 'FIELD_OPERATOR',
        search: search || undefined,
      },
    });
    return response.data.data.users;
  },
};
