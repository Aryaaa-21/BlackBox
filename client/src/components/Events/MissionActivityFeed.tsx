import React, { useMemo } from 'react';
import { useMissionEventStore } from '../../store/missionEventStore';
import { MissionEventItem } from './MissionEventItem';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
import { EventTargetType } from '../../types';

interface MissionActivityFeedProps {
  missionId: string;
  className?: string;
}

export const MissionActivityFeed: React.FC<MissionActivityFeedProps> = ({
  missionId,
  className = '',
}) => {
  const {
    events,
    isLoading,
    isLoadingMore,
    error,
    hasMore,
    fetchEvents,
    loadMoreEvents,
  } = useMissionEventStore();

  const [activeCategory, setActiveCategory] = React.useState<
    'ALL' | 'TASK' | 'MEMBER' | 'MISSION'
  >('ALL');

  const filteredEvents = useMemo(() => {
    if (activeCategory === 'ALL') return events;
    return events.filter((e) => {
      if (activeCategory === 'TASK') return e.targetType === EventTargetType.TASK;
      if (activeCategory === 'MEMBER') return e.targetType === EventTargetType.MEMBER;
      if (activeCategory === 'MISSION') return e.targetType === EventTargetType.MISSION;
      return true;
    });
  }, [events, activeCategory]);

  return (
    <div
      className={`bg-zinc-900/70 border border-zinc-800 rounded-xl flex flex-col overflow-hidden backdrop-blur-sm shadow-xl ${className}`}
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between gap-3 bg-zinc-950/40">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)] animate-pulse" />
          <h2 className="text-sm font-semibold tracking-wider text-zinc-100 uppercase font-mono">
            Mission Activity Feed
          </h2>
          <span className="text-xs text-zinc-400 font-mono px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700">
            {events.length}
          </span>
        </div>

        <ConnectionStatusIndicator />
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 border-b border-zinc-800/50 bg-zinc-950/20 flex items-center gap-1.5 overflow-x-auto text-xs font-mono">
        {(['ALL', 'TASK', 'MEMBER', 'MISSION'] as const).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeCategory === cat
                ? 'bg-zinc-800 text-zinc-100 font-medium border border-zinc-700'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
            }`}
          >
            {cat === 'ALL'
              ? 'ALL ACTIVITY'
              : cat === 'TASK'
              ? 'TASKS'
              : cat === 'MEMBER'
              ? 'TEAM'
              : 'LIFECYCLE'}
          </button>
        ))}
      </div>

      {/* Feed Content */}
      <div className="p-4 flex-1 overflow-y-auto space-y-2.5 max-h-[500px]">
        {isLoading && events.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-6 h-6 border-2 border-zinc-600 border-t-cyan-400 rounded-full animate-spin mb-3" />
            <p className="text-xs font-mono text-zinc-400 tracking-wider">
              ESTABLISHING STREAM & LOADING EVENTS...
            </p>
          </div>
        ) : error && events.length === 0 ? (
          <div className="py-10 px-4 text-center border border-rose-900/30 bg-rose-950/20 rounded-lg">
            <p className="text-rose-400 text-xs font-mono mb-3">{error}</p>
            <button
              type="button"
              onClick={() => fetchEvents(missionId)}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded border border-zinc-700 transition-colors"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredEvents.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <p className="text-zinc-400 text-xs font-mono tracking-wide">
              No operational events recorded in this category.
            </p>
            <p className="text-zinc-400 text-xs mt-1">
              Events will be streamed here in real time as the mission unfolds.
            </p>
          </div>
        ) : (
          <>
            {filteredEvents.map((event) => (
              <MissionEventItem key={event.id} event={event} />
            ))}

            {hasMore && (
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={loadMoreEvents}
                  disabled={isLoadingMore}
                  className="px-3.5 py-1.5 text-xs font-mono text-zinc-400 hover:text-zinc-200 bg-zinc-800/60 hover:bg-zinc-800 rounded border border-zinc-700/80 transition-colors disabled:opacity-50"
                >
                  {isLoadingMore ? 'LOADING OLDER EVENTS...' : 'LOAD OLDER ACTIVITY'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
