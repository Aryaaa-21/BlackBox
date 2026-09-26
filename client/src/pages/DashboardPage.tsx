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
import { ApiResponse } from '../types';

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

  const isCommander = user?.role === 'COMMANDER';

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
    await checkServerHealth();
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
              TACTICAL OPERATIONS // PHASE 2 IDENTITY
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
