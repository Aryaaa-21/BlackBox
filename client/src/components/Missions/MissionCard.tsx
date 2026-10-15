import React from 'react';
import { ChevronRight, Clock3, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Mission } from '../../types';
import { MissionSeverityBadge } from './MissionSeverityBadge';
import { MissionStatusBadge } from './MissionStatusBadge';

interface MissionCardProps {
  mission: Mission;
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'recently';
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return `${Math.floor(diffInHours / 24)}d ago`;
}

type MissionWithTaskSummary = Mission & {
  taskProgress?: { completed?: number; total?: number };
  taskStats?: { completed?: number; total?: number };
  tasks?: { status?: string }[];
};

interface TaskProgress {
  label: string;
  percent: number;
}

function getTaskProgress(mission: Mission): TaskProgress {
  const record = mission as MissionWithTaskSummary;
  const summary = record.taskProgress || record.taskStats;
  const completedFromTasks = record.tasks?.filter((task) => task.status === 'COMPLETED').length;
  const totalFromTasks = record.tasks?.length;
  const completed = summary?.completed ?? completedFromTasks;
  const total = summary?.total ?? totalFromTasks;

  if (typeof completed === 'number' && typeof total === 'number' && total > 0) {
    const safeCompleted = Math.min(Math.max(completed, 0), total);
    return {
      label: `${safeCompleted}/${total}`,
      percent: Math.round((safeCompleted / total) * 100),
    };
  }

  const fallback = {
    DRAFT: { label: 'Not started', percent: 0 },
    ACTIVE: { label: 'In progress', percent: 50 },
    COMPLETED: { label: 'Complete', percent: 100 },
    CANCELLED: { label: 'Stopped', percent: 0 },
  }[mission.status];

  return fallback;
}

export const MissionCard: React.FC<MissionCardProps> = ({ mission }) => {
  const taskProgress = getTaskProgress(mission);

  return (
    <Link
      to={`/missions/${mission.id}`}
      aria-label={`Open mission ${mission.title}`}
      className="group grid min-w-0 gap-3 border-b border-blackbox-border bg-blackbox-surface px-4 py-4 transition-colors duration-200 last:border-b-0 hover:bg-blackbox-panel focus-visible:relative focus-visible:z-10 sm:px-5 lg:grid-cols-[minmax(0,1.9fr)_minmax(110px,0.85fr)_minmax(120px,1.05fr)_minmax(130px,1fr)_minmax(105px,0.8fr)_minmax(100px,0.8fr)] lg:items-center lg:gap-4"
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-start gap-2">
          <h3 className="min-w-0 flex-1 truncate font-sans text-sm font-semibold text-blackbox-text transition-colors group-hover:text-blackbox-cyan sm:text-[15px]">
            {mission.title}
          </h3>
          <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-blackbox-muted transition-transform group-hover:translate-x-0.5 group-hover:text-blackbox-cyan lg:hidden" />
        </div>
        <p className="mt-1 truncate font-mono text-[10px] text-blackbox-muted">ID {mission.id}</p>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-3 border-t border-blackbox-border/70 pt-3 sm:grid-cols-4 lg:contents lg:border-0 lg:pt-0">
        <div className="min-w-0">
          <span className="ops-kicker lg:hidden">Status</span>
          <div className="mt-1 lg:mt-0"><MissionStatusBadge status={mission.status} size="sm" /></div>
        </div>

        <div className="min-w-0">
          <span className="ops-kicker lg:hidden">Location</span>
          <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-blackbox-textSecondary lg:mt-0">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-blackbox-cyan" />
            <span className="truncate" title={mission.location}>{mission.location}</span>
          </div>
        </div>

        <div className="min-w-0">
          <span className="ops-kicker lg:hidden">Task progress</span>
          <div className="mt-1 min-w-0 lg:mt-0">
            <div className="flex items-center gap-2">
              <div className="h-1.5 min-w-0 flex-1 rounded-full bg-blackbox-panel" aria-hidden="true">
                <div className="h-full rounded-full bg-blackbox-cyan transition-[width] duration-300" style={{ width: `${taskProgress.percent}%` }} />
              </div>
              <span className="shrink-0 font-mono text-[10px] text-blackbox-textSecondary">{taskProgress.label}</span>
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <span className="ops-kicker lg:hidden">Severity</span>
          <div className="mt-1 lg:mt-0"><MissionSeverityBadge severity={mission.severity} size="sm" /></div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-blackbox-border/70 pt-3 lg:border-0 lg:pt-0">
        <div className="flex min-w-0 items-center gap-1.5 font-mono text-[10px] text-blackbox-muted">
          <Clock3 className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{formatRelativeTime(mission.updatedAt)}</span>
        </div>
        <span className="hidden items-center gap-1 font-mono text-[10px] text-blackbox-cyan lg:flex">
          Open <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
};
