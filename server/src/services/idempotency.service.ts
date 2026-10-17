/**
 * Phase 7 — Synchronization Engine
 * Idempotency Service
 *
 * Replays successful mutation receipts without executing again.
 * A mutation's idempotencyKey is generated client-side and NEVER
 * regenerated on retry — so the same key arriving twice returns
 * the original result without re-executing the operation, while the receipt
 * is retained. Operational callers persist entity/event/receipt in one unit of work.
 */

import { ProcessedMutation, IProcessedMutationDocument } from '../models/ProcessedMutation';
import { AppError } from '../middleware/error.middleware';
import crypto from 'crypto';
import { inUnitOfWork, withUnitOfWork } from './unitOfWork';

interface StoreIdempotencyParams {
  idempotencyKey: string;
  userId: string;
  deviceId: string;
  missionId: string;
  operationType: string;
  entityType: string;
  entityId: string;
  localId?: string;
  serverId?: string;
  result: Record<string, unknown>;
  fingerprint: string;
  outcome?: 'SYNCED' | 'CONFLICT';
}

export interface IdempotencyIdentity {
  userId: string;
  deviceId: string;
  missionId: string;
  operationType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  baseUpdatedAt?: string;
  baseVersion?: number;
  clientCreatedAt?: string;
}

/** JSON object order is irrelevant at every depth; array order remains significant. */
export const deterministicFingerprint = (value: unknown): string =>
  crypto.createHash('sha256').update(JSON.stringify(value, (_key, entry: unknown) => {
    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      const object = entry as Record<string, unknown>;
      return Object.fromEntries(Object.keys(object).sort().map((key) => [key, object[key]]));
    }
    return entry;
  })).digest('hex');

export const mutationFingerprint = (identity: IdempotencyIdentity): string =>
  deterministicFingerprint({
    userId: identity.userId,
    deviceId: identity.deviceId,
    missionId: identity.missionId,
    operationType: identity.operationType,
    entityType: identity.entityType,
    entityId: identity.entityId,
    payload: identity.payload,
    baseUpdatedAt: identity.baseUpdatedAt ?? null,
    clientCreatedAt: identity.clientCreatedAt ?? null,
    ...(identity.baseVersion !== undefined ? { baseVersion: identity.baseVersion } : {}),
  });

const keyReused = (): AppError => new AppError(
  'Idempotency key was already used for a different mutation',
  409,
  'IDEMPOTENCY_KEY_REUSED'
);

export class IdempotencyService {
  /**
   * Check if this mutation has already been processed.
   * Returns the stored result if so, null otherwise.
   */
  async checkIdempotency(
    idempotencyKey: string,
    identity?: IdempotencyIdentity
  ): Promise<IProcessedMutationDocument | null> {
    const existing = await ProcessedMutation.findOne({ idempotencyKey }).lean<IProcessedMutationDocument>();
    if (existing && identity) {
      const sameIdentity = existing.userId === identity.userId &&
        existing.deviceId === identity.deviceId &&
        existing.missionId === identity.missionId &&
        existing.operationType === identity.operationType &&
        existing.entityType === identity.entityType &&
        (existing.entityId === identity.entityId ||
          // Old records stored the resolved server ID. Their original local ID
          // is the only recoverable request identity; never invent/backfill a
          // payload fingerprint for records whose original payload is unknown.
          (!existing.fingerprint && existing.localId === identity.entityId));
      if (!sameIdentity || (existing.fingerprint && existing.fingerprint !== mutationFingerprint(identity))) {
        throw keyReused();
      }
      if (!existing.fingerprint) {
        // Never invent the original payload or silently bless a potentially
        // colliding legacy retry. Keep it for explicit reconciliation instead.
        throw new AppError('Legacy receipt has no verifiable payload fingerprint; reconcile server state before retrying', 409, 'IDEMPOTENCY_LEGACY_UNVERIFIABLE');
      }
    }
    return existing;
  }

  /**
   * Store the result of a successfully processed mutation.
   * Called AFTER the mutation has been applied to the database.
   */
  async storeResult(params: StoreIdempotencyParams): Promise<void> {
    if (!inUnitOfWork()) return withUnitOfWork(() => this.storeResult(params));
    // Insert-only: accepting an existing receipt here could commit entity work
    // performed by a losing producer. Let the root abort and re-read instead.
    await new ProcessedMutation(params).save();
  }

  /** Resolve an offline CREATE from an earlier batch, within its original scope. */
  async resolveLocalId(scope: {
    userId: string;
    deviceId: string;
    missionId: string;
    entityType: string;
    localId: string;
  }): Promise<string | null> {
    if (scope.entityType !== 'TASK') return null;
    const created = await ProcessedMutation.findOne({
      userId: scope.userId,
      deviceId: scope.deviceId,
      missionId: scope.missionId,
      entityType: scope.entityType,
      operationType: 'CREATE_TASK',
      $or: [{ localId: scope.localId }, { entityId: scope.localId }],
      serverId: { $type: 'string' },
    }).lean<IProcessedMutationDocument>();
    return created?.serverId || null;
  }

  /**
   * Purge old idempotency records to keep the collection bounded.
   * Retains 30 days by default. Purging also expires the corresponding retry
   * receipts and local-ID mappings; it is not indefinite exactly-once storage.
   */
  async purgeOldRecords(olderThanDays = 30): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    const result = await ProcessedMutation.deleteMany({
      createdAt: { $lt: cutoff },
    });
    return result.deletedCount;
  }
}

export const idempotencyService = new IdempotencyService();
