import { http, request } from './http';
import type { DemoInfo, DemoReset } from '../types';

export const demoApi = {
  info: () => request<DemoInfo>(http.get('/demo/info')),
  reset: () => request<DemoReset>(http.post('/demo/reset')),
  triggerConflict: (missionId?: string) => request<{ taskId: string; title: string; newServerStatus: string }>(http.post('/demo/trigger-conflict', { missionId })),
};
