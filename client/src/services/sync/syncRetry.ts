/**
 * Phase 7 — Synchronization Engine
 * Sync Retry — exponential backoff with jitter for failed mutations.
 */

import { RetryConfig, DEFAULT_RETRY_CONFIG } from './syncTypes';

export class SyncRetry {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = { ...DEFAULT_RETRY_CONFIG, ...config };
  }

  /**
   * Whether a mutation should be retried given its current retry count.
   */
  shouldRetry(retryCount: number): boolean {
    return retryCount < this.config.maxRetries;
  }

  /**
   * Calculate the delay before the next retry attempt.
   * Uses exponential backoff with random jitter.
   *
   * attempt 0: ~1000ms
   * attempt 1: ~2000ms
   * attempt 2: ~4000ms
   * attempt 3: ~8000ms
   * attempt 4: ~16000ms (capped at maxDelayMs)
   */
  calculateDelay(retryCount: number): number {
    const exponential = Math.min(
      this.config.baseDelayMs * Math.pow(2, retryCount),
      this.config.maxDelayMs
    );
    const jitter = Math.random() * this.config.jitterMs;
    return Math.floor(exponential + jitter);
  }

  /**
   * Determine if a given error code should be retried automatically.
   * Some errors (validation, permission) should NOT be auto-retried.
   */
  isRetryableError(errorCode: string | undefined): boolean {
    if (!errorCode) return true; // Unknown error — retry

    const nonRetryable = new Set([
      'VALIDATION_ERROR',
      'ACTOR_MISMATCH',
      'MISSION_ACCESS_DENIED',
      'PERMISSION_DENIED',
      'TASK_ACCESS_DENIED',
      'TASK_INVALID_STATUS_TRANSITION',
      'TASK_INVALID_ASSIGNEE',
      'UNKNOWN_OPERATION',
      'UNRESOLVED_LOCAL_ID',
    ]);

    return !nonRetryable.has(errorCode);
  }

  /**
   * Sleep for the computed delay.
   */
  sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const syncRetry = new SyncRetry();
