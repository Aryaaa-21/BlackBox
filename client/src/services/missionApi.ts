import { api } from './api';
import {
  ApiResponse,
  Mission,
  MissionStats,
  PaginationMeta,
  MissionFilters,
  CreateMissionPayload,
  UpdateMissionPayload,
} from '../types';

export const missionApi = {
  /**
   * Create a new mission (COMMANDER only)
   */
  async createMission(payload: CreateMissionPayload): Promise<Mission> {
    const response = await api.post<ApiResponse<{ mission: Mission }>>('/missions', payload);
    return response.data.data.mission;
  },

  /**
   * Retrieve list of accessible missions with optional filtering and pagination
   */
  async getMissions(
    filters?: MissionFilters
  ): Promise<{ missions: Mission[]; pagination: PaginationMeta }> {
    const response = await api.get<ApiResponse<{ missions: Mission[]; pagination: PaginationMeta }>>(
      '/missions',
      { params: filters }
    );
    return response.data.data;
  },

  /**
   * Retrieve single mission details by ID
   */
  async getMission(missionId: string): Promise<Mission> {
    const response = await api.get<ApiResponse<{ mission: Mission }>>(`/missions/${missionId}`);
    return response.data.data.mission;
  },

  /**
   * Update mission details (COMMANDER owner only)
   */
  async updateMission(missionId: string, payload: UpdateMissionPayload): Promise<Mission> {
    const response = await api.patch<ApiResponse<{ mission: Mission }>>(
      `/missions/${missionId}`,
      payload
    );
    return response.data.data.mission;
  },

  /**
   * Start mission: DRAFT -> ACTIVE (COMMANDER owner only)
   */
  async startMission(missionId: string): Promise<Mission> {
    const response = await api.post<ApiResponse<{ mission: Mission }>>(
      `/missions/${missionId}/start`
    );
    return response.data.data.mission;
  },

  /**
   * Complete mission: ACTIVE -> COMPLETED (COMMANDER owner only)
   */
  async completeMission(missionId: string): Promise<Mission> {
    const response = await api.post<ApiResponse<{ mission: Mission }>>(
      `/missions/${missionId}/complete`
    );
    return response.data.data.mission;
  },

  /**
   * Cancel mission: DRAFT or ACTIVE -> CANCELLED (COMMANDER owner only)
   */
  async cancelMission(missionId: string): Promise<Mission> {
    const response = await api.post<ApiResponse<{ mission: Mission }>>(
      `/missions/${missionId}/cancel`
    );
    return response.data.data.mission;
  },

  /**
   * Get mission statistics (counts by status) for current user
   */
  async getMissionStats(): Promise<MissionStats> {
    const response = await api.get<ApiResponse<{ stats: MissionStats }>>('/missions/stats');
    return response.data.data.stats;
  },
};
