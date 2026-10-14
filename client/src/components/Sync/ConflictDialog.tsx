/**
 * Phase 7 — Synchronization Engine
 * ConflictDialog — shows a conflict between local and server state
 * and lets the user explicitly choose resolution.
 *
 * KEEP_SERVER: discard local change, accept server state
 * KEEP_LOCAL:  re-apply local change through server validation
 */

import React, { useState } from 'react';
import { SyncConflict } from '../../store/syncStore';
import { syncConflict } from '../../services/sync/syncConflict';

interface ConflictDialogProps {
  conflict: SyncConflict;
  onResolved: (conflictId: string) => void;
  onDismiss: () => void;
}

export const ConflictDialog: React.FC<ConflictDialogProps> = ({
  conflict,
  onResolved,
  onDismiss,
}) => {
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async (resolution: 'KEEP_LOCAL' | 'KEEP_SERVER') => {
    setResolving(true);
    setError(null);

    try {
      await syncConflict.resolveConflict(conflict.id, resolution);
      onResolved(conflict.id);
    } catch (err: unknown) {
      const e = err as any;
      setError(e?.message || 'Resolution failed. Please try again.');
    } finally {
      setResolving(false);
    }
  };

  // Format entity type for display
  const entityLabel = conflict.entityType === 'TASK' ? 'Task' : conflict.entityType;
  const operationLabel: Record<string, string> = {
    UPDATE_TASK_STATUS: 'Status change',
    CREATE_TASK: 'Task creation',
    UPDATE_TASK: 'Task update',
    ASSIGN_TASK: 'Assignment',
    UNASSIGN_TASK: 'Unassignment',
  };

  const localState = conflict.localState as any;
  const serverState = conflict.serverState as any;

  const statusColor: Record<string, string> = {
    PENDING: 'text-slate-400',
    ACTIVE: 'text-blue-400',
    BLOCKED: 'text-amber-400',
    COMPLETED: 'text-emerald-400',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
                {entityLabel} Conflict
              </span>
            </div>
            <h2 className="text-white text-lg font-bold">
              {serverState?.title || localState?.title || 'Unnamed Task'}
            </h2>
            <p className="text-slate-400 text-xs mt-1">
              {operationLabel[conflict.operationType] || conflict.operationType} — changed while you were offline
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="text-slate-500 hover:text-white transition-colors ml-4 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Comparison */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {/* Your change */}
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
            <div className="text-xs font-semibold text-blue-400 mb-2 uppercase tracking-wider">
              Your Offline Change
            </div>
            {localState?.status && (
              <div className="mb-2">
                <span className="text-xs text-slate-500">Status</span>
                <div className={`font-semibold ${statusColor[localState.status] || 'text-white'}`}>
                  {localState.status}
                </div>
              </div>
            )}
            {localState?.title && conflict.operationType !== 'UPDATE_TASK_STATUS' && (
              <div className="mb-2">
                <span className="text-xs text-slate-500">Title</span>
                <div className="text-white text-sm font-medium">{localState.title}</div>
              </div>
            )}
            <div className="text-xs text-slate-500 mt-2">
              {new Date(conflict.detectedAt).toLocaleTimeString()}
            </div>
          </div>

          {/* Server state */}
          <div className="bg-slate-800/60 border border-slate-600/40 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">
              Current Server State
            </div>
            {serverState?.status && (
              <div className="mb-2">
                <span className="text-xs text-slate-500">Status</span>
                <div className={`font-semibold ${statusColor[serverState.status] || 'text-white'}`}>
                  {serverState.status}
                </div>
              </div>
            )}
            {serverState?.title && (
              <div className="mb-2">
                <span className="text-xs text-slate-500">Title</span>
                <div className="text-white text-sm font-medium">{serverState.title}</div>
              </div>
            )}
            <div className="text-xs text-slate-500 mt-2">
              {serverState?.updatedAt
                ? new Date(serverState.updatedAt).toLocaleTimeString()
                : '—'}
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 px-3 py-2 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Resolution buttons */}
        <div className="space-y-2">
          <p className="text-xs text-slate-500 mb-3">
            Choose which version to keep. This cannot be undone.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleResolve('KEEP_SERVER')}
              disabled={resolving}
              className="px-4 py-3 rounded-xl bg-slate-700/60 hover:bg-slate-600/60 border border-slate-600/40 text-sm font-medium text-slate-200 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resolving ? '…' : '← Keep Server'}
            </button>
            <button
              onClick={() => handleResolve('KEEP_LOCAL')}
              disabled={resolving}
              className="px-4 py-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-sm font-medium text-blue-300 hover:text-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resolving ? '…' : 'Keep My Change →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
