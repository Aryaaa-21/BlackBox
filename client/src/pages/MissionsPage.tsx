import React from 'react';
import { Compass, Clock, Plus, ShieldAlert } from 'lucide-react';
import { EmptyState } from '../components/Common/EmptyState';

export const MissionsPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-blackbox-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blackbox-cyan" />
            <span className="text-xs font-mono text-blackbox-cyan uppercase tracking-wider font-semibold">
              FIELD OPERATIONS // DIRECTORY
            </span>
          </div>
          <h2 className="text-2xl font-bold font-mono text-blackbox-text mt-1">Missions Overview</h2>
          <p className="text-xs text-blackbox-muted mt-0.5">
            Mission coordination, task assignments, and live event recording.
          </p>
        </div>

        <button
          disabled
          className="px-3.5 py-2 rounded-lg bg-blackbox-panel border border-blackbox-border text-xs font-mono text-blackbox-muted flex items-center gap-2 cursor-not-allowed opacity-60"
          title="Mission creation will be introduced in Phase 3"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Mission (Phase 3)</span>
        </button>
      </div>

      <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-900/40 text-xs font-mono text-amber-300 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">PHASE 1 ARCHITECTURE BOUNDARY: </span>
          Full mission lifecycle, tasks, and geospatial tracking will be implemented in Phase 3.
          The foundational Mission Mongoose schema is established on the backend at{' '}
          <code className="text-blackbox-text font-bold">/api/v1/missions</code>.
        </div>
      </div>

      <EmptyState
        icon={Compass}
        title="Mission Operational Engine Standby"
        description="The mission schema and API endpoints are initialized. Operational creation, live tracking, and offline dispatch will be unlocked in subsequent phases."
        action={
          <div className="flex items-center gap-2 text-xs font-mono text-blackbox-muted">
            <Clock className="w-4 h-4 text-blackbox-cyan" />
            <span>Scheduled for Phase 3: Mission Operations</span>
          </div>
        }
      />
    </div>
  );
};
