import React, { useEffect, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, Database, LockKeyhole, RefreshCw, Server, Terminal, UserRound, Wifi, WifiOff } from 'lucide-react';
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

interface RealtimeLog { id: string; time: string; event: string; payload: string; }

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
      setMissionStats(missions); setRecentMissions(recent.missions); setTaskStats(tasks); setMyTasks(assigned);
    } finally { setLoading(false); }
  };

  useEffect(() => { void loadData(); }, [isCommander]);
  useEffect(() => {
    const addLog = (event: string, payload: unknown) => setLogs((current) => [{ id: `${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString(), event, payload: typeof payload === 'object' ? JSON.stringify(payload) : String(payload) }, ...current].slice(0, 12));
    const subscriptions = [
      socketService.subscribe('welcome', (data) => addLog('welcome', data)),
      socketService.subscribe('latency', (data) => addLog('server.pong', data)),
      socketService.subscribe('connection_change', (data) => addLog('connection', data)),
    ];
    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, []);

  const refresh = async () => { setRefreshing(true); await Promise.all([connectivity.checkServerHealth(), loadData()]); socketService.ping(); setRefreshing(false); };
  const toggleNetwork = () => {
    if (connectivity.networkAvailable) { connectivity.setNetworkAvailable(false); socketService.disconnect(); }
    else { connectivity.setNetworkAvailable(true); void connectivity.checkServerHealth(); void loadData(); socketService.connect(); }
  };
  const commanderAction = async () => {
    try { const response = await api.post<ApiResponse<{ action: string }>>('/auth/commander-action'); setCommanderMessage(`${response.data.message} · ${response.data.data.action}`); }
    catch (error: unknown) { const result = error as { code?: string; message?: string }; setCommanderMessage(`${result.code || 'UNAVAILABLE'} · ${result.message || 'Action could not be completed.'}`); }
  };

  const metric = (label: string, value: number | undefined, detail: string, accent = false) => <div className={`ops-stat ${accent ? 'border-blackbox-cyan/60 bg-blackbox-cyan/10' : ''}`}><div className="ops-kicker">{label}</div><div className={`mt-3 font-mono text-3xl font-semibold ${accent ? 'text-blackbox-cobalt' : 'text-blackbox-text'}`}>{loading ? '—' : value ?? 0}</div><div className="mt-1 text-xs text-blackbox-muted">{detail}</div></div>;

  return (
    <div className="ops-page space-y-6">
      <header className="ops-page-header"><div><div className="flex items-center gap-2 text-blackbox-cyan"><Activity className="h-4 w-4" /><span className="ops-kicker text-blackbox-cyan">Operations overview</span></div><h1 className="ops-page-title">{isCommander ? 'Command center' : 'Field console'}</h1><p className="ops-page-subtitle">{isCommander ? 'Dispatch missions, monitor execution, and keep the operating picture current.' : 'Review assigned work, report progress, and stay ready for the next directive.'}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={toggleNetwork} className="ops-button-quiet">{connectivity.networkAvailable ? <WifiOff className="h-4 w-4" /> : <Wifi className="h-4 w-4" />}{connectivity.networkAvailable ? 'Simulate offline' : 'Restore network'}</button><button type="button" onClick={() => void refresh()} disabled={refreshing} className="ops-button-quiet"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</button></div></header>

      <section className="ops-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-blackbox-cyan/50 bg-blackbox-cyan/10 text-blackbox-cobalt"><Activity className="h-5 w-5" /></div><div><div className="font-display text-base font-semibold">{isCommander ? 'Commander access' : 'Field assignment access'}</div><p className="mt-1 text-sm text-blackbox-textSecondary">{isCommander ? 'You can create missions and direct roster activity.' : 'Your assigned tasks and observations are available from the mission workspace.'}</p></div></div><button type="button" onClick={() => void commanderAction()} className="ops-button-secondary shrink-0"><LockKeyhole className="h-4 w-4" />{isCommander ? 'Verify command action' : 'Test restricted action'}</button>{commanderMessage && <span className="font-mono text-[11px] text-blackbox-muted">{commanderMessage}</span>}</section>

      <section><div className="mb-3 flex items-center justify-between"><div><div className="ops-kicker">Mission picture</div><h2 className="mt-1 font-display text-lg font-semibold">Current workload</h2></div><Link to="/missions" className="inline-flex items-center gap-1 text-xs font-semibold text-blackbox-cobalt hover:underline">View missions <ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{metric('Total missions', missionStats?.total, 'Accessible mission records')}{metric('Active', missionStats?.active, 'Live directives', true)}{metric('Draft', missionStats?.draft, 'Awaiting start')}{metric('Completed', missionStats?.completed, 'Closed directives')}</div></section>

      <section className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <div className="ops-surface p-5"><div className="flex items-center justify-between border-b border-blackbox-border pb-4"><div><div className="ops-kicker">Recent missions</div><h2 className="mt-1 font-display text-lg font-semibold">Open an operational workspace</h2></div>{isCommander && <Link to="/missions/new" className="ops-button-primary min-h-9 px-3 text-xs">New mission</Link>}</div>{recentMissions.length === 0 ? <div className="py-12 text-center text-sm text-blackbox-muted">{loading ? 'Loading mission records…' : 'No missions available for this operator.'}</div> : <div className="divide-y divide-blackbox-border">{recentMissions.map((mission) => <Link key={mission.id} to={`/missions/${mission.id}`} className="group flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h3 className="truncate font-display text-base font-semibold group-hover:text-blackbox-cobalt">{mission.title}</h3><p className="mt-1 truncate text-xs text-blackbox-muted">{mission.location} · {new Date(mission.updatedAt).toLocaleDateString()}</p></div><div className="flex gap-2"><MissionSeverityBadge severity={mission.severity} size="sm" /><MissionStatusBadge status={mission.status} size="sm" /></div></Link>)}</div>}</div>
        <div className="ops-surface p-5"><div className="border-b border-blackbox-border pb-4"><div className="ops-kicker">Task load</div><h2 className="mt-1 font-display text-lg font-semibold">Execution status</h2></div><div className="mt-5 grid grid-cols-2 gap-3">{metric('Total tasks', taskStats?.total, 'Across accessible missions')}{metric('Active', taskStats?.active, 'Currently in progress', true)}{metric('Blocked', taskStats?.blocked, 'Needs attention')}{metric('Completed', taskStats?.completed, 'Marked complete')}</div>{!isCommander && myTasks.length > 0 && <div className="mt-5 border-t border-blackbox-border pt-4"><div className="ops-kicker mb-3">Assigned to you</div><div className="space-y-3">{myTasks.slice(0, 4).map((task) => { const missionId = typeof task.missionId === 'object' ? task.missionId.id : task.missionId; return <Link key={task.id} to={`/missions/${missionId}`} className="block rounded-lg border border-blackbox-border bg-blackbox-panel p-3 hover:border-blackbox-borderLight"><div className="flex items-center gap-2"><TaskPriorityBadge priority={task.priority} size="sm" /><TaskStatusBadge status={task.status} size="sm" /></div><div className="mt-2 truncate text-sm font-semibold">{task.title}</div></Link>; })}</div></div>}</div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]"><div className="ops-surface p-5"><div className="mb-4 flex items-center justify-between"><div className="ops-kicker">System state</div><Activity className="h-4 w-4 text-blackbox-cobalt" /></div><div className="space-y-3 text-sm"><div className="flex items-center justify-between"><span className="text-blackbox-muted">Network</span><span className="font-mono text-xs text-blackbox-text">{connectivity.status}</span></div><div className="flex items-center justify-between"><span className="text-blackbox-muted">API</span><span className="font-mono text-xs text-blackbox-text">{connectivity.serverReachable ? 'REACHABLE' : 'UNREACHABLE'}</span></div><div className="flex items-center justify-between"><span className="text-blackbox-muted">Database</span><span className="font-mono text-xs text-blackbox-text">{connectivity.systemHealth?.database?.toUpperCase() || 'STANDBY'}</span></div><div className="flex items-center justify-between"><span className="text-blackbox-muted">Realtime</span><span className="font-mono text-xs text-blackbox-text">{connectivity.realtimeConnected ? 'CONNECTED' : 'STANDBY'}</span></div></div><div className="mt-5 grid grid-cols-3 gap-2 border-t border-blackbox-border pt-4 text-center"><div><Server className="mx-auto h-4 w-4 text-blackbox-muted" /><span className="mt-2 block font-mono text-[10px] text-blackbox-muted">API</span></div><div><Database className="mx-auto h-4 w-4 text-blackbox-muted" /><span className="mt-2 block font-mono text-[10px] text-blackbox-muted">DATA</span></div><div><CheckCircle2 className="mx-auto h-4 w-4 text-blackbox-cobalt" /><span className="mt-2 block font-mono text-[10px] text-blackbox-muted">SESSION</span></div></div></div><div className="ops-surface p-5"><div className="flex items-center justify-between border-b border-blackbox-border pb-4"><div><div className="ops-kicker">Realtime stream</div><h2 className="mt-1 font-display text-lg font-semibold">Authenticated event log</h2></div><Terminal className="h-4 w-4 text-blackbox-cobalt" /></div><div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-blackbox-border bg-blackbox-bg p-3 font-mono text-[11px]">{logs.length === 0 ? <div className="py-8 text-center text-blackbox-muted">Awaiting Socket.IO events…</div> : logs.map((log) => <div key={log.id} className="flex gap-3 border-b border-blackbox-border/50 py-2 last:border-0"><span className="shrink-0 text-blackbox-muted">{log.time}</span><span className="shrink-0 text-blackbox-cobalt">{log.event}</span><span className="min-w-0 break-all text-blackbox-textSecondary">{log.payload}</span></div>)}</div></div></section>
      <div className="flex items-center gap-2 font-mono text-[10px] text-blackbox-muted"><UserRound className="h-3.5 w-3.5" />{user?.name} · {user?.role} · {connectivity.latencyMs !== null ? `${connectivity.latencyMs}ms RTT` : 'RTT pending'}</div>
    </div>
  );
};
