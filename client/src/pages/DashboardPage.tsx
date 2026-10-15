import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Database,
  LockKeyhole,
  RefreshCw,
  Server,
  Terminal,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useConnectivityStore } from '../store/connectivityStore';
import { socketService } from '../services/socket';
import { api } from '../services/api';
import { missionApi } from '../services/missionApi';
import { taskApi } from '../services/taskApi';
import { ApiResponse, Mission, MissionStats, Task, TaskStats } from '../types';
import { MissionSeverityBadge } from '../components/Missions/MissionSeverityBadge';
import { MissionStatusBadge } from '../components/Missions/MissionStatusBadge';
import { TaskPriorityBadge } from '../components/Tasks/TaskPriorityBadge';
import { TaskStatusBadge } from '../components/Tasks/TaskStatusBadge';

interface RealtimeLog {
  id: string;
  time: string;
  event: string;
  payload: string;
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuthStore();
  const connectivity = useConnectivityStore();
  const [missionStats, setMissionStats] = useState<MissionStats | null>(null);
  const [taskStats, setTaskStats] = useState<TaskStats | null>(null);
  const [recentMissions, setRecentMissions] = useState<Mission[]>([]);
  const [myTasks, setMyTasks] = useState<Task[]>([]);
  const [logs, setLogs] = useState<RealtimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commanderMessage, setCommanderMessage] = useState<string | null>(null);
  const isCommander = user?.role === 'COMMANDER';

  const loadData = async () => {
    setLoading(true);
    try {
      const [missions, recent, tasks, assigned] = await Promise.all([
        missionApi.getMissionStats().catch(() => null),
        missionApi.getMissions({ limit: 5 }).catch(() => ({ missions: [] as Mission[] })),
        taskApi.getTaskStats().catch(() => null),
        isCommander ? Promise.resolve([] as Task[]) : taskApi.getMyTasks().catch(() => [] as Task[]),
      ]);
      setMissionStats(missions);
      setRecentMissions(recent.missions);
      setTaskStats(tasks);
      setMyTasks(assigned);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [isCommander]);

  useEffect(() => {
    const addLog = (event: string, payload: unknown) =>
      setLogs((current) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          time: new Date().toLocaleTimeString(),
          event,
          payload: typeof payload === 'object' ? JSON.stringify(payload) : String(payload),
        },
        ...current,
      ].slice(0, 12));

    const subscriptions = [
      socketService.subscribe('welcome', (data) => addLog('welcome', data)),
      socketService.subscribe('latency', (data) => addLog('server.pong', data)),
      socketService.subscribe('connection_change', (data) => addLog('connection', data)),
    ];
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([connectivity.checkServerHealth(), loadData()]);
    socketService.ping();
    setRefreshing(false);
  };

  const toggleNetwork = () => {
    if (connectivity.networkAvailable) {
      connectivity.setNetworkAvailable(false);
      socketService.disconnect();
    } else {
      connectivity.setNetworkAvailable(true);
      void connectivity.checkServerHealth();
      void loadData();
      socketService.connect();
    }
  };

  const commanderAction = async () => {
    try {
      const response = await api.post<ApiResponse<{ action: string }>>('/auth/commander-action');
      setCommanderMessage(`${response.data.message} · ${response.data.data.action}`);
    } catch (error: unknown) {
      const result = error as { code?: string; message?: string };
      setCommanderMessage(`${result.code || 'UNAVAILABLE'} · ${result.message || 'Action could not be completed.'}`);
    }
  };

  const metric = (label: string, value: number | undefined, active = false) => (
    <div className={`ops-stat p-3 ${active ? 'border-blackbox-cobalt/60 bg-blackbox-cyan/10' : ''}`}>
      <div className="ops-kicker">{label}</div>
      <div className={`mt-2 font-mono text-2xl font-semibold ${active ? 'text-blackbox-cobalt' : 'text-blackbox-text'}`}>
        {loading ? '—' : value ?? 0}
      </div>
    </div>
  );

  const state = (value: string, good = false) => (
    <span className={`font-mono text-[10px] font-semibold ${good ? 'text-blackbox-cobalt' : 'text-blackbox-textSecondary'}`}>
      {value}
    </span>
  );

  return (
    <div className="ops-page space-y-4">
      <header className="ops-page-header mb-0 items-center pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blackbox-cyan/50 bg-blackbox-cyan/10 text-blackbox-cobalt">
            <Activity className="h-4 w-4" />
          </div>
          <div>
            <div className="ops-kicker text-blackbox-cyan">BlackBox / operations</div>
            <h1 className="ops-page-title mt-1 text-2xl">{isCommander ? 'Command center' : 'Field console'}</h1>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={toggleNetwork} className="ops-button-quiet min-h-9 px-3 text-xs">
            {connectivity.networkAvailable ? <WifiOff className="h-3.5 w-3.5" /> : <Wifi className="h-3.5 w-3.5" />}
            {connectivity.networkAvailable ? 'Offline' : 'Restore'}
          </button>
          <button type="button" onClick={() => void refresh()} disabled={refreshing} className="ops-button-quiet min-h-9 px-3 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      <section className="ops-surface grid gap-3 px-4 py-3 sm:grid-cols-[1.2fr_repeat(4,auto)] sm:items-center">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${connectivity.status === 'ONLINE' ? 'bg-blackbox-cobalt' : 'bg-blackbox-borderLight'}`} />
          <span className="font-mono text-xs font-semibold text-blackbox-text">{connectivity.status}</span>
          <span className="truncate text-xs text-blackbox-muted">{connectivity.serverReachable ? 'BlackBox services ready' : 'Awaiting service connection'}</span>
        </div>
        <div className="flex items-center gap-2 text-xs"><span className="text-blackbox-muted">API</span>{state(connectivity.serverReachable ? 'READY' : 'DOWN', connectivity.serverReachable)}</div>
        <div className="flex items-center gap-2 text-xs"><span className="text-blackbox-muted">DB</span>{state(connectivity.systemHealth?.database?.toUpperCase() || 'STANDBY', connectivity.systemHealth?.database === 'connected')}</div>
        <div className="flex items-center gap-2 text-xs"><span className="text-blackbox-muted">RT</span>{state(connectivity.realtimeConnected ? 'LIVE' : 'STANDBY', connectivity.realtimeConnected)}</div>
        <div className="font-mono text-[10px] text-blackbox-muted">{connectivity.latencyMs !== null ? `${connectivity.latencyMs}ms` : '—'}</div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {metric('Missions', missionStats?.total)}
        {metric('Active', missionStats?.active, true)}
        {metric('Tasks', taskStats?.total)}
        {metric('Blocked', taskStats?.blocked)}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="ops-surface min-w-0 p-4">
          <div className="flex items-center justify-between border-b border-blackbox-border pb-3">
            <div>
              <div className="ops-kicker">Mission picture</div>
              <h2 className="mt-1 font-display text-base font-semibold">Recent missions</h2>
            </div>
            <div className="flex items-center gap-3">
              {isCommander && <Link to="/missions/new" className="ops-button-primary min-h-8 px-3 text-[11px]">New mission</Link>}
              <Link to="/missions" aria-label="View all missions" className="text-blackbox-cobalt hover:text-blackbox-text"><ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
          {recentMissions.length === 0 ? (
            <div className="py-8 text-center text-xs text-blackbox-muted">{loading ? 'Loading…' : 'No missions available.'}</div>
          ) : (
            <div className="divide-y divide-blackbox-border">
              {recentMissions.map((mission) => (
                <Link key={mission.id} to={`/missions/${mission.id}`} className="group grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold group-hover:text-blackbox-cobalt">{mission.title}</h3>
                    <div className="mt-1 flex gap-2 truncate font-mono text-[10px] text-blackbox-muted">
                      <span>{mission.location}</span><span>·</span><span>{new Date(mission.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex gap-1.5"><MissionSeverityBadge severity={mission.severity} size="sm" /><MissionStatusBadge status={mission.status} size="sm" /></div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="ops-surface min-w-0 p-4">
          <div className="flex items-center justify-between border-b border-blackbox-border pb-3">
            <div><div className="ops-kicker">Task load</div><h2 className="mt-1 font-display text-base font-semibold">Execution</h2></div>
            <span className="font-mono text-[10px] text-blackbox-muted">{taskStats?.completed ?? 0} done</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {metric('Pending', taskStats?.pending)}
            {metric('Active', taskStats?.active, true)}
            {metric('Done', taskStats?.completed)}
          </div>
          {!isCommander && myTasks.length > 0 && (
            <div className="mt-4 border-t border-blackbox-border pt-3">
              <div className="mb-2 flex items-center justify-between"><div className="ops-kicker">Assigned to you</div><span className="font-mono text-[10px] text-blackbox-muted">{myTasks.length}</span></div>
              <div className="space-y-1.5">
                {myTasks.slice(0, 4).map((task) => {
                  const missionId = typeof task.missionId === 'object' ? task.missionId.id : task.missionId;
                  return (
                    <Link key={task.id} to={`/missions/${missionId}`} className="flex items-center gap-2 rounded-md border border-blackbox-border bg-blackbox-panel px-2.5 py-2 hover:border-blackbox-borderLight">
                      <div className="flex shrink-0 gap-1"><TaskPriorityBadge priority={task.priority} size="sm" /><TaskStatusBadge status={task.status} size="sm" /></div>
                      <span className="truncate text-xs font-semibold">{task.title}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <div className="ops-surface p-4">
          <div className="mb-3 flex items-center justify-between border-b border-blackbox-border pb-3"><div className="ops-kicker">System state</div><Activity className="h-4 w-4 text-blackbox-cobalt" /></div>
          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between"><span className="text-blackbox-muted">Network</span>{state(connectivity.status, connectivity.networkAvailable)}</div>
            <div className="flex justify-between"><span className="text-blackbox-muted">API</span>{state(connectivity.serverReachable ? 'REACHABLE' : 'UNREACHABLE', connectivity.serverReachable)}</div>
            <div className="flex justify-between"><span className="text-blackbox-muted">Database</span>{state(connectivity.systemHealth?.database?.toUpperCase() || 'STANDBY', connectivity.systemHealth?.database === 'connected')}</div>
            <div className="flex justify-between"><span className="text-blackbox-muted">Realtime</span>{state(connectivity.realtimeConnected ? 'CONNECTED' : 'STANDBY', connectivity.realtimeConnected)}</div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-blackbox-border pt-3 text-center">
            <div><Server className="mx-auto h-4 w-4 text-blackbox-muted" /><span className="mt-1 block font-mono text-[9px] text-blackbox-muted">API</span></div>
            <div><Database className="mx-auto h-4 w-4 text-blackbox-muted" /><span className="mt-1 block font-mono text-[9px] text-blackbox-muted">DATA</span></div>
            <div><CheckCircle2 className="mx-auto h-4 w-4 text-blackbox-cobalt" /><span className="mt-1 block font-mono text-[9px] text-blackbox-muted">SESSION</span></div>
          </div>
        </div>

        <div className="ops-surface min-w-0 p-4">
          <div className="flex items-center justify-between border-b border-blackbox-border pb-3">
            <div><div className="ops-kicker">Realtime stream</div><h2 className="mt-1 font-display text-base font-semibold">Recent activity</h2></div>
            <Terminal className="h-4 w-4 text-blackbox-cobalt" />
          </div>
          {logs.length === 0 ? (
            <div className="py-8 text-center text-xs text-blackbox-muted">Waiting for events…</div>
          ) : (
            <div className="custom-scrollbar max-h-44 overflow-y-auto divide-y divide-blackbox-border">
              {logs.map((log) => (
                <div key={log.id} className="grid grid-cols-[auto_auto_minmax(0,1fr)] gap-2 py-2 font-mono text-[10px]">
                  <span className="text-blackbox-faint">{log.time}</span><span className="font-semibold text-blackbox-cobalt">{log.event}</span><span className="truncate text-blackbox-muted">{log.payload}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="ops-surface flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2"><UserRound className="h-3.5 w-3.5 shrink-0 text-blackbox-muted" /><span className="truncate font-mono text-[10px] text-blackbox-muted">{user?.name} · {user?.role}</span><span className="font-mono text-[10px] text-blackbox-muted/70">{connectivity.lastCheckedAt ? `checked ${new Date(connectivity.lastCheckedAt).toLocaleTimeString()}` : 'check pending'}</span></div>
        <div className="flex flex-wrap items-center gap-2">
          {commanderMessage && <span className="font-mono text-[10px] text-blackbox-muted">{commanderMessage}</span>}
          <button type="button" onClick={() => void commanderAction()} className="ops-button-secondary min-h-8 px-3 text-[11px]"><LockKeyhole className="h-3.5 w-3.5" />{isCommander ? 'Verify command' : 'Restricted action'}</button>
        </div>
      </section>
    </div>
  );
};
