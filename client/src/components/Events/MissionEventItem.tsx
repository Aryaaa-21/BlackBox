import React from 'react';
import { MissionEvent } from '../../types';
import { formatMissionEvent } from '../../utils/missionEventFormatter';

interface MissionEventItemProps {
  event: MissionEvent;
}

export const MissionEventItem: React.FC<MissionEventItemProps> = ({ event }) => {
  const formatted = formatMissionEvent(event);

  const getBadgeClasses = (variant: string) => {
    switch (variant) {
      case 'success':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'danger':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'warning':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'info':
        return 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20';
      case 'primary':
        return 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20';
      default:
        return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  return (
    <div className="flex gap-3 py-3 px-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 hover:border-zinc-700/80 transition-all text-sm group">
      {/* Timeline indicator node */}
      <div className="flex flex-col items-center pt-1">
        <div className="w-2 h-2 rounded-full bg-zinc-600 group-hover:bg-zinc-400 transition-colors" />
        <div className="w-px h-full bg-zinc-800 my-1" />
      </div>

      {/* Event Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-zinc-200 tracking-tight">
              {formatted.actorName}
            </span>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.5 rounded border uppercase tracking-wider ${getBadgeClasses(
                formatted.badgeVariant
              )}`}
            >
              {formatted.action}
            </span>
          </div>
          <time
            dateTime={formatted.isoTime}
            className="text-zinc-400 text-xs font-mono shrink-0"
          >
            {formatted.formattedTime}
          </time>
        </div>

        {formatted.targetLabel && (
          <div className="text-zinc-100 font-medium text-xs truncate bg-zinc-800/40 px-2 py-1 rounded border border-zinc-800 inline-block max-w-full">
            {formatted.targetLabel}
          </div>
        )}

        {formatted.details && (
          <span className="text-xs text-zinc-400 font-mono ml-2">
            {formatted.details}
          </span>
        )}
      </div>
    </div>
  );
};
