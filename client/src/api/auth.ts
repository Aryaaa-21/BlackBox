import { http, request } from './http';
import { cacheUsers } from '../db';
import type { AuthResult, User } from '../types';

export interface RegisterInput { name: string; email: string; password: string; role?: 'COMMANDER' | 'FIELD_OPERATOR'; }
export interface LoginInput { email: string; password: string; }

export const authApi = {
  register: async (input: RegisterInput) => {
    const result = await request<AuthResult>(http.post('/auth/register', input));
    await cacheUsers([result.user], result.user.id);
    return result;
  },
  login: async (input: LoginInput) => {
    const result = await request<AuthResult>(http.post('/auth/login', input));
    await cacheUsers([result.user], result.user.id);
    return result;
  },
  logout: () => request<{ loggedOut: true }>(http.post('/auth/logout')),
  me: async () => {
    const data = await request<{ user: User }>(http.get('/auth/me'));
    await cacheUsers([data.user], data.user.id);
    return data.user;
  },
  commanderAction: () => request<Record<string, unknown>>(http.post('/auth/commander-action')),
};
