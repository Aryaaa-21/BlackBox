import axios, { AxiosError, AxiosInstance, type AxiosRequestConfig } from 'axios';
import type { ApiEnvelope, ApiError, ApiSuccess } from '../types';
import { db, getActiveAccountId } from '../db';
import { connectivity } from '../services/connectivity';

const apiBaseUrl =
  (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_URL ||
  '/api/v1';

export const http: AxiosInstance = axios.create({
  baseURL: apiBaseUrl.replace(/\/$/, ''),
  withCredentials: true,
  timeout: 15_000,
  headers: { 'Content-Type': 'application/json' },
});

type AccountRequestConfig = { blackboxAccountId?: string };

export function forAccount(accountId?: string): Pick<AxiosRequestConfig, 'headers'> & AccountRequestConfig {
  return { blackboxAccountId: accountId };
}

http.interceptors.request.use(async (config) => {
  const scoped = config as typeof config & AccountRequestConfig;
  if (!('blackboxAccountId' in scoped)) scoped.blackboxAccountId = await getActiveAccountId();
  const token = scoped.blackboxAccountId ? (await db.sessions.get(scoped.blackboxAccountId))?.token : undefined;
  if (token && !config.headers.Authorization) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status?: number;
  readonly details?: unknown;

  constructor(error: ApiError, status?: number) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.code = error.code;
    this.status = status;
    this.details = error.details;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as ApiError).success === false &&
      typeof (value as ApiError).message === 'string'
  );
}

export function normalizeApiError(error: unknown): ApiRequestError {
  if (error instanceof ApiRequestError) return error;
  if (error instanceof AxiosError) {
    const response = error.response;
    if (isApiError(response?.data)) return new ApiRequestError(response.data, response.status);
    return new ApiRequestError(
      {
        success: false,
        message: error.message || 'Network request failed',
        code: response ? `HTTP_${response.status}` : 'NETWORK_ERROR',
      },
      response?.status
    );
  }
  return new ApiRequestError({ success: false, message: 'Request failed', code: 'UNKNOWN_ERROR' });
}

export function unwrap<T>(response: { data: ApiEnvelope<T> }): T {
  const body = response.data;
  if (!body.success) throw new ApiRequestError(body);
  return body.data;
}

export async function request<T>(promise: Promise<{ data: ApiEnvelope<T>; status?: number; config?: object }>): Promise<T> {
  try {
    const [accountId, response] = await Promise.all([getActiveAccountId(), promise]);
    const expectedAccount = response.config && 'blackboxAccountId' in response.config ? (response.config as AccountRequestConfig).blackboxAccountId : accountId;
    if (await getActiveAccountId() !== expectedAccount) {
      throw new ApiRequestError({ success: false, message: 'Active account changed during request', code: 'ACCOUNT_CHANGED' }, 401);
    }
    if (!response.data.success) throw new ApiRequestError(response.data, response.status);
    connectivity.reportRequestSuccess();
    return (response.data as ApiSuccess<T>).data;
  } catch (error) {
    const normalized = normalizeApiError(error);
    connectivity.reportRequestFailure(normalized);
    throw normalized;
  }
}

export function toQueryParams<T extends object>(query?: T): T | undefined {
  if (!query) return undefined;
  return Object.fromEntries(Object.entries(query).filter(([, value]) => value !== undefined && value !== '')) as T;
}
