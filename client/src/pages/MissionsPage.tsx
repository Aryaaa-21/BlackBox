import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  RefreshCw,
  Compass,
  Radio,
  FileEdit,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useMissionStore } from '../store/missionStore';
import { MissionCard } from '../components/Missions/MissionCard';
import { LoadingState } from '../components/Common/LoadingState';
import { ErrorState } from '../components/Common/ErrorState';
import { EmptyState } from '../components/Common/EmptyState';
import { socketService } from '../services/socket';
import { Mission, MissionStatus, MissionSeverity } from '../types';

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

  const isCommander = user?.role === 'COMMANDER';
  const [searchInput, setSearchInput] = useState(filters.search || '');

  // Load missions & statistics on mount
  useEffect(() => {
    fetchMissions();
    fetchStats();
  }, [fetchMissions, fetchStats]);

  // Subscribe to real-time mission lifecycle events
  useEffect(() => {
    const unsubCreated = socketService.subscribe('mission:created', (data) => {
      handleRealtimeMissionCreated(data as Mission);
    });

    const unsubUpdated = socketService.subscribe('mission:updated', (data) => {
      handleRealtimeMissionUpdate(data as Mission);
    });

    const unsubStarted = socketService.subscribe('mission:started', (data) => {
      handleRealtimeMissionUpdate(data as Mission);
    });

    const unsubCompleted = socketService.subscribe('mission:completed', (data) => {
      handleRealtimeMissionUpdate(data as Mission);
    });

    const unsubCancelled = socketService.subscribe('mission:cancelled', (data) => {
      handleRealtimeMissionUpdate(data as Mission);
    });

    return () => {
      unsubCreated();
      unsubUpdated();
      unsubStarted();
      unsubCompleted();
      unsubCancelled();
    };
  }, [handleRealtimeMissionCreated, handleRealtimeMissionUpdate]);

  // Handle Search Submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters({ search: searchInput.trim() || undefined, page: 1 });
    fetchMissions({ search: searchInput.trim() || undefined, page: 1 });
  };

  const handleStatusFilter = (status?: MissionStatus) => {
    setFilters({ status, page: 1 });
    fetchMissions({ status, page: 1 });
  };

  const handleSeverityFilter = (severity?: MissionSeverity) => {
    setFilters({ severity, page: 1 });
    fetchMissions({ severity, page: 1 });
  };

  const handlePageChange = useCallback(
    (page: number) => {
      setFilters({ page });
      fetchMissions({ page });
    },
    [setFilters, fetchMissions]
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-blackbox-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blackbox-cyan animate-pulse" />
            <span className="text-xs font-mono text-blackbox-cyan uppercase tracking-wider font-semibold">
              TACTICAL DIRECTORY // MISSIONS
            </span>
          </div>
          <h2 className="text-2xl font-bold font-mono text-blackbox-text mt-1">
            Operational Workspace
          </h2>
          <p className="text-xs text-blackbox-muted mt-0.5">
            Mission coordination, tactical status tracking, and deployment lifecycle.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchMissions();
              fetchStats();
            }}
            disabled={isLoading}
            className="p-2 rounded-lg bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border text-blackbox-muted hover:text-blackbox-text transition-colors disabled:opacity-50"
            title="Refresh Missions"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {isCommander && (
            <Link
              to="/missions/new"
              className="px-3.5 py-2 rounded-lg bg-blackbox-cyan hover:bg-cyan-300 text-black font-mono font-semibold text-xs border border-cyan-400 transition-all flex items-center gap-2 shadow-[0_0_10px_rgba(0,210,255,0.2)]"
            >
              <Plus className="w-4 h-4" />
              <span>New Mission</span>
            </Link>
          )}
        </div>
      </div>

      {/* Real Statistics Quick-Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => handleStatusFilter(undefined)}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            !filters.status
              ? 'bg-blackbox-panel border-blackbox-cyan/60 shadow-[0_0_10px_rgba(0,210,255,0.1)]'
              : 'bg-blackbox-surface border-blackbox-border hover:bg-blackbox-panel/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-blackbox-muted mb-1">
            <span>TOTAL</span>
            <Compass className="w-3.5 h-3.5 text-blackbox-cyan" />
          </div>
          <div className="text-xl font-bold font-mono text-blackbox-text">
            {stats ? stats.total : '—'}
          </div>
        </button>

        <button
          onClick={() => handleStatusFilter('ACTIVE')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            filters.status === 'ACTIVE'
              ? 'bg-cyan-950/40 border-cyan-600 shadow-[0_0_10px_rgba(0,210,255,0.2)]'
              : 'bg-blackbox-surface border-blackbox-border hover:bg-blackbox-panel/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-blackbox-muted mb-1">
            <span className="text-blackbox-cyan">ACTIVE</span>
            <Radio className="w-3.5 h-3.5 text-blackbox-cyan animate-pulse" />
          </div>
          <div className="text-xl font-bold font-mono text-blackbox-cyan">
            {stats ? stats.active : '—'}
          </div>
        </button>

        <button
          onClick={() => handleStatusFilter('DRAFT')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            filters.status === 'DRAFT'
              ? 'bg-zinc-800/80 border-zinc-500 shadow-[0_0_10px_rgba(255,255,255,0.05)]'
              : 'bg-blackbox-surface border-blackbox-border hover:bg-blackbox-panel/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-blackbox-muted mb-1">
            <span>DRAFT</span>
            <FileEdit className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="text-xl font-bold font-mono text-zinc-300">
            {stats ? stats.draft : '—'}
          </div>
        </button>

        <button
          onClick={() => handleStatusFilter('COMPLETED')}
          className={`p-3.5 rounded-xl border text-left transition-all ${
            filters.status === 'COMPLETED'
              ? 'bg-emerald-950/40 border-emerald-600 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
              : 'bg-blackbox-surface border-blackbox-border hover:bg-blackbox-panel/60'
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-blackbox-muted mb-1">
            <span className="text-emerald-400">COMPLETED</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            {stats ? stats.completed : '—'}
          </div>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-blackbox-surface border border-blackbox-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <Search className="w-4 h-4 text-blackbox-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by title or location..."
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-blackbox-bg border border-blackbox-border text-xs font-mono text-blackbox-text placeholder:text-blackbox-muted focus:outline-none focus:border-blackbox-cyan focus:ring-1 focus:ring-blackbox-cyan"
          />
        </form>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Select */}
          <div className="flex items-center gap-1.5 bg-blackbox-bg px-2.5 py-1.5 rounded-lg border border-blackbox-border">
            <Filter className="w-3.5 h-3.5 text-blackbox-muted" />
            <select
              value={filters.status || ''}
              onChange={(e) =>
                handleStatusFilter((e.target.value as MissionStatus) || undefined)
              }
              className="bg-transparent text-xs font-mono text-blackbox-text focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-blackbox-surface text-blackbox-text">All Statuses</option>
              <option value="DRAFT" className="bg-blackbox-surface text-blackbox-text">Draft</option>
              <option value="ACTIVE" className="bg-blackbox-surface text-blackbox-text">Active</option>
              <option value="COMPLETED" className="bg-blackbox-surface text-blackbox-text">Completed</option>
              <option value="CANCELLED" className="bg-blackbox-surface text-blackbox-text">Cancelled</option>
            </select>
          </div>

          {/* Severity Select */}
          <div className="flex items-center gap-1.5 bg-blackbox-bg px-2.5 py-1.5 rounded-lg border border-blackbox-border">
            <select
              value={filters.severity || ''}
              onChange={(e) =>
                handleSeverityFilter((e.target.value as MissionSeverity) || undefined)
              }
              className="bg-transparent text-xs font-mono text-blackbox-text focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-blackbox-surface text-blackbox-text">All Severities</option>
              <option value="LOW" className="bg-blackbox-surface text-blackbox-text">Low</option>
              <option value="MEDIUM" className="bg-blackbox-surface text-blackbox-text">Medium</option>
              <option value="HIGH" className="bg-blackbox-surface text-blackbox-text">High</option>
              <option value="CRITICAL" className="bg-blackbox-surface text-blackbox-text">Critical</option>
            </select>
          </div>

          {/* Reset Filters */}
          {(filters.status || filters.severity || filters.search) && (
            <button
              onClick={() => {
                setSearchInput('');
                setFilters({ status: undefined, severity: undefined, search: undefined, page: 1 });
                fetchMissions({ status: undefined, severity: undefined, search: undefined, page: 1 });
              }}
              className="px-2.5 py-1.5 rounded-lg bg-blackbox-panel hover:bg-zinc-800 text-xs font-mono text-blackbox-muted hover:text-blackbox-text border border-blackbox-border flex items-center gap-1"
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Rendering: Loading, Error, Empty, or Cards */}
      {isLoading && missions.length === 0 ? (
        <LoadingState message="Loading operational missions..." subtext="Querying MongoDB mission repository" />
      ) : error ? (
        <ErrorState
          title="Unable to load missions"
          message={error}
          onRetry={() => fetchMissions()}
        />
      ) : missions.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="No missions available."
          description={
            isCommander
              ? 'No missions have been created yet. Establish your first operational mission to begin coordination.'
              : 'You have not been assigned to any missions yet.'
          }
          action={
            isCommander ? (
              <Link
                to="/missions/new"
                className="px-4 py-2 rounded-lg bg-blackbox-cyan hover:bg-cyan-300 text-black font-mono font-semibold text-xs border border-cyan-400 transition-all flex items-center gap-2 shadow-[0_0_10px_rgba(0,210,255,0.2)]"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Mission</span>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {missions.map((mission) => (
              <MissionCard key={mission.id} mission={mission} />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-blackbox-border text-xs font-mono text-blackbox-muted">
              <div>
                Showing page <span className="text-blackbox-text">{pagination.page}</span> of{' '}
                <span className="text-blackbox-text">{pagination.totalPages}</span> ({pagination.total} total missions)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1.5 rounded bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border text-blackbox-text disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1.5 rounded bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border text-blackbox-text disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
