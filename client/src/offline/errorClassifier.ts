/**
 * Phase 6 — Offline-First Operations
 * Error classification — distinguishes network/offline errors from
 * HTTP validation/auth errors so only genuine offline conditions are
 * routed to the local mutation queue.
 */

import type { ApiError } from '../types';

// ============================================================
// ERROR CODES
// ============================================================

/** Errors that indicate the server is genuinely unreachable */
const NETWORK_ERROR_CODES = new Set([
  'NETWORK_UNAVAILABLE',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ERR_NETWORK',
]);

/** HTTP status codes that are auth/permission errors, NOT offline */
const AUTH_ERROR_HTTP_CODES = new Set([401, 403]);

/** HTTP status codes that are validation errors, NOT offline */
const VALIDATION_ERROR_HTTP_CODES = new Set([400, 422]);

// ============================================================
// CLASSIFICATION
// ============================================================

export type ErrorClassification =
  | 'NETWORK'      // Offline / unreachable — may route to local queue
  | 'AUTH'         // 401/403 — do not queue
  | 'NOT_FOUND'    // 404 — do not queue
  | 'VALIDATION'   // 400/422 — do not queue
  | 'SERVER'       // 500+ — do not queue
  | 'UNKNOWN';

export interface ClassifiedError {
  classification: ErrorClassification;
  shouldFallbackToLocal: boolean;
  original: ApiError;
}

/**
 * Classify an API error returned from the axios interceptor.
 * Only NETWORK errors should fall back to local offline operations.
 */
export function classifyApiError(error: ApiError): ClassifiedError {
  const code = error.code ?? '';

  // Network / offline errors
  if (NETWORK_ERROR_CODES.has(code) || code === 'NETWORK_UNAVAILABLE') {
    return {
      classification: 'NETWORK',
      shouldFallbackToLocal: true,
      original: error,
    };
  }

  // Parse HTTP status from code string like "HTTP_401"
  const httpStatus = code.startsWith('HTTP_') ? parseInt(code.replace('HTTP_', ''), 10) : NaN;

  if (!isNaN(httpStatus)) {
    if (AUTH_ERROR_HTTP_CODES.has(httpStatus)) {
      return { classification: 'AUTH', shouldFallbackToLocal: false, original: error };
    }
    if (httpStatus === 404) {
      return { classification: 'NOT_FOUND', shouldFallbackToLocal: false, original: error };
    }
    if (VALIDATION_ERROR_HTTP_CODES.has(httpStatus)) {
      return { classification: 'VALIDATION', shouldFallbackToLocal: false, original: error };
    }
    if (httpStatus >= 500) {
      return { classification: 'SERVER', shouldFallbackToLocal: false, original: error };
    }
  }

  return { classification: 'UNKNOWN', shouldFallbackToLocal: false, original: error };
}

/**
 * Returns true if the error should trigger a local offline fallback.
 */
export function isOfflineError(error: unknown): boolean {
  const apiError = error as ApiError;
  if (!apiError?.code) return false;
  const classified = classifyApiError(apiError);
  return classified.shouldFallbackToLocal;
}
