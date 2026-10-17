import { http, request } from './http';
import type { HealthStatus } from '../types';

export const healthApi = {
  check: () => request<HealthStatus>(http.get('/health', { timeout: 5_000 })),
};
