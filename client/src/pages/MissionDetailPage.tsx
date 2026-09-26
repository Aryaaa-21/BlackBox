import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Play,
  CheckCircle,
  XCircle,
  Edit3,
  Calendar,
  Layers,
  Users,
  CheckSquare,
  Activity,
  AlertCircle,
  Lock,
  User,
  Radio,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useMissionStore } from '../store/missionStore';
import { MissionStatusBadge } from '../components/Missions/MissionStatusBadge';
import { MissionSeverityBadge } from '../components/Missions/MissionSeverityBadge';
import { ConfirmDialog } from '../components/Common/ConfirmDialog';
import { LoadingState } from '../components/Common/LoadingState';
import { ErrorState } from '../components/Common/ErrorState';
import { socketService } from '../services/socket';
import { Mission, MissionSeverity } from '../types';

export const MissionDetailPage: React.FC = () => {
  const { missionId } = useParams<{ missionId: string }>();
  const { user } = useAuthStore();
  const {
    selectedMission,
    isLoading,
    isActionLoading,
    isUpdating,
    error,
    fetchMission,
    startMission,
    completeMission,
    cancelMission,
    updateMission,
    joinMissionRoom,
    leaveMissionRoom,
    handleRealtimeMissionUpdate,
    clearSelectedMission,
  } = useMissionStore();

  // Confirmation Modal states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: 'START' | 'COMPLETE' | 'CANCEL' | null;
    title: string;
    message: string;
    confirmLabel: string;
    variant: 'danger' | 'warning' | 'primary' | 'success';
  }>({
    isOpen: false,
    type: null,
    title: '',
    message: '',
    confirmLabel: '',
    variant: 'primary',
  });

  // Edit Mission Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    title: string;
    description: string;
    location: string;
    severity: MissionSeverity;
  }>({
    title: '',
    description: '',
    location: '',
    severity: 'MEDIUM',
  });
  const [editError, setEditError] = useState<string | null>(null);

  // Load mission and join Socket room
  useEffect(() => {
    if (!missionId) return;

    fetchMission(missionId).catch(() => {});
    joinMissionRoom(missionId);

    // Listen for room broadcasts
    const unsubUpdated = socketService.subscribe('mission:updated', (data) => {
      const m = data as Mission;
      if (m.id === missionId) {
        handleRealtimeMissionUpdate(m);
      }
    });

    const unsubStarted = socketService.subscribe('mission:started', (data) => {
      const m = data as Mission;
      if (m.id === missionId) {
        handleRealtimeMissionUpdate(m);
      }
    });

    const unsubCompleted = socketService.subscribe('mission:completed', (data) => {
      const m = data as Mission;
      if (m.id === missionId) {
        handleRealtimeMissionUpdate(m);
      }
    });

    const unsubCancelled = socketService.subscribe('mission:cancelled', (data) => {
      const m = data as Mission;
      if (m.id === missionId) {
        handleRealtimeMissionUpdate(m);
      }
    });

    return () => {
      leaveMissionRoom(missionId);
      unsubUpdated();
      unsubStarted();
      unsubCompleted();
      unsubCancelled();
      clearSelectedMission();
    };
  }, [
    missionId,
    fetchMission,
    joinMissionRoom,
    leaveMissionRoom,
    handleRealtimeMissionUpdate,
    clearSelectedMission,
  ]);

  // Set edit form values when selectedMission loads or modal opens
  useEffect(() => {
    if (selectedMission) {
      setEditFormData({
        title: selectedMission.title,
        description: selectedMission.description,
        location: selectedMission.location,
        severity: selectedMission.severity,
      });
    }
  }, [selectedMission]);

  if (isLoading && !selectedMission) {
    return (
      <LoadingState
        message="Loading operational mission parameters..."
        subtext="Fetching authenticated mission record from MongoDB"
      />
    );
  }

  if (error || !selectedMission) {
    return (
      <div className="py-8 space-y-4 max-w-xl mx-auto text-center">
        <ErrorState
          title={error?.includes('denied') ? 'Access Denied' : 'Mission Unavailable'}
          message={error || 'The requested mission record could not be loaded.'}
          onRetry={() => {
            if (missionId) fetchMission(missionId).catch(() => {});
          }}
        />
        <div>
          <Link
            to="/missions"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border text-xs font-mono text-blackbox-text transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Missions Directory</span>
          </Link>
        </div>
      </div>
    );
  }

  // Permissions calculation
  const isCommander = user?.role === 'COMMANDER';
  const creatorId =
    typeof selectedMission.createdBy === 'object' && selectedMission.createdBy !== null
      ? selectedMission.createdBy.id
      : selectedMission.createdBy;
  const isOwner = user?.id === creatorId;
  const canManage = isCommander && isOwner;

  const creatorName =
    typeof selectedMission.createdBy === 'object' && selectedMission.createdBy !== null
      ? selectedMission.createdBy.name
      : 'Unknown Commander';

  // Action Triggers
  const openConfirmStart = () => {
    setConfirmDialog({
      isOpen: true,
      type: 'START',
      title: 'Initiate Mission Directive',
      message:
        'Commence operational deployment? This transitions mission status from DRAFT to ACTIVE and notifies all deployed tactical units.',
      confirmLabel: 'Start Mission',
      variant: 'primary',
    });
  };

  const openConfirmComplete = () => {
    setConfirmDialog({
      isOpen: true,
      type: 'COMPLETE',
      title: 'Complete Mission Operations',
      message:
        'Mark this mission as COMPLETED? Once completed, the mission lifecycle is closed and further operational edits will be locked.',
      confirmLabel: 'Complete Mission',
      variant: 'success',
    });
  };

  const openConfirmCancel = () => {
    setConfirmDialog({
      isOpen: true,
      type: 'CANCEL',
      title: 'Cancel Mission Operations',
      message:
        'Are you sure you want to cancel this mission? This transitions status to CANCELLED and ceases active coordination.',
      confirmLabel: 'Cancel Mission',
      variant: 'danger',
    });
  };

  const handleConfirmAction = async () => {
    if (!missionId) return;
    try {
      if (confirmDialog.type === 'START') {
        await startMission(missionId);
      } else if (confirmDialog.type === 'COMPLETE') {
        await completeMission(missionId);
      } else if (confirmDialog.type === 'CANCEL') {
        await cancelMission(missionId);
      }
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
    } catch {
      // Error handled by store
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!missionId) return;
    setEditError(null);

    if (!editFormData.title.trim()) {
      setEditError('Mission title is required');
      return;
    }
    if (!editFormData.location.trim()) {
      setEditError('Location is required');
      return;
    }
    if (!editFormData.description.trim()) {
      setEditError('Description is required');
      return;
    }

    try {
      await updateMission(missionId, {
        title: editFormData.title.trim(),
        description: editFormData.description.trim(),
        location: editFormData.location.trim(),
        severity: editFormData.severity,
      });
      setIsEditModalOpen(false);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      setEditError(errorObj.message || 'Failed to update mission');
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-4 border-b border-blackbox-border">
        <div className="flex items-center gap-3">
          <Link
            to="/missions"
            className="p-2 rounded-lg bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border text-blackbox-muted hover:text-blackbox-text transition-colors"
            title="Back to Missions"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blackbox-cyan animate-pulse" />
              <span className="text-xs font-mono text-blackbox-cyan uppercase tracking-wider font-semibold">
                TACTICAL WORKSPACE // MISSION
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-mono text-blackbox-text mt-0.5 line-clamp-1">
              {selectedMission.title}
            </h2>
          </div>
        </div>

        {/* Live Channel Status */}
        <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-blackbox-surface border border-blackbox-border text-blackbox-muted">
          <Radio className="w-3.5 h-3.5 text-blackbox-cyan animate-pulse" />
          <span className="hidden sm:inline">Stream Channel:</span>
          <span className="text-blackbox-text font-bold">mission:{selectedMission.id.substring(0, 6)}</span>
        </div>
      </div>

      {/* Mission Primary Header Card */}
      <div className="p-6 rounded-xl bg-blackbox-surface border border-blackbox-border shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <MissionStatusBadge status={selectedMission.status} size="lg" />
            <MissionSeverityBadge severity={selectedMission.severity} size="lg" />
            <div className="flex items-center gap-1.5 text-xs font-mono text-blackbox-textSecondary bg-blackbox-bg px-3 py-1.5 rounded-md border border-blackbox-border">
              <MapPin className="w-4 h-4 text-blackbox-cyan shrink-0" />
              <span className="font-semibold">{selectedMission.location}</span>
            </div>
          </div>

          {/* Action Buttons for Authorized Commanders */}
          {canManage ? (
            <div className="flex items-center gap-2 flex-wrap">
              {/* DRAFT ACTIONS: Start, Edit, Cancel */}
              {selectedMission.status === 'DRAFT' && (
                <>
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-3 py-2 rounded-lg bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border text-xs font-mono text-blackbox-text flex items-center gap-1.5 transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    onClick={openConfirmCancel}
                    className="px-3 py-2 rounded-lg bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/60 text-xs font-mono text-rose-300 flex items-center gap-1.5 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </button>
                  <button
                    onClick={openConfirmStart}
                    disabled={isActionLoading}
                    className="px-4 py-2 rounded-lg bg-blackbox-cyan hover:bg-cyan-300 text-black font-mono font-bold text-xs border border-cyan-400 flex items-center gap-2 shadow-[0_0_12px_rgba(0,210,255,0.25)] transition-all"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Start Mission</span>
                  </button>
                </>
              )}

              {/* ACTIVE ACTIONS: Complete, Cancel */}
              {selectedMission.status === 'ACTIVE' && (
                <>
                  <button
                    onClick={openConfirmCancel}
                    className="px-3 py-2 rounded-lg bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/60 text-xs font-mono text-rose-300 flex items-center gap-1.5 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Cancel Mission</span>
                  </button>
                  <button
                    onClick={openConfirmComplete}
                    disabled={isActionLoading}
                    className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono font-bold text-xs border border-emerald-400 flex items-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.25)] transition-all"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Complete Mission</span>
                  </button>
                </>
              )}

              {/* COMPLETED or CANCELLED: Closed badge */}
              {(selectedMission.status === 'COMPLETED' || selectedMission.status === 'CANCELLED') && (
                <div className="text-xs font-mono text-blackbox-muted flex items-center gap-1.5 bg-blackbox-panel px-3 py-1.5 rounded-lg border border-blackbox-border">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Lifecycle Finalized ({selectedMission.status})</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-xs font-mono text-blackbox-muted flex items-center gap-1.5 bg-blackbox-panel px-3 py-1.5 rounded-lg border border-blackbox-border">
              <Lock className="w-3.5 h-3.5" />
              <span>
                {isCommander
                  ? 'Controlled by Creator Unit'
                  : 'Field Operator (Read-Only Clearance)'}
              </span>
            </div>
          )}
        </div>

        {/* Mission Description */}
        <div className="pt-4 border-t border-blackbox-border">
          <h4 className="text-xs font-mono font-bold text-blackbox-muted uppercase tracking-wider mb-2">
            Operational Directives & Description
          </h4>
          <p className="text-sm font-sans text-blackbox-text leading-relaxed whitespace-pre-wrap">
            {selectedMission.description}
          </p>
        </div>

        {/* Lifecycle Timestamps & Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-blackbox-border text-xs font-mono">
          <div>
            <span className="text-blackbox-muted block mb-1">COMMANDING OFFICER</span>
            <div className="flex items-center gap-1.5 text-blackbox-text font-medium truncate">
              <User className="w-3.5 h-3.5 text-blackbox-cyan shrink-0" />
              <span className="truncate">{creatorName}</span>
            </div>
          </div>

          <div>
            <span className="text-blackbox-muted block mb-1">REGISTERED</span>
            <div className="flex items-center gap-1.5 text-blackbox-textSecondary">
              <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>{new Date(selectedMission.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div>
            <span className="text-blackbox-muted block mb-1">
              {selectedMission.startedAt
                ? 'COMMENCED'
                : selectedMission.cancelledAt
                ? 'CANCELLED AT'
                : 'COMMENCED'}
            </span>
            <div className="flex items-center gap-1.5 text-blackbox-textSecondary">
              <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>
                {selectedMission.startedAt
                  ? new Date(selectedMission.startedAt).toLocaleTimeString()
                  : selectedMission.cancelledAt
                  ? new Date(selectedMission.cancelledAt).toLocaleTimeString()
                  : 'Pending Launch'}
              </span>
            </div>
          </div>

          <div>
            <span className="text-blackbox-muted block mb-1">
              {selectedMission.completedAt ? 'COMPLETED AT' : 'LAST REVISION'}
            </span>
            <div className="flex items-center gap-1.5 text-blackbox-textSecondary">
              <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span>
                {selectedMission.completedAt
                  ? new Date(selectedMission.completedAt).toLocaleTimeString()
                  : new Date(selectedMission.updatedAt).toLocaleTimeString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Area (Reserved for Phase 4 & Phase 5, Section 32 & 66) */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-blackbox-cyan" />
          <h3 className="text-sm font-mono font-bold text-blackbox-text uppercase tracking-wider">
            Operational Workspace Modules
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Team Roster Placeholder */}
          <div className="p-5 rounded-xl bg-blackbox-surface/60 border border-dashed border-blackbox-border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-blackbox-text">
                  <Users className="w-4 h-4 text-zinc-400" />
                  <span>Assigned Tactical Team</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blackbox-panel text-zinc-400 border border-blackbox-border">
                  PHASE 4
                </span>
              </div>
              <p className="text-xs text-blackbox-muted leading-relaxed">
                Unit roster, field operator deployment assignments, and operational role allocation will be linked in Phase 4.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-blackbox-border/40 text-[11px] font-mono text-zinc-500">
              Module: team-management
            </div>
          </div>

          {/* Task Operations Placeholder */}
          <div className="p-5 rounded-xl bg-blackbox-surface/60 border border-dashed border-blackbox-border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-blackbox-text">
                  <CheckSquare className="w-4 h-4 text-zinc-400" />
                  <span>Mission Tasks & Objectives</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blackbox-panel text-zinc-400 border border-blackbox-border">
                  PHASE 4
                </span>
              </div>
              <p className="text-xs text-blackbox-muted leading-relaxed">
                Checkpoints, field task checklist, sub-task status reports, and operator dispatch workflows will be unlocked in Phase 4.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-blackbox-border/40 text-[11px] font-mono text-zinc-500">
              Module: task-operations
            </div>
          </div>

          {/* Live Activity & Event Replay Placeholder */}
          <div className="p-5 rounded-xl bg-blackbox-surface/60 border border-dashed border-blackbox-border flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-mono font-semibold text-blackbox-text">
                  <Activity className="w-4 h-4 text-zinc-400" />
                  <span>Real-Time Events & Replay</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blackbox-panel text-zinc-400 border border-blackbox-border">
                  PHASE 5
                </span>
              </div>
              <p className="text-xs text-blackbox-muted leading-relaxed">
                Immutable event stream ledger, operational timeline reconstruction, and mission replay will be enabled in Phase 5.
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-blackbox-border/40 text-[11px] font-mono text-zinc-500">
              Module: event-ledger-replay
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        variant={confirmDialog.variant}
        isLoading={isActionLoading}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Edit Mission Modal */}
      {isEditModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-mission-modal-title"
        >
          <div className="w-full max-w-xl bg-blackbox-surface border border-blackbox-border rounded-xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
            <h3
              id="edit-mission-modal-title"
              className="text-base font-mono font-bold text-blackbox-text mb-4 pb-2 border-b border-blackbox-border flex items-center gap-2"
            >
              <Edit3 className="w-4 h-4 text-blackbox-cyan" />
              <span>Modify Mission Parameters</span>
            </h3>

            {editError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-900/60 text-xs font-mono text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-blackbox-text uppercase tracking-wider mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={editFormData.title}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, title: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-blackbox-bg border border-blackbox-border text-xs font-mono text-blackbox-text focus:outline-none focus:border-blackbox-cyan focus:ring-1 focus:ring-blackbox-cyan"
                  maxLength={200}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono font-semibold text-blackbox-text uppercase tracking-wider mb-1">
                    Severity
                  </label>
                  <select
                    value={editFormData.severity}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        severity: e.target.value as MissionSeverity,
                      })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-blackbox-bg border border-blackbox-border text-xs font-mono text-blackbox-text focus:outline-none focus:border-blackbox-cyan focus:ring-1 focus:ring-blackbox-cyan"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRITICAL">CRITICAL</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono font-semibold text-blackbox-text uppercase tracking-wider mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={editFormData.location}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, location: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-lg bg-blackbox-bg border border-blackbox-border text-xs font-mono text-blackbox-text focus:outline-none focus:border-blackbox-cyan focus:ring-1 focus:ring-blackbox-cyan"
                    maxLength={200}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-blackbox-text uppercase tracking-wider mb-1">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={editFormData.description}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, description: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-blackbox-bg border border-blackbox-border text-xs font-mono text-blackbox-text focus:outline-none focus:border-blackbox-cyan focus:ring-1 focus:ring-blackbox-cyan"
                  maxLength={5000}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-blackbox-border">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-lg bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border text-xs font-mono text-blackbox-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-lg bg-blackbox-cyan hover:bg-cyan-300 text-black font-mono font-semibold text-xs border border-cyan-400 transition-all disabled:opacity-50"
                >
                  {isUpdating ? 'Saving Changes...' : 'Save Parameters'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
