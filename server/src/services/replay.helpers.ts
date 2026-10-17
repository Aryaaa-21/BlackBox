import { createHmac, timingSafeEqual } from 'crypto';
import mongoose from 'mongoose';
import { AppError } from '../middleware/error.middleware';

export const MAX_REPLAY_EVENTS = 5000;

export interface ReplayFilters {
  missionId: string;
  from: string | null;
  to: string | null;
  eventType: string | null;
}

export interface ReplayTuple {
  createdAt: string;
  id: string;
}

interface ReplayCursor extends ReplayFilters {
  version: 1;
  after: ReplayTuple;
  highWater: ReplayTuple;
}

function invalidCursor(): AppError {
  return new AppError('Invalid or incompatible replay cursor', 400, 'INVALID_REPLAY_CURSOR');
}

/** Accept calendar-valid ISO dates/timestamps, with an explicit zone for timestamps. */
export function parseReplayDate(value: unknown, field: string): string | null {
  if (value === undefined) return null;
  const invalid = () => new AppError(
    `Replay ${field} must be a valid ISO date or timestamp`, 400, 'INVALID_REPLAY_DATE'
  );
  if (typeof value !== 'string') throw invalid();
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) throw invalid();

  // Date.parse alone silently rolls February 30 into March.
  const calendarDate = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (!Number.isFinite(calendarDate.getTime()) ||
      calendarDate.getUTCFullYear() !== Number(match[1]) ||
      calendarDate.getUTCMonth() + 1 !== Number(match[2]) ||
      calendarDate.getUTCDate() !== Number(match[3]) ||
      (match[4] !== undefined && (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6] || 0) > 59))) {
    throw invalid();
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw invalid();
  return date.toISOString();
}

export function validateReplayOptions(
  missionId: string,
  options: { from?: string; to?: string; eventType?: string; limit?: number; cursor?: string }
): { filters: ReplayFilters; limit: number } {
  const from = parseReplayDate(options.from, 'from');
  const to = parseReplayDate(options.to, 'to');
  if (from && to && Date.parse(from) > Date.parse(to)) {
    throw new AppError('Replay from must be before or equal to to', 400, 'INVALID_REPLAY_DATE_RANGE');
  }
  const limit = options.limit === undefined ? 1000 : options.limit;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_REPLAY_EVENTS) {
    throw new AppError(`Replay limit must be an integer between 1 and ${MAX_REPLAY_EVENTS}`, 400, 'INVALID_REPLAY_LIMIT');
  }
  if (options.eventType !== undefined &&
      (typeof options.eventType !== 'string' || !options.eventType.trim() || options.eventType.length > 128)) {
    throw new AppError('Replay eventType must be a non-empty string of at most 128 characters', 400, 'INVALID_REPLAY_EVENT_TYPE');
  }
  return { filters: { missionId, from, to, eventType: options.eventType ?? null }, limit };
}

function isTuple(value: unknown): value is ReplayTuple {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const tuple = value as Record<string, unknown>;
  if (typeof tuple.createdAt !== 'string' || typeof tuple.id !== 'string' || !/^[a-f0-9]{24}$/.test(tuple.id)) return false;
  const date = new Date(tuple.createdAt);
  return Number.isFinite(date.getTime()) && date.toISOString() === tuple.createdAt;
}

export function compareReplayTuples(a: ReplayTuple, b: ReplayTuple): number {
  const timeDifference = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  return timeDifference || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

function cursorSignature(body: string, secret: string): Buffer {
  // Domain separation prevents replay cursors from being used as authentication tokens.
  return createHmac('sha256', secret).update('blackbox:mission-replay-cursor:v1:').update(body).digest();
}

export function encodeReplayCursor(
  filters: ReplayFilters,
  after: ReplayTuple,
  highWater: ReplayTuple,
  secret: string
): string {
  const cursor: ReplayCursor = { version: 1, ...filters, after, highWater };
  const body = Buffer.from(JSON.stringify(cursor)).toString('base64url');
  return `${body}.${cursorSignature(body, secret).toString('base64url')}`;
}

export function decodeReplayCursor(token: unknown, filters: ReplayFilters, secret: string): ReplayCursor {
  try {
    if (typeof token !== 'string' || token.length > 4096 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) {
      throw invalidCursor();
    }
    const [body, signature] = token.split('.');
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== 32 || actual.toString('base64url') !== signature ||
        !timingSafeEqual(actual, cursorSignature(body, secret))) throw invalidCursor();
    const decoded = Buffer.from(body, 'base64url');
    if (decoded.toString('base64url') !== body) throw invalidCursor();
    const cursor = JSON.parse(decoded.toString('utf8')) as ReplayCursor;
    if (!cursor || cursor.version !== 1 || cursor.missionId !== filters.missionId ||
        cursor.from !== filters.from || cursor.to !== filters.to || cursor.eventType !== filters.eventType ||
        !isTuple(cursor.after) || !isTuple(cursor.highWater) || compareReplayTuples(cursor.after, cursor.highWater) > 0) {
      throw invalidCursor();
    }
    for (const tuple of [cursor.after, cursor.highWater]) {
      if ((filters.from && Date.parse(tuple.createdAt) < Date.parse(filters.from)) ||
          (filters.to && Date.parse(tuple.createdAt) > Date.parse(filters.to))) {
        throw invalidCursor();
      }
    }
    return cursor;
  } catch {
    throw invalidCursor();
  }
}

// Match the credential-stripping conventions used by MissionEventService, including
// nested legacy payloads that predate sanitization. Arrays retain their shape.
const SENSITIVE_KEYS = new Set([
  'password', 'passwordhash', 'password_hash', 'token', 'refreshtoken',
  'refresh_token', 'secret', 'credentials', 'authorization',
]);

function sanitizeValue(value: unknown): unknown {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (value instanceof mongoose.Types.ObjectId) return value.toHexString();
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .filter(([key]) => !SENSITIVE_KEYS.has(key.toLowerCase()))
      .map(([key, entry]) => [key, sanitizeValue(entry)]));
  }
  return value;
}

export function normalizeReplayPayload(value: unknown): Record<string, unknown> {
  if (value === undefined || value === null) return {};
  const sanitized = sanitizeValue(value);
  if (sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)) {
    return sanitized as Record<string, unknown>;
  }
  // Keep malformed legacy data inspectable without changing the payload object contract.
  return { legacyPayload: sanitized };
}
