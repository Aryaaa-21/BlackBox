import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose, { ClientSession } from 'mongoose';
import { assertTransactionsSupported } from '../config/database';

// Mongoose's own narrow ALS propagation covers queries, populate, aggregates,
// save, create, insertMany and bulkWrite, including reads made by nested services.
mongoose.set('transactionAsyncLocalStorage', true);

interface UnitOfWork {
  session: ClientSession;
  afterCommit: Array<() => void | Promise<void>>;
}
const context = new AsyncLocalStorage<UnitOfWork>();
export const currentSession = (): ClientSession | undefined => context.getStore()?.session;
export const inUnitOfWork = (): boolean => !!context.getStore();

/** Queue best-effort live notifications, never a durable delivery promise. */
export function afterCommit(callback: () => void | Promise<void>): void {
  const unit = context.getStore();
  if (!unit) throw new Error('Operational notification requires a unit of work');
  unit.afterCommit.push(callback);
}

/** Nested operations join the caller. Each driver retry gets a fresh callback list. */
export async function withUnitOfWork<T>(work: () => Promise<T>): Promise<T> {
  if (inUnitOfWork()) return work();
  await assertTransactionsSupported();
  // Ensure unique receipt/event indexes exist before the first protected write.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  for (let attempt = 0; ; attempt++) {
    let committedCallbacks: UnitOfWork['afterCommit'] = [];
    try {
      const result = await mongoose.connection.transaction(async (session) => {
        const unit: UnitOfWork = { session, afterCommit: [] };
        return context.run(unit, async () => {
          const value = await work();
          committedCallbacks = unit.afterCommit;
          return value;
        });
      }, { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' }, readPreference: 'primary' });
      for (const callback of committedCallbacks) {
        try { await callback(); } catch { /* A committed write must not become a failed response. */ }
      }
      return result;
    } catch (error) {
      committedCallbacks = [];
      // A unique-key race aborts the entire transaction. Re-enter at the receipt
      // read in a fresh snapshot, never recover inside an aborted transaction.
      const failure = error as { code?: number; hasErrorLabel?: (label: string) => boolean; errorLabels?: string[] };
      const transient = failure.hasErrorLabel?.('TransientTransactionError') ||
        failure.errorLabels?.includes('TransientTransactionError');
      const ambiguousCommit = failure.hasErrorLabel?.('UnknownTransactionCommitResult') ||
        failure.errorLabels?.includes('UnknownTransactionCommitResult');
      // The driver handles its own transient errors. Also honor labelled
      // errors crossing driver/module boundaries (for example injected faults).
      // Never replay work on an unknown commit result: the driver retries the
      // commit, and an exhausted/ambiguous commit must remain an error.
      if (!ambiguousCommit && (failure.code === 11000 || transient) && attempt < 3) continue;
      throw error;
    }
  }
}
