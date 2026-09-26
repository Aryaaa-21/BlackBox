export type UserRole = 'COMMANDER' | 'FIELD_OPERATOR';

export type MissionStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export type SeverityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  location: string;
  severity: SeverityLevel;
  status: MissionStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type ConnectivityStatus = 'ONLINE' | 'OFFLINE' | 'RECONNECTING';

export type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated' | 'server_unavailable';

export interface ConnectivityState {
  networkAvailable: boolean; // Device has network access (navigator.onLine)
  serverReachable: boolean;  // BlackBox backend can be pinged
  status: ConnectivityStatus;
  lastCheckedAt: number | null;
  latencyMs: number | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data: T;
  message?: string;
  code?: string;
}

export interface ApiError {
  success: false;
  message: string;
  code: string;
  details?: unknown;
}

export interface SystemHealthData {
  status: string;
  database: 'connected' | 'disconnected';
  realtime: 'ready' | 'offline';
  uptimeSeconds: number;
  timestamp: string;
  version: string;
}
