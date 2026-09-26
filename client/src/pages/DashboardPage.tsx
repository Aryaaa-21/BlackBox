import React, { useState, useEffect } from 'react';
import {
  Activity,
  Server,
  Database,
  Radio,
  User,
  Shield,
  RefreshCw,
  Clock,
  Terminal,
  WifiOff,
  Wifi,
  RadioTower,
  Crosshair,
  Lock,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useConnectivityStore } from '../store/connectivityStore';
import { socketService } from '../services/socket';
import { api } from '../services/api';
import { missionApi } from '../services/missionApi';
import { taskApi } from '../services/taskApi';
import { ApiResponse, Mission, MissionStats, Task, TaskStats } from '../types';
import { MissionStatusBadge } from '../components/Missions/MissionStatusBadge';
import { MissionSeverityBadge } from '../components/Missions/MissionSeverityBadge';
import { TaskStatusBadge } from '../components/Tasks/TaskStatusBadge';
import { TaskPriorityBadge } from '../components/Tasks/TaskPriorityBadge';
import { Link } from 'react-router-dom';

interface RealtimeLog {
  id: string;
  time: string;
  event: string;
  payload: string;
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const {
    status,
    networkAvailable,
    serverReachable,
    realtimeConnected,
    latencyMs,
    systemHealth,
    checkServerHealth,
    setNetworkAvailable,
  } = useConnectivityStore();

  const [logs, setLogs] = useState<RealtimeLog[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [commanderActionStatus, setCommanderActionStatus] = useState<{
    loading: boolean;
    result: string | null;
    isError: boolean;
  }>({ loading: false, result: null, isError: false });

  // Real Mission & Task Data from MongoDB (Section 79)
  const [missionStats, setMissionStats] = useState<MissionStats | null>(null);
  const [recentMissions, setRecentMissions] = useState<Mission[]>([]);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [loadingMissions, setLoadingMissions] = useState(true);

  const isCommander = user?.role === 'COMMANDER';

  const loadOperationalData = async () => {
    try {
      setLoadingMissions(true);
      const [stats, res, tStats, assigned] = await Promise.all([
        missionApi.getMissionStats().catch(() => null),
        missionApi.getMissions({ limit: 5 }).catch(() => ({ missions: [] })),
        taskApi.getTaskStats().catch(() => null),
        !isCommander ? taskApi.getMyTasks().catch(() => []) : Promise.resolve([]),
      ]);
      if (stats) setMissionStats(stats);
      if (res && res.missions) setRecentMissions(res.missions);
      if (tStats) setTaskStats(tStats);
      if (assigned) setMyTasks(assigned);
    } finally {
      setLoadingMissions(false);
    }
  };

  useEffect(() => {
    loadOperationalData();
  }, [isCommander]);

  useEffect(() => {
    // Listen for socket events to display in live event terminal
    const addLog = (event: string, payload: unknown) => {
      const newEntry: RealtimeLog = {
        id: Math.random().toString(36).substring(7),
        time: new Date().toLocaleTimeString(),
        event,
        payload: typeof payload === 'object' ? JSON.stringify(payload) : String(payload),
      };
      setLogs((prev) => [newEntry, ...prev.slice(0, 19)]);
    };

    const unsubWelcome = socketService.subscribe('welcome', (data) => {
      addLog('system:welcome', data);
    });

    const unsubLatency = socketService.subscribe('latency', (data) => {
      addLog('server:pong', data);
    });

    const unsubConn = socketService.subscribe('connection_change', (data) => {
      addLog('socket:state', data);
    });

    return () => {
      unsubWelcome();
      unsubLatency();
      unsubConn();
    };
  }, []);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      checkServerHealth(),
      loadOperationalData(),
    ]);
    socketService.ping();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleSimulateToggleNetwork = () => {
    if (networkAvailable) {
      setNetworkAvailable(false);
      socketService.disconnect();
    } else {
      setNetworkAvailable(true);
      checkServerHealth();
      loadOperationalData();
      socketService.connect();
    }
  };

  // Test Commander-restricted endpoint on the backend
  const handleTestCommanderAction = async () => {
    setCommanderActionStatus({ loading: true, result: null, isError: false });
    try {
      const response = await api.post<ApiResponse<{ action: string; initiatedBy: string }>>(
        '/auth/commander-action'
      );
      setCommanderActionStatus({
        loading: false,
        result: `${response.data.message} (${response.data.data.action})`,
        isError: false,
      });
    } catch (err: unknown) {
      const error = err as { message?: string; code?: string };
      setCommanderActionStatus({
        loading: false,
        result: `${error.code || 'ERROR'}: ${error.message}`,
        isError: true,
      });
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-blackbox-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blackbox-cyan animate-pulse" />
            <span className="text-xs font-mono text-blackbox-cyan uppercase tracking-wider font-semibold">
              TACTICAL OPERATIONS // PHASE 3 MISSION MANAGEMENT
            </span>
          </div>
          <h2 className="text-2xl font-bold font-mono text-blackbox-text mt-1 flex items-center gap-3">
            <span>{isCommander ? 'Commander Operations Center' : 'Field Operator Tactical Console'}</span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded font-mono font-bold tracking-wider ${
                isCommander
                  ? 'bg-cyan-950/60 border border-cyan-800 text-blackbox-cyan'
                  : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
              }`}
            >
              {user?.role}
            </span>
          </h2>
          <p className="text-xs text-blackbox-muted mt-0.5">
            {isCommander
              ? 'Strategic command authority, mission dispatch oversight, and role-governed controls.'
              : 'Field-deployed tactical unit, task reception queue, and telemetry stream.'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleSimulateToggleNetwork}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center gap-1.5 transition-all ${
              networkAvailable
                ? 'border-rose-900/60 bg-rose-950/20 text-rose-300 hover:bg-rose-950/40'
                : 'border-emerald-900/60 bg-emerald-950/20 text-emerald-300 hover:bg-emerald-950/40'
            }`}
            title="Simulate offline or online state for validation testing"
          >
            {networkAvailable ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            <span>{networkAvailable ? 'Simulate Offline' : 'Restore Network'}</span>
          </button>

          <button
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-lg bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border text-xs font-mono text-blackbox-text flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Poll server health & send socket ping"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Telemetry Ping</span>
          </button>
        </div>
      </div>

      {/* Role-Specific Tactical Mission Overview Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isCommander
            ? 'bg-cyan-950/20 border-cyan-900/50'
            : 'bg-emerald-950/20 border-emerald-900/50'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
              isCommander
                ? 'bg-cyan-950/60 border border-cyan-800 text-blackbox-cyan'
                : 'bg-emerald-950/60 border border-emerald-800 text-emerald-300'
            }`}
          >
            {isCommander ? <RadioTower className="w-5 h-5" /> : <Crosshair className="w-5 h-5" />}
          </div>
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-blackbox-text">
              {isCommander ? 'COMMAND DIRECTIVE // LEVEL 1' : 'FIELD DEPLOYMENT // ACTIVE CALLSIGN'}
            </div>
            <p className="text-xs text-blackbox-muted mt-0.5">
              {isCommander
                ? 'Authorized to direct operational units, create missions, and broadcast tactical commands.'
                : 'Authorized to execute assigned field directives and stream status updates.'}
            </p>
          </div>
        </div>

        {/* Backend Role Security Verification Button */}
        <div className="flex flex-col sm:items-end gap-1.5">
          <button
            onClick={handleTestCommanderAction}
            disabled={commanderActionStatus.loading}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex items-center gap-2 border transition-all ${
              isCommander
                ? 'bg-blackbox-cyan hover:bg-cyan-300 text-black border-cyan-400'
                : 'bg-blackbox-surface hover:bg-blackbox-panel text-rose-300 border-rose-900/60'
            }`}
          >
            {isCommander ? <Radio className="w-3.5 h-3.5" /> : <Lock className="w-3.5 h-3.5" />}
            <span>
              {commanderActionStatus.loading
                ? 'Verifying with Backend...'
                : isCommander
                ? 'Execute Commander Action'
                : 'Attempt Commander Action (Verify 403)'}
            </span>
          </button>
          {commanderActionStatus.result && (
            <div
              className={`text-[11px] font-mono flex items-center gap-1.5 ${
                commanderActionStatus.isError ? 'text-blackbox-critical' : 'text-blackbox-success'
              }`}
            >
              {commanderActionStatus.isError ? (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span>{commanderActionStatus.result}</span>
            </div>
          )}
        </div>
      </div>

      {/* Real Mission Statistics from MongoDB (Section 37 & 67) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RadioTower className="w-4 h-4 text-blackbox-cyan" />
            <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-blackbox-text">
              Operational Missions Summary (MongoDB Live)
            </h3>
          </div>
          <Link
            to="/missions"
            className="text-xs font-mono text-blackbox-cyan hover:underline flex items-center gap-1"
          >
            <span>View All Missions</span>
            <span>&rarr;</span>
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Total Missions */}
          <Link
            to="/missions"
            className="p-4 rounded-xl bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border transition-all block group"
          >
            <div className="text-[11px] font-mono text-blackbox-muted uppercase mb-1">
              TOTAL MISSIONS
            </div>
            <div className="text-2xl font-bold font-mono text-blackbox-text group-hover:text-blackbox-cyan transition-colors">
              {loadingMissions ? '—' : missionStats?.total ?? 0}
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mt-1">Accessible in sector</div>
          </Link>

          {/* Active Missions */}
          <Link
            to="/missions"
            className="p-4 rounded-xl bg-cyan-950/20 hover:bg-cyan-950/40 border border-cyan-900/60 transition-all block group"
          >
            <div className="text-[11px] font-mono text-blackbox-cyan uppercase mb-1 flex items-center justify-between">
              <span>ACTIVE</span>
              <span className="w-2 h-2 rounded-full bg-blackbox-cyan animate-pulse" />
            </div>
            <div className="text-2xl font-bold font-mono text-blackbox-cyan">
              {loadingMissions ? '—' : missionStats?.active ?? 0}
            </div>
            <div className="text-[10px] font-mono text-cyan-400/80 mt-1">Live tactical directives</div>
          </Link>

          {/* Draft Missions */}
          <Link
            to="/missions"
            className="p-4 rounded-xl bg-blackbox-surface hover:bg-blackbox-panel border border-blackbox-border transition-all block group"
          >
            <div className="text-[11px] font-mono text-blackbox-muted uppercase mb-1">
              DRAFT
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-300">
              {loadingMissions ? '—' : missionStats?.draft ?? 0}
            </div>
            <div className="text-[10px] font-mono text-zinc-500 mt-1">Pre-operational planning</div>
          </Link>

          {/* Completed Missions */}
          <Link
            to="/missions"
            className="p-4 rounded-xl bg-emerald-950/20 hover:bg-emerald-950/40 border border-emerald-900/60 transition-all block group"
          >
            <div className="text-[11px] font-mono text-emerald-400 uppercase mb-1">
              COMPLETED
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {loadingMissions ? '—' : missionStats?.completed ?? 0}
            </div>
            <div className="text-[10px] font-mono text-emerald-500/80 mt-1">Mission objectives fulfilled</div>
          </Link>
        </div>
      </div>

      {/* Operational Task Performance & Distribution (Section 79) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-blackbox-cyan" />
            <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-blackbox-text">
              {isCommander ? 'Commander Task Oversight (MongoDB Live)' : 'Operator Task Clearance (MongoDB Live)'}
            </h3>
          </div>
          <span className="text-[10px] font-mono text-zinc-500 uppercase">
            {isCommander ? 'All Mission Scope' : 'Direct Call-Sign Allocation'}
          </span>
        </div>

        {isCommander ? (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* 1. Active Missions */}
            <div className="p-3.5 rounded-xl bg-blackbox-surface border border-cyan-900/40">
              <div className="text-[10px] font-mono text-cyan-400 uppercase mb-1">ACTIVE MISSIONS</div>
              <div className="text-xl font-bold font-mono text-cyan-300">
                {loadingMissions ? '—' : missionStats?.active ?? 0}
              </div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Underway</div>
            </div>

            {/* 2. My Missions */}
            <div className="p-3.5 rounded-xl bg-blackbox-surface border border-blackbox-border">
              <div className="text-[10px] font-mono text-blackbox-muted uppercase mb-1">MY MISSIONS</div>
              <div className="text-xl font-bold font-mono text-blackbox-text">
                {loadingMissions ? '—' : missionStats?.total ?? 0}
              </div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Created</div>
            </div>

            {/* 3. Total Tasks */}
            <div className="p-3.5 rounded-xl bg-blackbox-surface border border-blackbox-border">
              <div className="text-[10px] font-mono text-blackbox-muted uppercase mb-1">TOTAL TASKS</div>
              <div className="text-xl font-bold font-mono text-blackbox-text">
                {loadingMissions ? '—' : taskStats?.total ?? 0}
              </div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Defined</div>
            </div>

            {/* 4. Active Tasks */}
            <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/60">
              <div className="text-[10px] font-mono text-cyan-400 uppercase mb-1 flex items-center justify-between">
                <span>ACTIVE TASKS</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              </div>
              <div className="text-xl font-bold font-mono text-cyan-300">
                {loadingMissions ? '—' : taskStats?.active ?? 0}
              </div>
              <div className="text-[10px] font-mono text-cyan-500 mt-0.5">In Progress</div>
            </div>

            {/* 5. Blocked Tasks */}
            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/60">
              <div className="text-[10px] font-mono text-amber-400 uppercase mb-1">BLOCKED TASKS</div>
              <div className="text-xl font-bold font-mono text-amber-300">
                {loadingMissions ? '—' : taskStats?.blocked ?? 0}
              </div>
              <div className="text-[10px] font-mono text-amber-500 mt-0.5">Intervention Req.</div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {/* 1. Assigned Missions */}
            <div className="p-3.5 rounded-xl bg-blackbox-surface border border-blackbox-border">
              <div className="text-[10px] font-mono text-blackbox-muted uppercase mb-1">ASSIGNED MISSIONS</div>
              <div className="text-xl font-bold font-mono text-blackbox-text">
                {loadingMissions ? '—' : missionStats?.total ?? 0}
              </div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Active deployments</div>
            </div>

            {/* 2. My Tasks */}
            <div className="p-3.5 rounded-xl bg-blackbox-surface border border-blackbox-border">
              <div className="text-[10px] font-mono text-blackbox-muted uppercase mb-1">MY TASKS</div>
              <div className="text-xl font-bold font-mono text-blackbox-text">
                {loadingMissions ? '—' : taskStats?.total ?? 0}
              </div>
              <div className="text-[10px] font-mono text-zinc-500 mt-0.5">Delegated to me</div>
            </div>

            {/* 3. Active Tasks */}
            <div className="p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/60">
              <div className="text-[10px] font-mono text-cyan-400 uppercase mb-1 flex items-center justify-between">
                <span>ACTIVE TASKS</span>
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              </div>
              <div className="text-xl font-bold font-mono text-cyan-300">
                {loadingMissions ? '—' : taskStats?.active ?? 0}
              </div>
              <div className="text-[10px] font-mono text-cyan-500 mt-0.5">Currently running</div>
            </div>

            {/* 4. Blocked Tasks */}
            <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-800/60">
              <div className="text-[10px] font-mono text-amber-400 uppercase mb-1">BLOCKED TASKS</div>
              <div className="text-xl font-bold font-mono text-amber-300">
                {loadingMissions ? '—' : taskStats?.blocked ?? 0}
              </div>
              <div className="text-[10px] font-mono text-amber-500 mt-0.5">Impeded</div>
            </div>

            {/* 5. Completed Tasks */}
            <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/60">
              <div className="text-[10px] font-mono text-emerald-400 uppercase mb-1">COMPLETED TASKS</div>
              <div className="text-xl font-bold font-mono text-emerald-400">
                {loadingMissions ? '—' : taskStats?.completed ?? 0}
              </div>
              <div className="text-[10px] font-mono text-emerald-500 mt-0.5">Fulfilled</div>
            </div>
          </div>
        )}
      </div>

      {/* Field Operator: My Assigned Tasks Roster (Section 54) */}
      {!isCommander && myTasks.length > 0 && (
        <div className="p-5 rounded-xl bg-blackbox-surface border border-blackbox-border space-y-3">
          <div className="flex items-center justify-between pb-3 border-b border-blackbox-border">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-blackbox-text">
                Assigned Operational Directives ({myTasks.length})
              </h3>
            </div>
          </div>

          <div className="divide-y divide-blackbox-border/60">
            {myTasks.slice(0, 5).map((task) => {
              const missionId =
                typeof task.missionId === 'object' && task.missionId !== null
                  ? task.missionId.id
                  : task.missionId;
              const missionTitle =
                typeof task.missionId === 'object' && task.missionId !== null
                  ? task.missionId.title
                  : 'Mission';

              return (
                <div
                  key={task.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-blackbox-panel/30 px-2 rounded-lg transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <TaskPriorityBadge priority={task.priority} size="sm" />
                      <TaskStatusBadge status={task.status} size="sm" />
                      <span className="text-[10px] font-mono text-zinc-500 truncate">
                        // {missionTitle}
                      </span>
                    </div>
                    <div className="text-xs font-mono font-bold text-blackbox-text truncate">
                      {task.title}
                    </div>
                  </div>

                  <Link
                    to={`/missions/${missionId}`}
                    className="self-start sm:self-auto px-3 py-1.5 rounded bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border text-xs font-mono text-blackbox-cyan transition-colors"
                  >
                    OPEN MISSION &rarr;
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Real Missions Section (Section 38) */}
      <div className="p-5 rounded-xl bg-blackbox-surface border border-blackbox-border space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-blackbox-border">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-blackbox-cyan" />
            <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-blackbox-text">
              Recent Missions
            </h3>
          </div>
          {isCommander && (
            <Link
              to="/missions/new"
              className="text-xs font-mono text-blackbox-cyan hover:underline"
            >
              + Create New Mission
            </Link>
          )}
        </div>

        {recentMissions.length === 0 ? (
          <div className="text-center py-6 font-mono text-xs text-blackbox-muted">
            {isCommander
              ? 'No operational missions recorded in MongoDB yet. Create one to commence.'
              : 'No operational missions currently assigned to your callsign.'}
          </div>
        ) : (
          <div className="divide-y divide-blackbox-border/60">
            {recentMissions.map((m) => (
              <Link
                key={m.id}
                to={`/missions/${m.id}`}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-blackbox-panel/40 px-2 rounded-lg transition-colors group"
              >
                <div className="min-w-0">
                  <div className="text-sm font-mono font-bold text-blackbox-text group-hover:text-blackbox-cyan transition-colors truncate">
                    {m.title}
                  </div>
                  <div className="text-xs font-mono text-blackbox-muted flex items-center gap-2 mt-0.5">
                    <span>{m.location}</span>
                    <span>•</span>
                    <span>{new Date(m.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <MissionSeverityBadge severity={m.severity} size="sm" />
                  <MissionStatusBadge status={m.status} size="sm" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Primary Status Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Operational Status */}
        <div className="p-5 rounded-xl bg-blackbox-surface border border-blackbox-border relative overflow-hidden">
          <div className="flex items-center justify-between text-xs font-mono text-blackbox-muted mb-2">
            <span>OPERATIONAL STATUS</span>
            <Activity className="w-4 h-4 text-blackbox-cyan" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                status === 'ONLINE'
                  ? 'bg-blackbox-success shadow-[0_0_10px_#10B981]'
                  : status === 'RECONNECTING'
                  ? 'bg-blackbox-warning shadow-[0_0_10px_#F59E0B] animate-pulse'
                  : 'bg-blackbox-critical shadow-[0_0_10px_#EF4444]'
              }`}
            />
            <span
              className={
                status === 'ONLINE'
                  ? 'text-blackbox-success'
                  : status === 'RECONNECTING'
                  ? 'text-blackbox-warning'
                  : 'text-blackbox-critical'
              }
            >
              {status}
            </span>
          </div>
          <div className="mt-3 text-[11px] font-mono text-blackbox-muted flex items-center gap-2">
            <span>Network: {networkAvailable ? 'LINKED' : 'SEVERED'}</span>
          </div>
        </div>

        {/* 2. Backend Status */}
        <div className="p-5 rounded-xl bg-blackbox-surface border border-blackbox-border">
          <div className="flex items-center justify-between text-xs font-mono text-blackbox-muted mb-2">
            <span>BACKEND API</span>
            <Server className="w-4 h-4 text-blackbox-textSecondary" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                serverReachable ? 'bg-blackbox-success' : 'bg-blackbox-critical'
              }`}
            />
            <span className={serverReachable ? 'text-blackbox-text' : 'text-blackbox-critical'}>
              {serverReachable ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>
          <div className="mt-3 text-[11px] font-mono text-blackbox-muted flex items-center gap-2 truncate">
            <span>{systemHealth ? `v${systemHealth.version} • Express` : 'Port 5000'}</span>
          </div>
        </div>

        {/* 3. Database Status */}
        <div className="p-5 rounded-xl bg-blackbox-surface border border-blackbox-border">
          <div className="flex items-center justify-between text-xs font-mono text-blackbox-muted mb-2">
            <span>DATABASE</span>
            <Database className="w-4 h-4 text-blackbox-textSecondary" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                systemHealth?.database === 'connected' ? 'bg-blackbox-success' : 'bg-blackbox-critical'
              }`}
            />
            <span
              className={
                systemHealth?.database === 'connected' ? 'text-blackbox-text' : 'text-blackbox-critical'
              }
            >
              {systemHealth?.database ? systemHealth.database.toUpperCase() : 'STANDBY'}
            </span>
          </div>
          <div className="mt-3 text-[11px] font-mono text-blackbox-muted">
            <span>MongoDB / Mongoose</span>
          </div>
        </div>

        {/* 4. Realtime Status */}
        <div className="p-5 rounded-xl bg-blackbox-surface border border-blackbox-border">
          <div className="flex items-center justify-between text-xs font-mono text-blackbox-muted mb-2">
            <span>AUTHENTICATED STREAM</span>
            <Radio className="w-4 h-4 text-blackbox-cyan" />
          </div>
          <div className="text-2xl font-bold font-mono tracking-tight flex items-center gap-2">
            <span
              className={`w-3 h-3 rounded-full ${
                realtimeConnected ? 'bg-blackbox-cyan shadow-[0_0_8px_#00D2FF]' : 'bg-blackbox-muted'
              }`}
            />
            <span className={realtimeConnected ? 'text-blackbox-cyan' : 'text-blackbox-muted'}>
              {realtimeConnected ? 'AUTHENTICATED' : 'STANDBY'}
            </span>
          </div>
          <div className="mt-3 text-[11px] font-mono text-blackbox-muted flex items-center gap-2">
            <span>Socket.IO {latencyMs !== null ? `(${latencyMs}ms RTT)` : ''}</span>
          </div>
        </div>
      </div>

      {/* Operator Profile Area (Section 25) & Live Terminal */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Profile Card */}
        <div className="p-6 rounded-xl bg-blackbox-surface border border-blackbox-border">
          <div className="flex items-center justify-between pb-4 border-b border-blackbox-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-blackbox-panel border border-blackbox-cyan/40 flex items-center justify-center text-blackbox-cyan">
                <User className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-mono text-blackbox-muted uppercase tracking-wider">
                  VERIFIED OPERATOR
                </div>
                <div className="text-sm font-mono font-bold text-blackbox-text">
                  {user?.name || 'Operator'}
                </div>
              </div>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                isCommander
                  ? 'bg-cyan-950/40 border border-cyan-800 text-blackbox-cyan'
                  : 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
              }`}
            >
              {user?.role}
            </span>
          </div>

          <div className="mt-4 space-y-2.5 text-xs font-mono">
            <div className="flex justify-between items-center py-1 border-b border-blackbox-border/50">
              <span className="text-blackbox-muted">Email Identity:</span>
              <span className="text-blackbox-text">{user?.email}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-blackbox-border/50">
              <span className="text-blackbox-muted">Account Status:</span>
              <span className="text-blackbox-success flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blackbox-success" />
                <span>{user?.isActive !== false ? 'ACTIVE' : 'INACTIVE'}</span>
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-blackbox-border/50">
              <span className="text-blackbox-muted">Last Login:</span>
              <span className="text-blackbox-textSecondary">
                {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Current Session'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-blackbox-border/50">
              <span className="text-blackbox-muted">Security Clearance:</span>
              <span className="text-blackbox-cyan flex items-center gap-1">
                <Shield className="w-3 h-3" />
                <span>{user?.role}</span>
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-blackbox-muted">Operator ID:</span>
              <span className="text-blackbox-textSecondary font-mono text-[11px] truncate max-w-[150px]">
                {user?.id}
              </span>
            </div>
          </div>
        </div>

        {/* Realtime Stream Event Log Terminal */}
        <div className="lg:col-span-2 p-6 rounded-xl bg-blackbox-surface border border-blackbox-border flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-blackbox-border">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blackbox-cyan" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-blackbox-text">
                Real-Time Event Stream Log
              </h3>
            </div>
            <span className="text-[10px] font-mono text-blackbox-muted">
              Private User Room: user:{user?.id?.substring(0, 8)}...
            </span>
          </div>

          <div className="flex-1 mt-4 bg-blackbox-bg rounded-lg border border-blackbox-border p-3 font-mono text-xs overflow-y-auto max-h-56 space-y-2">
            {logs.length === 0 ? (
              <div className="text-blackbox-muted text-center py-6 text-xs">
                Awaiting real-time stream packets from server...
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2.5 text-[11px] leading-relaxed">
                  <span className="text-blackbox-muted shrink-0 flex items-center gap-1">
                    <Clock className="w-3 h-3 inline" />
                    {log.time}
                  </span>
                  <span className="text-blackbox-cyan font-semibold shrink-0">[{log.event}]</span>
                  <span className="text-blackbox-textSecondary break-all font-mono">{log.payload}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
