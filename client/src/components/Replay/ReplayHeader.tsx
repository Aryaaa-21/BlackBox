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
      <div className="flex flex-col gap-3 rounded-lg border border-blackbox-borderLight bg-blackbox-panel p-3 font-mono text-xs text-blackbox-textSecondary sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 shrink-0 text-blackbox-warning" />
          <span className="font-bold tracking-wider text-blackbox-text">Historical replay / read only</span>
          <span className="hidden md:inline text-blackbox-muted">·</span>
          <span className="hidden md:inline text-blackbox-muted">
            Reconstructing past operational state from immutable mission event logs. Real state is not affected.
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
            <span className="rounded border border-blackbox-borderLight bg-blackbox-elevated px-2 py-0.5 font-semibold text-blackbox-text">
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
              <span className="h-2 w-2 rounded-full bg-blackbox-cyan" />
              <span className="text-xs font-mono font-semibold uppercase tracking-wider text-blackbox-cyan">
                Timeline / replay
              </span>
            </div>
              <h1 className="mt-0.5 line-clamp-1 font-display text-xl font-bold text-blackbox-text sm:text-2xl">
              {mission?.title || 'Mission Operations Replay'}
            </h1>
          </div>
        </div>

        {/* Operational Telemetry Summary Chips */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
            <div className="flex items-center gap-1.5 rounded-lg border border-blackbox-border bg-blackbox-surface px-3 py-1.5 text-blackbox-muted">
              <Activity className="h-3.5 w-3.5 text-blackbox-cobalt" />
            <span>Progress:</span>
            <span className="text-blackbox-text font-bold">
              {total > 0 ? `${currentIndex + 1} / ${total}` : '0 / 0'}
            </span>
          </div>

          {summary?.durationFormatted && (
            <div className="flex items-center gap-1.5 rounded-lg border border-blackbox-border bg-blackbox-surface px-3 py-1.5 text-blackbox-muted">
              <Clock className="h-3.5 w-3.5 text-blackbox-cobalt" />
              <span>Duration:</span>
              <span className="text-blackbox-text font-bold">{summary.durationFormatted}</span>
            </div>
          )}

          <div className="px-3 py-1.5 rounded-lg bg-blackbox-surface border border-blackbox-border text-blackbox-muted flex items-center gap-1.5">
            <Radio
              className="h-3.5 w-3.5 text-blackbox-cobalt"
            />
            <span>Channel:</span>
            <span
              className="font-bold text-blackbox-cobalt"
            >
              {reconstructedState.connectivity}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
