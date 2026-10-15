import React, { useCallback, useEffect, useState } from 'react';
import { Compass, Filter, Plus, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState } from '../components/Common/ErrorState';
import { EmptyState } from '../components/Common/EmptyState';
import { LoadingState } from '../components/Common/LoadingState';
import { MissionCard } from '../components/Missions/MissionCard';
import { Mission, MissionSeverity, MissionStatus } from '../types';
import { useAuthStore } from '../store/authStore';
import { useMissionStore } from '../store/missionStore';
import { socketService } from '../services/socket';

export const MissionsPage: React.FC = () => {
  const { user } = useAuthStore();
  const {
    missions,
    stats,
    pagination,
    isLoading,
    error,
    filters,
    fetchMissions,
    fetchStats,
    setFilters,
    handleRealtimeMissionCreated,
    handleRealtimeMissionUpdate,
  } = useMissionStore();
  const [search, setSearch] = useState(filters.search || '');
  const isCommander = user?.role === 'COMMANDER';

  useEffect(() => {
    void fetchMissions();
    void fetchStats();
  }, [fetchMissions, fetchStats]);

  useEffect(() => {
    const unsubscribers = [
      socketService.subscribe('mission:created', (data) => handleRealtimeMissionCreated(data as Mission)),
      socketService.subscribe('mission:updated', (data) => handleRealtimeMissionUpdate(data as Mission)),
      socketService.subscribe('mission:started', (data) => handleRealtimeMissionUpdate(data as Mission)),
      socketService.subscribe('mission:completed', (data) => handleRealtimeMissionUpdate(data as Mission)),
      socketService.subscribe('mission:cancelled', (data) => handleRealtimeMissionUpdate(data as Mission)),
    ];

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [handleRealtimeMissionCreated, handleRealtimeMissionUpdate]);

  const apply = (next: { status?: MissionStatus; severity?: MissionSeverity; search?: string; page?: number }) => {
    const nextFilters = { ...next, page: next.page ?? 1 };
    setFilters(nextFilters);
    void fetchMissions(nextFilters);
  };

  const reset = () => {
    setSearch('');
    apply({ status: undefined, severity: undefined, search: undefined, page: 1 });
  };

  const handlePageChange = useCallback((page: number) => {
    apply({ page });
  }, [fetchMissions, setFilters]);

  const hasFilters = Boolean(filters.status || filters.severity || filters.search);
  const statusCards = [
    ['All missions', undefined, stats?.total],
    ['Active', 'ACTIVE' as MissionStatus, stats?.active],
    ['Draft', 'DRAFT' as MissionStatus, stats?.draft],
    ['Completed', 'COMPLETED' as MissionStatus, stats?.completed],
  ] as const;

  return (
    <div className="ops-page space-y-6">
      <header className="ops-page-header">
        <div>
          <div className="flex items-center gap-2 text-blackbox-cyan">
            <Compass className="h-4 w-4" />
            <span className="ops-kicker text-blackbox-cyan">Mission directory</span>
          </div>
          <h1 className="ops-page-title">Operational missions</h1>
          <p className="ops-page-subtitle">Monitor status, progress, and recency from one working list.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => { void fetchMissions(); void fetchStats(); }}
            disabled={isLoading}
            className="ops-button-quiet"
            aria-label="Refresh missions"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          {isCommander && (
            <Link to="/missions/new" className="ops-button-primary">
              <Plus className="h-4 w-4" />
              New mission
            </Link>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Mission status filters">
        {statusCards.map(([label, value, count]) => {
          const selected = filters.status === value || (!value && !filters.status);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={selected}
              onClick={() => apply({ status: value })}
              className={`ops-stat ${selected ? 'border-blackbox-cyan/70 bg-blackbox-cyan/10' : ''}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="ops-kicker">{label}</span>
                <span className="font-mono text-[10px] text-blackbox-muted">{selected ? 'SELECTED' : ''}</span>
              </div>
              <div className="mt-3 font-mono text-2xl font-semibold text-blackbox-text">{stats ? count : '—'}</div>
            </button>
          );
        })}
      </section>

      <section className="ops-toolbar">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            apply({ search: search.trim() || undefined });
          }}
          className="flex flex-col gap-3 lg:flex-row"
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search missions</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-blackbox-muted" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="ops-control w-full pl-10"
              placeholder="Search title or location"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-blackbox-border bg-blackbox-panel px-3">
              <Filter className="h-3.5 w-3.5 text-blackbox-muted" />
              <span className="sr-only">Status filter</span>
              <select
                value={filters.status || ''}
                onChange={(event) => apply({ status: (event.target.value as MissionStatus) || undefined })}
                className="bg-transparent text-xs text-blackbox-text outline-none"
              >
                <option value="">All statuses</option>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </label>
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-blackbox-border bg-blackbox-panel px-3">
              <SlidersHorizontal className="h-3.5 w-3.5 text-blackbox-muted" />
              <span className="sr-only">Severity filter</span>
              <select
                value={filters.severity || ''}
                onChange={(event) => apply({ severity: (event.target.value as MissionSeverity) || undefined })}
                className="bg-transparent text-xs text-blackbox-text outline-none"
              >
                <option value="">All severities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </label>
            {hasFilters && (
              <button type="button" onClick={reset} className="ops-button-quiet min-h-10 px-3">
                <X className="h-4 w-4" />
                Reset
              </button>
            )}
            <button type="submit" className="ops-button-primary min-h-10 px-4">
              <Search className="h-4 w-4" />
              Apply
            </button>
          </div>
        </form>
      </section>

      {isLoading && missions.length === 0 ? (
        <LoadingState message="Loading mission records…" subtext="Reading the mission repository" />
      ) : error ? (
        <ErrorState title="Mission directory unavailable" message={error} onRetry={() => void fetchMissions()} />
      ) : missions.length === 0 ? (
        <EmptyState
          icon={Compass}
          title={hasFilters ? 'No missions match those filters' : 'No missions available'}
          description={hasFilters ? 'Clear a filter or search again.' : isCommander ? 'Create the first mission to begin coordination.' : 'No mission has been assigned to this operator yet.'}
          action={hasFilters ? <button type="button" onClick={reset} className="ops-button-quiet">Reset filters</button> : isCommander ? <Link to="/missions/new" className="ops-button-primary"><Plus className="h-4 w-4" />Create mission</Link> : undefined}
        />
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[11px] text-blackbox-muted">{pagination?.total ?? missions.length} mission records</span>
            <span className="font-mono text-[11px] text-blackbox-muted">Sorted by most recent update</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-blackbox-border bg-blackbox-surface">
            <div className="hidden grid-cols-[minmax(0,1.9fr)_minmax(110px,0.85fr)_minmax(120px,1.05fr)_minmax(130px,1fr)_minmax(105px,0.8fr)_minmax(100px,0.8fr)] gap-4 border-b border-blackbox-border bg-blackbox-panel px-5 py-3 lg:grid">
              <span className="ops-kicker">Mission</span>
              <span className="ops-kicker">Status</span>
              <span className="ops-kicker">Location</span>
              <span className="ops-kicker">Task progress</span>
              <span className="ops-kicker">Severity</span>
              <span className="ops-kicker">Updated</span>
            </div>
            {missions.map((mission) => <MissionCard key={mission.id} mission={mission} />)}
          </div>
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-blackbox-border pt-4">
              <span className="font-mono text-[11px] text-blackbox-muted">Page {pagination.page} of {pagination.totalPages}</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => handlePageChange(pagination.page - 1)} disabled={pagination.page <= 1} className="ops-button-quiet min-h-9 px-3 text-xs">Previous</button>
                <button type="button" onClick={() => handlePageChange(pagination.page + 1)} disabled={pagination.page >= pagination.totalPages} className="ops-button-quiet min-h-9 px-3 text-xs">Next</button>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
