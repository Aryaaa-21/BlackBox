/**
 * Phase 7 — Synchronization Engine
 * Idempotency Service
 *
 * Prevents duplicate mutations from being executed twice.
 * A mutation's idempotencyKey is generated client-side and NEVER
 * regenerated on retry — so the same key arriving twice returns
 * the original result without re-executing the operation.
 */

import { ProcessedMutation, IProcessedMutationDocument } from '../models/ProcessedMutation';
import crypto from 'crypto';

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
  fingerprint?: string;
}

export interface IdempotencyIdentity {
  userId: string;
  deviceId: string;
  missionId: string;
  operationType: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}

export const mutationFingerprint = (identity: IdempotencyIdentity): string =>
  crypto.createHash('sha256').update(JSON.stringify({
    userId: identity.userId,
    deviceId: identity.deviceId,
    missionId: identity.missionId,
    operationType: identity.operationType,
    entityType: identity.entityType,
    entityId: identity.entityId,
    payload: Object.fromEntries(Object.entries(identity.payload).sort(([a], [b]) => a.localeCompare(b))),
  })).digest('hex');

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
        existing.entityId === identity.entityId;
      if (!sameIdentity || (existing.fingerprint && existing.fingerprint !== mutationFingerprint(identity))) {
        throw new Error('IDEMPOTENCY_KEY_REUSED');
      }
    }
    return existing;
  }

  /**
   * Store the result of a successfully processed mutation.
   * Called AFTER the mutation has been applied to the database.
   */
  async storeResult(params: StoreIdempotencyParams): Promise<void> {
    // Use upsert to handle race conditions gracefully
    await ProcessedMutation.findOneAndUpdate(
      { idempotencyKey: params.idempotencyKey },
      {
        $setOnInsert: {
          idempotencyKey: params.idempotencyKey,
          userId: params.userId,
          deviceId: params.deviceId,
          missionId: params.missionId,
          operationType: params.operationType,
          entityType: params.entityType,
          entityId: params.entityId,
          localId: params.localId,
          serverId: params.serverId,
           result: params.result,
           fingerprint: params.fingerprint,
        },
      },
      { upsert: true, new: true }
    );
  }

  /**
   * Purge old idempotency records to keep the collection bounded.
   * Safe to call periodically. Retains 30 days of history.
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
