/**
 * Phase 8 — Mission Replay
 * MissionReplayPage — full tactical mission replay view with chronological timeline,
 * playback scrubber and transport, deterministic state reconstruction panel,
 * and deep event telemetry inspection.
 */

import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { History, ArrowLeft } from 'lucide-react';
import { useReplayStore } from '../store/replayStore';
import { ReplayHeader } from '../components/Replay/ReplayHeader';
import { ReplayControls } from '../components/Replay/ReplayControls';
import { ReplayTimeline } from '../components/Replay/ReplayTimeline';
import { ReplayStatePanel } from '../components/Replay/ReplayStatePanel';
import { ReplayEventDetails } from '../components/Replay/ReplayEventDetails';
import { ReplayTaskHistoryModal } from '../components/Replay/ReplayTaskHistoryModal';
import { LoadingState } from '../components/Common/LoadingState';
import { ErrorState } from '../components/Common/ErrorState';
import { ReplayTask } from '../types/replay';

export const MissionReplayPage: React.FC = () => {
  const { missionId } = useParams<{ missionId: string }>();
  const {
    events,
    isLoading,
    error,
    loadReplay,
    clearReplay,
  } = useReplayStore();

  const [inspectedTask, setInspectedTask] = useState<ReplayTask | null>(null);

  useEffect(() => {
    if (missionId) {
      loadReplay(missionId);
    }
    return () => {
      clearReplay();
    };
  }, [missionId, loadReplay, clearReplay]);

  // Loading View
  if (isLoading) {
    return (
      <div className="py-12">
        <LoadingState message="Reconstructing mission operational history..." />
      </div>
    );
  }

  // Error View
  if (error) {
    const isPermissionError =
      error.toLowerCase().includes('denied') || error.toLowerCase().includes('permission');
    const isNotFound = error.toLowerCase().includes('not found');

    return (
      <div className="py-12 max-w-2xl mx-auto space-y-4 font-mono">
        <ErrorState
          title={
            isPermissionError
              ? 'Mission Replay Authorization Required'
              : isNotFound
              ? 'Mission Directive Not Found'
              : 'Replay Telemetry Unavailable'
          }
          message={error}
          onRetry={missionId ? () => loadReplay(missionId) : undefined}
        />
        <div className="text-center pt-2">
          <Link
            to={missionId ? `/missions/${missionId}` : '/missions'}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border text-xs text-blackbox-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Mission Workspace</span>
          </Link>
        </div>
      </div>
    );
  }

  // Empty View (Mission has no events)
  if (events.length === 0) {
    return (
      <div className="py-12 max-w-2xl mx-auto space-y-6 font-mono text-center">
        <div className="p-8 rounded-xl bg-blackbox-surface border border-blackbox-border space-y-4">
          <div className="w-12 h-12 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 mx-auto flex items-center justify-center">
            <History className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-blackbox-text">No Replay History Available</h2>
          <p className="text-xs text-blackbox-muted max-w-md mx-auto">
            This mission directive has not recorded any operational events yet. Operational telemetry will appear as tactical actions unfold.
          </p>
          <div className="pt-2">
            <Link
              to={missionId ? `/missions/${missionId}` : '/missions'}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-xs font-bold hover:bg-cyan-500/30 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Mission Workspace</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ops-page pb-16 animate-fade-in">
      <div className="flex items-center justify-between rounded-lg border border-amber-900/50 bg-amber-950/20 px-3 py-2 text-xs text-amber-200" role="status">
        <span className="font-semibold">Replay mode</span>
        <span className="text-amber-200/75">Read only · historical events</span>
      </div>
      {/* Replay Header */}
      <ReplayHeader />

      {/* Replay Controls & Transport Scrubber */}
      <ReplayControls />

      {/* Main Tactical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Interactive Timeline (5 columns on desktop) */}
        <div className="h-[420px] lg:col-span-5 lg:h-[700px]">
          <ReplayTimeline />
        </div>

        {/* Right Column: State Panel + Event Telemetry Details (7 columns on desktop) */}
        <div className="lg:col-span-7 space-y-6">
          <ReplayStatePanel onInspectTask={(task) => setInspectedTask(task)} />
          <ReplayEventDetails />
        </div>
      </div>

      {/* Task Lifecycle Trace Modal */}
      {inspectedTask && (
        <ReplayTaskHistoryModal
          task={inspectedTask}
          onClose={() => setInspectedTask(null)}
        />
      )}
    </div>
  );
};
