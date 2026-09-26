import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { EmptyState } from '../components/Common/EmptyState';

export const MissionDetailPage: React.FC = () => {
  const { missionId } = useParams<{ missionId: string }>();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/missions"
          className="p-2 rounded-lg bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border text-blackbox-muted hover:text-blackbox-text transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <span className="text-xs font-mono text-blackbox-muted">MISSION DETAILS //</span>
          <h2 className="text-xl font-bold font-mono text-blackbox-text">Mission ID: {missionId}</h2>
        </div>
      </div>

      <EmptyState
        icon={Compass}
        title="Mission Record Standby"
        description={`Detail view for mission #${missionId} will be populated in Phase 3 with tasks, team rosters, and real-time event timeline.`}
      />
    </div>
  );
};
