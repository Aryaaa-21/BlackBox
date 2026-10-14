/**
 * Phase 8 — Mission Replay
 * ReplayTimeline — interactive chronological event stream with category filters,
 * search filtering, active playback marker, and click-to-seek capabilities.
 */

import React, { useEffect, useRef } from 'react';
import { Search, Filter, WifiOff, AlertTriangle, Cloud } from 'lucide-react';

import { useReplayStore } from '../../store/replayStore';
import { ReplayCategoryFilter } from '../../types/replay';

const CATEGORIES: { label: string; value: ReplayCategoryFilter }[] = [
  { label: 'ALL', value: 'ALL' },
  { label: 'MISSION', value: 'MISSION' },
  { label: 'TASKS', value: 'TASKS' },
  { label: 'TEAM', value: 'TEAM' },
  { label: 'OBSERVATIONS', value: 'OBSERVATIONS' },
  { label: 'NETWORK', value: 'NETWORK' },
  { label: 'SYNC', value: 'SYNC' },
];

export const ReplayTimeline: React.FC = () => {
  const {
    viewModels,
    currentIndex,
    filters,
    filteredIndices,
    setCurrentIndex,
    setCategoryFilter,
    setSearchFilter,
    clearFilters,
  } = useReplayStore();

  const activeItemRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll active event into view smoothly during playback
  useEffect(() => {
    if (activeItemRef.current && containerRef.current) {
      activeItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentIndex]);

  return (
    <div className="flex flex-col h-full bg-blackbox-surface border border-blackbox-border rounded-xl overflow-hidden shadow-sm">
      {/* Header & Filter Controls */}
      <div className="p-4 border-b border-blackbox-border space-y-3 bg-blackbox-surface/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-blackbox-text">
              Operational Timeline
            </span>
          </div>

          <span className="text-xs font-mono text-blackbox-muted">
            {filteredIndices.length} / {viewModels.length} Events
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-blackbox-muted" />
          <input
            type="text"
            placeholder="Search event, task, or operator..."
            value={filters.search || ''}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-blackbox-bg border border-blackbox-border text-xs font-mono text-blackbox-text focus:outline-none focus:border-cyan-400"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono whitespace-nowrap transition-all ${
                filters.category === cat.value
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'bg-blackbox-panel text-blackbox-muted hover:text-blackbox-text border border-blackbox-border'
              }`}
            >
              {cat.label}
            </button>
          ))}
          {(filters.category !== 'ALL' || filters.search) && (
            <button
              onClick={clearFilters}
              className="text-xs font-mono text-rose-400 hover:text-rose-300 ml-1 underline whitespace-nowrap"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Timeline Stream */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 divide-y divide-blackbox-border/30"
      >
        {filteredIndices.length === 0 ? (
          <div className="p-8 text-center text-blackbox-muted font-mono text-xs">
            No events match the active filter parameters.
          </div>
        ) : (
          filteredIndices.map((realIndex) => {
            const vm = viewModels[realIndex];
            const isCurrent = realIndex === currentIndex;
            const isPassed = realIndex < currentIndex;

            return (
              <div
                key={vm.id}
                ref={isCurrent ? activeItemRef : null}
                onClick={() => setCurrentIndex(realIndex)}
                className={`pt-3 first:pt-0 cursor-pointer group transition-all rounded-lg p-2.5 -mx-1 ${
                  isCurrent
                    ? 'bg-cyan-950/20 border border-cyan-500/40 shadow-sm'
                    : 'hover:bg-blackbox-panel/40 border border-transparent'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Timeline indicator node */}
                  <div className="flex flex-col items-center pt-1">
                    <span
                      className={`w-3 h-3 rounded-full transition-all ${
                        isCurrent
                          ? 'bg-cyan-400 ring-4 ring-cyan-500/20 animate-pulse'
                          : isPassed
                          ? `${vm.badgeColor.dot} opacity-70`
                          : 'bg-zinc-600 opacity-40'
                      }`}
                    />
                  </div>

                  {/* Event content */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono text-blackbox-muted">
                        {vm.formattedTime}
                      </span>

                      {/* Origin badges */}
                      <div className="flex items-center gap-1.5">
                        {vm.isConflict && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/30">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            <span>Conflict</span>
                          </span>
                        )}

                        {vm.isNetwork && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/30">
                            <WifiOff className="w-2.5 h-2.5" />
                            <span>Net</span>
                          </span>
                        )}

                        {vm.isLocal && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
                            <Cloud className="w-2.5 h-2.5" />
                            <span>Local</span>
                          </span>
                        )}

                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${vm.badgeColor.bg} ${vm.badgeColor.text} ${vm.badgeColor.border}`}
                        >
                          {vm.category}
                        </span>
                      </div>
                    </div>

                    <h4
                      className={`text-xs font-mono font-bold transition-colors ${
                        isCurrent
                          ? 'text-cyan-300'
                          : 'text-blackbox-text group-hover:text-cyan-400'
                      }`}
                    >
                      {vm.title}
                    </h4>

                    <p className="text-xs font-mono text-blackbox-textSecondary line-clamp-2">
                      {vm.description}
                    </p>

                    <div className="flex items-center gap-2 pt-1 text-[11px] font-mono text-blackbox-muted">
                      <span>By: {vm.actorName}</span>
                      {vm.targetName && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[150px]">Target: {vm.targetName}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
