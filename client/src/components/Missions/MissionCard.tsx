import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Clock, ChevronRight, User } from 'lucide-react';
import { Mission } from '../../types';
import { MissionStatusBadge } from './MissionStatusBadge';
import { MissionSeverityBadge } from './MissionSeverityBadge';

interface MissionCardProps {
  mission: Mission;
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'recently';
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
}

export const MissionCard: React.FC<MissionCardProps> = ({ mission }) => {
  const creatorName =
    typeof mission.createdBy === 'object' && mission.createdBy !== null
      ? mission.createdBy.name
      : 'Authorized Unit';

  return (
    <Link
      to={`/missions/${mission.id}`}
      className="group relative block overflow-hidden rounded-xl border border-blackbox-border bg-blackbox-surface p-5 shadow-sm transition-colors duration-200 hover:border-blackbox-cyan/40 hover:bg-blackbox-panel"
    >
      {/* Top Bar: Status + Severity Badges */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <MissionStatusBadge status={mission.status} size="sm" />
          <MissionSeverityBadge severity={mission.severity} size="sm" />
        </div>
        <div className="flex items-center gap-1 text-[11px] font-mono text-blackbox-muted shrink-0">
          <Clock className="w-3.5 h-3.5" />
          <span>Updated {formatRelativeTime(mission.updatedAt)}</span>
        </div>
      </div>

      {/* Main Mission Title */}
      <h3 className="text-base font-mono font-bold text-blackbox-text group-hover:text-blackbox-cyan transition-colors line-clamp-1 mb-2">
        {mission.title}
      </h3>

      {/* Description Snippet */}
      <p className="text-xs text-blackbox-textSecondary line-clamp-2 leading-relaxed mb-4">
        {mission.description}
      </p>

      {/* Footer Info: Location & Creator */}
      <div className="flex items-center justify-between pt-3 border-t border-blackbox-border/60 text-xs font-mono text-blackbox-muted">
        <div className="flex items-center gap-4 truncate">
          <div className="flex items-center gap-1.5 truncate text-blackbox-textSecondary">
            <MapPin className="w-3.5 h-3.5 text-blackbox-cyan shrink-0" />
            <span className="truncate">{mission.location}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-zinc-400">
            <User className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{creatorName}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 text-blackbox-cyan font-mono text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <span>Open</span>
          <ChevronRight className="w-3.5 h-3.5 transform group-hover:translate-x-0.5 transition-transform" />
        </div>
      </div>
    </Link>
  );
};
