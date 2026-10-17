import { forAccount, http, request, toQueryParams } from './http';
import type { User, UserRole } from '../types';
import { cacheUsers, getActiveAccountId } from '../db';

export interface UserSearchQuery { role?: UserRole; search?: string; }

export const usersApi = {
  search: async (query?: UserSearchQuery) => {
    const accountId = await getActiveAccountId();
    const users = (await request<{ users: User[] }>(http.get('/users', { ...forAccount(accountId), params: toQueryParams(query) }))).users;
    await cacheUsers(users, accountId);
    return users;
  },
};
