/**
 * Phase 8 — Mission Replay
 * ReplayHeader — top tactical banner indicating read-only historical playback mode,
 * operational metrics, and navigation back to the live workspace.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, History, Clock, Activity, Radio } from 'lucide-react';
import { useReplayStore } from '../../store/replayStore';

export const ReplayHeader: React.FC = () => {
  const { mission, summary, currentIndex, events, reconstructedState } = useReplayStore();

  const total = events.length;
  const currentEvent = currentIndex >= 0 && currentIndex < events.length ? events[currentIndex] : null;

  const formattedCurrentTime = currentEvent
    ? new Date(currentEvent.createdAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : '--:--:--';

  return (
    <div className="space-y-4">
      {/* Top Banner Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 font-mono text-xs">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
          <span className="font-bold tracking-wider">HISTORICAL REPLAY MODE // READ ONLY</span>
          <span className="hidden md:inline text-amber-400/60">·</span>
          <span className="hidden md:inline text-amber-200/80">
            Reconstructing past operational state from immutable mission event logs. Real state is not affected.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40">
            REPLAY TIME: {formattedCurrentTime}
          </span>
        </div>
      </div>

      {/* Main Navigation & Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-blackbox-border">
        <div className="flex items-center gap-3">
          <Link
            to={mission ? `/missions/${mission.id}` : '/missions'}
            className="p-2 rounded-lg bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border text-blackbox-muted hover:text-blackbox-text transition-colors flex items-center gap-1.5 text-xs font-mono"
            title="Return to Live Mission Workspace"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Live Workspace</span>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                TACTICAL TIMELINE // REPLAY
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-mono text-blackbox-text mt-0.5 line-clamp-1">
              {mission?.title || 'Mission Operations Replay'}
            </h1>
          </div>
        </div>

        {/* Operational Telemetry Summary Chips */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
          <div className="px-3 py-1.5 rounded-lg bg-blackbox-surface border border-blackbox-border text-blackbox-muted flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>Progress:</span>
            <span className="text-blackbox-text font-bold">
              {total > 0 ? `${currentIndex + 1} / ${total}` : '0 / 0'}
            </span>
          </div>

          {summary?.durationFormatted && (
            <div className="px-3 py-1.5 rounded-lg bg-blackbox-surface border border-blackbox-border text-blackbox-muted flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Duration:</span>
              <span className="text-blackbox-text font-bold">{summary.durationFormatted}</span>
            </div>
          )}

          <div className="px-3 py-1.5 rounded-lg bg-blackbox-surface border border-blackbox-border text-blackbox-muted flex items-center gap-1.5">
            <Radio
              className={`w-3.5 h-3.5 ${
                reconstructedState.connectivity === 'ONLINE' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            />
            <span>Channel:</span>
            <span
              className={`font-bold ${
                reconstructedState.connectivity === 'ONLINE' ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {reconstructedState.connectivity}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
