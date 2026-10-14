/**
 * Phase 7 — Synchronization Engine
 * Sync Types — shared type definitions for the frontend sync engine.
 */

// ============================================================
// INCOMING TYPES (sent to server)
// ============================================================

export interface OutgoingMutation {
  mutationId: string;
  missionId: string;
  operationType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  actorId: string;
  deviceId: string;
  clientCreatedAt: string;
  createdAt: string;
  idempotencyKey: string;
  baseUpdatedAt?: string;
}

// ============================================================
// RESPONSE TYPES (received from server)
// ============================================================

export type SyncResultStatus = 'SYNCED' | 'CONFLICT' | 'FAILED' | 'DUPLICATE';

export interface MutationResult {
  mutationId: string;
  idempotencyKey: string;
  status: SyncResultStatus;
  entityType?: string;
  localId?: string;
  serverId?: string;
  entity?: Record<string, unknown>;
  conflict?: {
    conflictId: string;
    localState: Record<string, unknown>;
    serverState: Record<string, unknown>;
  };
  errorCode?: string;
  message?: string;
}

export interface SyncResponse {
  synced: number;
  conflicts: number;
  failed: number;
  duplicates: number;
  remaining: number;
  results: MutationResult[];
}

// ============================================================
// RETRY CONFIG
// ============================================================

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterMs: number;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  jitterMs: 500,
};

// ============================================================
// SYNC ENGINE EVENTS (internal)
// ============================================================

export type SyncEngineEvent =
  | { type: 'SYNC_STARTED' }
  | { type: 'MUTATION_PROCESSING'; mutationId: string }
  | { type: 'MUTATION_SYNCED'; mutationId: string; serverId?: string }
  | { type: 'MUTATION_CONFLICT'; mutationId: string; conflictId: string }
  | { type: 'MUTATION_FAILED'; mutationId: string; errorCode: string; message: string }
  | { type: 'MUTATION_DUPLICATE'; mutationId: string }
  | { type: 'SYNC_COMPLETED'; summary: SyncResponse }
  | { type: 'SYNC_ERROR'; error: string };
