/**
 * Phase 6 — Offline-First Operations
 * OfflineBanner — persistent compact indicator that appears at the
 * top of the mission workspace when offline or degraded.
 *
 * Displays:
 * - ONLINE: nothing (or subtle "Live" state already in ConnectionStatusIndicator)
 * - OFFLINE/DEGRADED: compact bar with mode + pending count
 * - Never a full-screen overlay — user stays in mission workspace
 */

import React from 'react';
import { WifiOff, Wifi, Clock } from 'lucide-react';
import { useOfflineStore } from '../../offline/offlineStore';

interface OfflineBannerProps {
  missionId?: string;
  className?: string;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  missionId,
  className = '',
}) => {
  const mode = useOfflineStore((s) => s.mode);
  const pendingCount = missionId
    ? useOfflineStore((s) => s.pendingMutationCountForMission)
    // eslint-disable-next-line react-hooks/rules-of-hooks
    : useOfflineStore((s) => s.pendingMutationCount);
  const missionCachedAt = useOfflineStore((s) => s.missionCachedAt);

  if (mode === 'ONLINE') {
    // When fully online and there are still pending mutations, show subtle reminder
    if (pendingCount > 0) {
      return (
        <div
          className={`flex items-center gap-2 px-3 py-1.5 bg-amber-950/40 border border-amber-800/40 rounded-lg text-xs font-mono ${className}`}
        >
          <Clock size={12} className="text-amber-400 shrink-0" />
          <span className="text-amber-300">
            {pendingCount} change{pendingCount !== 1 ? 's' : ''} pending — ready for sync
          </span>
          <span className="text-amber-500/60 text-[10px] ml-auto">
            Phase 7 sync required
          </span>
        </div>
      );
    }
    return null;
  }

  const isOffline = mode === 'OFFLINE';

  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border text-xs font-mono ${
        isOffline
          ? 'bg-zinc-900/90 border-zinc-700/60 text-zinc-300'
          : 'bg-amber-950/50 border-amber-800/50 text-amber-300'
      } ${className}`}
      role="status"
      aria-live="polite"
    >
      {/* Icon */}
      {isOffline ? (
        <WifiOff size={13} className="text-zinc-400 shrink-0" />
      ) : (
        <Wifi size={13} className="text-amber-400 shrink-0 animate-pulse" />
      )}

      {/* Status text */}
      <span className={isOffline ? 'text-zinc-300' : 'text-amber-300'}>
        {isOffline ? 'OFFLINE' : 'DEGRADED'}
      </span>

      {/* Separator */}
      <span className="text-zinc-600">·</span>

      {/* Pending count */}
      {pendingCount > 0 ? (
        <span className="text-zinc-400">
          {pendingCount} change{pendingCount !== 1 ? 's' : ''} pending sync
        </span>
      ) : (
        <span className="text-zinc-500">
          {isOffline
            ? 'Local changes will sync when connection returns'
            : 'Server temporarily unreachable'}
        </span>
      )}

      {/* Cached timestamp */}
      {missionCachedAt && (
        <>
          <span className="text-zinc-600 ml-auto">·</span>
          <span className="text-zinc-600 text-[10px]">
            Cached {formatCachedAgo(missionCachedAt)}
          </span>
        </>
      )}
    </div>
  );
};

function formatCachedAgo(cachedAt: string): string {
  const diffMs = Date.now() - new Date(cachedAt).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  return `${diffH}h ago`;
}
