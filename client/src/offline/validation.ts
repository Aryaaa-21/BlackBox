/**
 * Phase 6 — Offline-First Operations
 * Offline task state transition validator.
 *
 * Mirrors the server-side rules from Phase 4 so that invalid transitions
 * are rejected locally, not queued, not sent to the server.
 */

import type { TaskStatus } from '../types';
import type { TaskTransitionResult } from './types';

// ============================================================
// ALLOWED TRANSITIONS (matches server task.service.ts)
// ============================================================

const ALLOWED_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  PENDING: ['ACTIVE', 'BLOCKED'],
  ACTIVE: ['COMPLETED', 'BLOCKED'],
  BLOCKED: ['ACTIVE'],
  COMPLETED: [], // terminal state
};

/**
 * Validate a local task status transition.
 * Returns { valid: true } or { valid: false, error, message }.
 */
export function validateTaskTransition(
  fromStatus: TaskStatus,
  toStatus: TaskStatus
): TaskTransitionResult {
  if (fromStatus === toStatus) {
    return {
      valid: false,
      error: 'INVALID_TRANSITION',
      message: `Task is already ${toStatus}.`,
    };
  }

  const allowed = ALLOWED_TRANSITIONS[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    return {
      valid: false,
      error: 'INVALID_TRANSITION',
      message: `Cannot transition task from ${fromStatus} to ${toStatus}.`,
    };
  }

  return { valid: true };
}

/**
 * Determine if a status change represents "starting" a task.
 */
export function isTaskStart(fromStatus: TaskStatus, toStatus: TaskStatus): boolean {
  return fromStatus === 'PENDING' && toStatus === 'ACTIVE';
}

/**
 * Determine if a status change represents "completing" a task.
 */
export function isTaskComplete(_fromStatus: TaskStatus, toStatus: TaskStatus): boolean {
  return toStatus === 'COMPLETED';
}

/**
 * Determine if a status change represents "blocking" a task.
 */
export function isTaskBlock(_fromStatus: TaskStatus, toStatus: TaskStatus): boolean {
  return toStatus === 'BLOCKED';
}

/**
 * Get a human-readable reason why an operation isn't allowed.
 */
export function getOfflineOperationNote(
  operation: 'assign' | 'unassign' | 'create_task' | 'update_status',
  reason: 'no_cache' | 'not_member' | 'invalid_transition' | 'server_only'
): string {
  const notes: Record<string, Record<string, string>> = {
    assign: {
      no_cache: 'Assignment unavailable offline — team information is not cached.',
      not_member: 'Assignment unavailable — the selected user is not an active mission member.',
      server_only: 'Assignment requires a server connection.',
    },
    unassign: {
      server_only: 'Unassignment requires a server connection.',
    },
    create_task: {
      server_only: 'Task creation requires a server connection.',
    },
    update_status: {
      invalid_transition: 'This status change is not allowed.',
      server_only: 'Status update requires a server connection.',
    },
  };

  return notes[operation]?.[reason] ?? 'This action requires a connection.';
}
