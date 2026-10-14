/**
 * Phase 7 — Synchronization Engine
 * PendingChangesPanel — shows queued offline mutations with per-item status.
 * Replaces/enhances the Phase 6 PendingMutationsPanel.
 */

import React, { useEffect, useState, useCallback } from 'react';
import { db } from '../../offline/db';
import { syncEngine } from '../../services/sync/syncEngine';
import { useOfflineStore } from '../../offline/offlineStore';
import type { PendingMutation } from '../../offline/types';

const OPERATION_LABEL: Record<string, string> = {
  CREATE_TASK: 'Task created',
  UPDATE_TASK_STATUS: 'Status changed',
  ASSIGN_TASK: 'Task assigned',
  UNASSIGN_TASK: 'Task unassigned',
  UPDATE_TASK: 'Task updated',
};

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  READY_FOR_SYNC: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  FAILED: 'bg-red-500/10 text-red-400 border-red-500/20',
};

interface PendingChangesPanelProps {
  missionId?: string;
}

export const PendingChangesPanel: React.FC<PendingChangesPanelProps> = ({ missionId }) => {
  const [mutations, setMutations] = useState<PendingMutation[]>([]);
  const [retrying, setRetrying] = useState<string | null>(null);
  const isOnline = useOfflineStore((s) => s.mode === 'ONLINE');

  const loadMutations = useCallback(async () => {
    let all: PendingMutation[];
    if (missionId) {
      all = await db.mutationQueue.where('missionId').equals(missionId).toArray();
    } else {
      all = await db.mutationQueue.toArray();
    }
    // Oldest first
    all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    setMutations(all);
  }, [missionId]);

  useEffect(() => {
    loadMutations();
    const interval = setInterval(loadMutations, 3000);
    return () => clearInterval(interval);
  }, [loadMutations]);

  const handleRetry = async (mutationId: string) => {
    setRetrying(mutationId);
    try {
      await syncEngine.retryMutation(mutationId);
      await loadMutations();
    } catch (err) {
      console.error('[PendingChangesPanel] Retry failed:', err);
    } finally {
      setRetrying(null);
    }
  };

  if (mutations.length === 0) return null;

  const pending = mutations.filter((m) => m.status === 'PENDING');
  const failed = mutations.filter((m) => m.status === 'FAILED');

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/40">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Pending Changes
          </span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-400 text-xs">
            {mutations.length}
          </span>
        </div>
        {pending.length > 0 && !isOnline && (
          <span className="text-xs text-amber-400">Will sync on reconnect</span>
        )}
      </div>

      {/* Mutation list */}
      <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-700/30">
        {mutations.map((m) => (
          <div key={m.id} className="px-4 py-3 flex items-start gap-3">
            {/* Status indicator */}
            <div className="pt-0.5">
              {m.status === 'PENDING' && (
                <span className="w-2 h-2 rounded-full bg-yellow-400 block mt-1" />
              )}
              {m.status === 'READY_FOR_SYNC' && (
                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse block mt-1" />
              )}
              {m.status === 'FAILED' && (
                <span className="w-2 h-2 rounded-full bg-red-400 block mt-1" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-slate-200 font-medium">
                {OPERATION_LABEL[m.operationType] || m.operationType}
              </div>
              <div className="text-xs text-slate-500 mt-0.5 truncate">
                {m.missionId}
              </div>
              {m.errorMessage && m.status === 'FAILED' && (
                <div className="text-xs text-red-400 mt-1 truncate" title={m.errorMessage}>
                  {m.errorMessage.startsWith('CONFLICT:')
                    ? '⚠ Conflict — resolve in conflict panel'
                    : m.errorMessage}
                </div>
              )}
            </div>

            {/* Status badge + retry */}
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_STYLE[m.status] || 'text-slate-400'}`}
              >
                {m.status === 'PENDING' ? 'Pending' : m.status === 'FAILED' ? 'Failed' : 'Ready'}
              </span>
              {m.status === 'FAILED' &&
                !m.errorMessage?.startsWith('CONFLICT:') &&
                isOnline && (
                  <button
                    onClick={() => handleRetry(m.id)}
                    disabled={retrying === m.id}
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
                  >
                    {retrying === m.id ? 'Retrying…' : 'Retry'}
                  </button>
                )}
              <span className="text-xs text-slate-600">
                {new Date(m.createdAt).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Summary footer */}
      {(pending.length > 0 || failed.length > 0) && (
        <div className="px-4 py-2 border-t border-slate-700/30 flex gap-4 text-xs text-slate-500">
          {pending.length > 0 && <span>{pending.length} pending</span>}
          {failed.length > 0 && <span className="text-red-400">{failed.length} failed</span>}
        </div>
      )}
    </div>
  );
};
