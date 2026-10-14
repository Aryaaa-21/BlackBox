/**
 * Phase 7 — Synchronization Engine
 * SyncStatusPanel — compact live sync status indicator.
 *
 * Shows: connectivity status, pending count, conflict count, failed count,
 * last sync time, and action buttons.
 */

import React, { useCallback } from 'react';
import { useSyncStore } from '../../store/syncStore';
import { useOfflineStore } from '../../offline/offlineStore';
import { syncEngine } from '../../services/sync/syncEngine';
import { useConnectivityStore } from '../../store/connectivityStore';

interface SyncStatusPanelProps {
  missionId?: string;
  onViewConflicts?: () => void;
  compact?: boolean;
}

export const SyncStatusPanel: React.FC<SyncStatusPanelProps> = ({
  missionId: _missionId,
  onViewConflicts,
  compact = false,
}) => {
  const {
    isSyncing,
    pendingCount,
    failedCount,
    conflictCount,
    lastSyncCompletedAt,
    lastSyncError,
    lastSyncSummary,
  } = useSyncStore();

  const isOnline = useOfflineStore((s) => s.mode === 'ONLINE');
  const { serverReachable } = useConnectivityStore();

  const handleSyncNow = useCallback(async () => {
    if (!isOnline || !serverReachable) return;
    if (isSyncing) return;

    try {
      await syncEngine.syncPendingMutations();
    } catch (err) {
      console.error('[SyncStatusPanel] Sync error:', err);
    }
  }, [isOnline, serverReachable, isSyncing]);

  // ── Status text
  const getStatusText = () => {
    if (!isOnline) {
      return {
        text: pendingCount > 0 ? `Offline · ${pendingCount} pending` : 'Offline',
        color: 'text-amber-400',
        dot: 'bg-amber-400',
      };
    }
    if (isSyncing) {
      return { text: 'Syncing…', color: 'text-blue-400', dot: 'bg-blue-400 animate-pulse' };
    }
    if (conflictCount > 0) {
      return {
        text: `${conflictCount} conflict${conflictCount !== 1 ? 's' : ''} need attention`,
        color: 'text-orange-400',
        dot: 'bg-orange-400',
      };
    }
    if (failedCount > 0) {
      return { text: `${failedCount} failed`, color: 'text-red-400', dot: 'bg-red-400' };
    }
    if (pendingCount > 0) {
      return {
        text: `${pendingCount} pending`,
        color: 'text-yellow-400',
        dot: 'bg-yellow-400 animate-pulse',
      };
    }
    if (lastSyncSummary && lastSyncSummary.synced > 0) {
      return { text: 'All changes synced', color: 'text-emerald-400', dot: 'bg-emerald-400' };
    }
    return { text: 'Live', color: 'text-emerald-400', dot: 'bg-emerald-400' };
  };

  const status = getStatusText();

  const formatTime = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // ── Compact pill version
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/60 border border-slate-700/50 text-xs">
        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
        <span className={status.color}>{status.text}</span>
        {isOnline && pendingCount > 0 && !isSyncing && (
          <button
            onClick={handleSyncNow}
            className="ml-1 text-slate-400 hover:text-white transition-colors"
            title="Sync now"
          >
            ↺
          </button>
        )}
      </div>
    );
  }

  // ── Full panel
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${status.dot}`} />
          <span className={`text-sm font-medium ${status.color}`}>{status.text}</span>
        </div>
        {lastSyncError && (
          <span className="text-xs text-red-400 truncate max-w-[140px]" title={lastSyncError}>
            {lastSyncError}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="text-center">
          <div className="text-yellow-400 font-bold text-base">{pendingCount}</div>
          <div className="text-slate-500">Pending</div>
        </div>
        <div className="text-center">
          <div className="text-orange-400 font-bold text-base">{conflictCount}</div>
          <div className="text-slate-500">Conflicts</div>
        </div>
        <div className="text-center">
          <div className="text-red-400 font-bold text-base">{failedCount}</div>
          <div className="text-slate-500">Failed</div>
        </div>
      </div>

      {/* Last sync time */}
      <div className="text-xs text-slate-500">
        Last sync: {formatTime(lastSyncCompletedAt)}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        {isOnline && serverReachable && !isSyncing && (
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 hover:text-blue-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? 'Syncing…' : 'Sync Now'}
          </button>
        )}

        {!isOnline && (
          <div className="flex-1 px-3 py-1.5 text-xs text-amber-400/70 text-center">
            Changes will sync when online
          </div>
        )}

        {conflictCount > 0 && onViewConflicts && (
          <button
            onClick={onViewConflicts}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/30 text-orange-400 hover:text-orange-300 transition-all"
          >
            View Conflicts
          </button>
        )}
      </div>
    </div>
  );
};
