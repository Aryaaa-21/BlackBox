/**
 * Phase 9 — Product Polish & Hackathon Demo
 * Demo API Client — manages communication with /api/v1/demo
 */

import { api } from './api';
import { ApiResponse } from '../types';

export interface DemoUserCredentials {
  name: string;
  email: string;
  role: 'COMMANDER' | 'FIELD_OPERATOR';
  password: string;
  token?: string;
  userId?: string;
}

export interface DemoInfoData {
  enabled: boolean;
  demoMissionId?: string;
  demoUsers: { name: string; email: string; role: string }[];
}

export interface DemoResetData {
  message: string;
  demoUsers: DemoUserCredentials[];
  demoMission: {
    id: string;
    title: string;
    location: string;
    severity: string;
    status: string;
  };
  tasksCount: number;
  eventsCount: number;
  primaryToken: string;
}

export interface DemoConflictData {
  taskId: string;
  title: string;
  newServerStatus: string;
}

export const demoApi = {
  /**
   * Check if demo mode is enabled on the server and fetch demo credentials
   */
  async getDemoInfo(): Promise<DemoInfoData> {
    try {
      const res = await api.get<ApiResponse<DemoInfoData>>('/demo/info');
      return res.data.data;
    } catch {
      return { enabled: false, demoUsers: [] };
    }
  },

  /**
   * Reset demo state cleanly: wipes demo DB data and seeds Campus Emergency Operations
   */
  async resetDemo(): Promise<DemoResetData> {
    const res = await api.post<ApiResponse<DemoResetData>>('/demo/reset');
    return res.data.data;
  },

  /**
   * Trigger simulated server-side task conflict while client is offline
   */
  async triggerConflict(missionId?: string): Promise<DemoConflictData> {
    const res = await api.post<ApiResponse<DemoConflictData>>('/demo/trigger-conflict', {
      missionId,
    });
    return res.data.data;
  },
};
