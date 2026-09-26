/**
 * Phase 6 — Offline-First Operations
 * PendingMutationsPanel — compact list of queued offline operations.
 *
 * Shows what is waiting to sync. No sync action here (Phase 7).
 * Accessible from the mission detail page when pending count > 0.
 */

import React, { useEffect, useState } from 'react';
import { CloudOff, CheckCircle2, Loader2, AlertTriangle } from 'lucide-react';
import { mutationQueueRepository } from '../../offline/mutationQueue.repository';
import type { PendingMutation } from '../../offline/types';

interface PendingMutationsPanelProps {
  missionId: string;
  className?: string;
}

function operationLabel(op: PendingMutation['operationType']): string {
  const labels: Record<string, string> = {
    CREATE_TASK: 'Task created',
    UPDATE_TASK: 'Task updated',
    ASSIGN_TASK: 'Task assigned',
    UNASSIGN_TASK: 'Task unassigned',
    UPDATE_TASK_STATUS: 'Task status changed',
  };
  return labels[op] ?? op;
}

export const PendingMutationsPanel: React.FC<PendingMutationsPanelProps> = ({
  missionId,
  className = '',
}) => {
  const [mutations, setMutations] = useState<PendingMutation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const pending = await mutationQueueRepository.getPendingForMission(missionId);
      if (mounted) {
        setMutations(pending);
        setIsLoading(false);
      }
    };
    load();
    // Poll for changes every 2s (cheap IndexedDB read)
    const interval = setInterval(load, 2000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [missionId]);

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 text-zinc-500 text-xs font-mono ${className}`}>
        <Loader2 size={12} className="animate-spin" />
        <span>Loading pending changes...</span>
      </div>
    );
  }

  if (mutations.length === 0) {
    return null;
  }

  return (
    <div
      className={`bg-zinc-900/80 border border-zinc-700/50 rounded-lg overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-800/80 flex items-center gap-2 bg-zinc-950/40">
        <CloudOff size={12} className="text-amber-400" />
        <span className="text-xs font-mono font-semibold text-zinc-300 tracking-wider">
          PENDING CHANGES
        </span>
        <span className="ml-auto text-xs font-mono text-amber-400 bg-amber-400/10 border border-amber-400/20 px-1.5 py-0.5 rounded">
          {mutations.length}
        </span>
      </div>

      {/* Mutation list */}
      <div className="divide-y divide-zinc-800/50">
        {mutations.map((m) => (
          <div
            key={m.id}
            className="px-3 py-2 flex items-center gap-2.5"
          >
            {m.status === 'FAILED' ? (
              <AlertTriangle size={11} className="text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 size={11} className="text-amber-400 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-zinc-300 truncate">
                {operationLabel(m.operationType)}
              </p>
              <p className="text-[10px] text-zinc-600 font-mono">
                {new Date(m.clientCreatedAt).toLocaleTimeString()}
                {m.retryCount > 0 && ` · ${m.retryCount} retries`}
              </p>
            </div>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                m.status === 'FAILED'
                  ? 'text-rose-400 border-rose-800/40 bg-rose-950/20'
                  : 'text-amber-500/70 border-amber-800/30 bg-amber-950/10'
              }`}
            >
              {m.status === 'FAILED' ? 'FAILED' : 'PENDING'}
            </span>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div className="px-3 py-1.5 bg-zinc-950/30 text-[10px] text-zinc-600 font-mono border-t border-zinc-800/50">
        Changes will sync automatically when connection is restored (Phase 7)
      </div>
    </div>
  );
};
