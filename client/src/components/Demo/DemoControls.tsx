/**
 * Phase 9 — Product Polish & Hackathon Demo
 * DemoControls — floating tactical operations HUD for live demonstration and presentation.
 *
 * Provides:
 * - Environment Demo Mode badge
 * - Network simulation controls (LIVE, OFFLINE, DEGRADED)
 * - Controlled server-side conflict triggering
 * - Safe demo state reset with confirmation
 * - 1-click tactical demo logins (Commander Cole / Operator Arjun)
 * - Direct Replay navigation
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { demoApi, DemoInfoData } from '../../services/demoApi';
import { demoNetworkController, SimulatedNetworkMode } from '../../services/demoNetworkController';
import { useAuthStore } from '../../store/authStore';
import { useOfflineStore } from '../../offline/offlineStore';
import { useSyncStore } from '../../store/syncStore';

export const DemoControls: React.FC = () => {
  const navigate = useNavigate();
  const { user, login } = useAuthStore();
  const currentMissionId = useOfflineStore((s) => s.currentMissionId);
  const pendingCount = useOfflineStore((s) => s.pendingMutationCount);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const conflicts = useSyncStore((s) => s.conflicts);

  const [isOpen, setIsOpen] = useState(false);
  const [networkMode, setNetworkMode] = useState<SimulatedNetworkMode>('LIVE');
  const [demoInfo, setDemoInfo] = useState<DemoInfoData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Subscribe to network simulation mode changes
  useEffect(() => {
    const unsub = demoNetworkController.subscribe((mode) => {
      setNetworkMode(mode);
    });

    demoApi.getDemoInfo().then((info) => {
      setDemoInfo(info);
    });

    return unsub;
  }, []);

  // Clear notification notice after 4 seconds
  useEffect(() => {
    if (!statusNotice) return;
    const timer = setTimeout(() => setStatusNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [statusNotice]);

  const handleSimulateOffline = () => {
    demoNetworkController.simulateOffline();
    setStatusNotice('Simulated Network Loss: System operating in OFFLINE mode.');
  };

  const handleSimulateDegraded = () => {
    demoNetworkController.simulateDegraded();
    setStatusNotice('Simulated Degraded Network: Server unreachable.');
  };

  const handleRestoreNetwork = async () => {
    setIsLoading(true);
    try {
      await demoNetworkController.simulateOnline();
      setStatusNotice('Network Restored: Live synchronization initiated.');
    } catch {
      setStatusNotice('Network restored, but health ping failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerConflict = async () => {
    setIsLoading(true);
    try {
      const res = await demoApi.triggerConflict(currentMissionId || undefined);
      setStatusNotice(`Conflict armed on server: "${res.title}" is now BLOCKED on backend.`);
    } catch (err: unknown) {
      const e = err as Error;
      setStatusNotice(`Conflict trigger failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    setShowResetConfirm(false);
    setIsLoading(true);
    try {
      // 1. Clear local IndexedDB demo state
      const res = await demoApi.resetDemo();

      // 2. Restore network if previously simulated offline
      if (networkMode !== 'LIVE') {
        await demoNetworkController.simulateOnline();
      }

      // 3. Auto-login as commander if currently unauthenticated or using demo user
      if (res.primaryToken) {
        const commanderCreds = res.demoUsers.find((u) => u.role === 'COMMANDER');
        if (commanderCreds) {
          await login(commanderCreds.email, commanderCreds.password);
        }
      }

      setStatusNotice('Demo environment reset successfully to "Campus Emergency Operations".');

      // 4. Navigate directly to demo mission
      if (res.demoMission?.id) {
        navigate(`/missions/${res.demoMission.id}`);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setStatusNotice(`Demo reset failed: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (role: 'COMMANDER' | 'FIELD_OPERATOR') => {
    setIsLoading(true);
    try {
      const info = await demoApi.getDemoInfo();
      const targetUser = info.demoUsers.find((u) =>
        role === 'COMMANDER' ? u.role === 'COMMANDER' : u.name === 'Arjun Mehta'
      );

      if (!targetUser) {
        // If not seeded yet, reset demo first
        await handleConfirmReset();
        return;
      }

      // Use standard demo credentials with store login
      await login(targetUser.email, 'Password123!');
      setStatusNotice(`Switched operator to ${targetUser.name} (${targetUser.role})`);
      if (info.demoMissionId) {
        navigate(`/missions/${info.demoMissionId}`);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setStatusNotice(`Login error: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenReplay = () => {
    if (currentMissionId) {
      navigate(`/missions/${currentMissionId}/replay`);
    } else if (demoInfo?.demoMissionId) {
      navigate(`/missions/${demoInfo.demoMissionId}/replay`);
    } else {
      setStatusNotice('Select or reset demo mission first to view replay.');
    }
  };

  return (
    <>
      {/* Floating Tactical Trigger Tab */}
      <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2 select-none print:hidden">
        {/* Live Status Toast inside Demo scope */}
        {statusNotice && (
          <div
            role="status"
            aria-live="polite"
            className="bg-blackbox-dark/95 border border-cyan-500/40 text-cyan-300 text-xs px-3 py-2 rounded-lg shadow-xl backdrop-blur-md max-w-sm animate-fade-in flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping shrink-0" />
            <span>{statusNotice}</span>
          </div>
        )}

        {/* Collapsible Demo HUD Trigger */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="Toggle Hackathon Demo Controls"
          className="flex items-center gap-2 bg-blackbox-surface/90 hover:bg-blackbox-surface border border-slate-700/80 hover:border-cyan-500/60 text-slate-200 text-xs px-3.5 py-2 rounded-xl shadow-2xl backdrop-blur-md transition-all duration-200 group focus:outline-none focus:ring-2 focus:ring-cyan-500"
        >
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                networkMode === 'LIVE'
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                  : networkMode === 'OFFLINE'
                  ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
                  : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]'
              }`}
            />
            <span className="font-mono font-bold tracking-wider text-[11px] text-cyan-400">DEMO HUD</span>
          </span>
          <span className="text-slate-500 text-[10px] uppercase font-mono">
            [{networkMode}]
          </span>
          {pendingCount > 0 && (
            <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-1.5 py-0.5 rounded font-mono">
              {pendingCount} Q
            </span>
          )}
          {conflicts.length > 0 && (
            <span className="bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] px-1.5 py-0.5 rounded font-mono animate-pulse">
              {conflicts.length} C
            </span>
          )}
          <span className="text-slate-400 group-hover:text-cyan-400 text-xs transition-transform duration-200">
            {isOpen ? '▼' : '▲'}
          </span>
        </button>

        {/* Expanded Demo Controls Panel */}
        {isOpen && (
          <div
            role="region"
            aria-label="Demo Mode Control Panel"
            className="w-80 bg-blackbox-card/95 border border-slate-700/90 rounded-2xl p-4 shadow-2xl backdrop-blur-xl animate-scale-up space-y-4 text-xs font-sans text-slate-300"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 text-[10px] font-mono px-2 py-0.5 rounded font-semibold uppercase tracking-wider">
                  Phase 9 Demo Mode
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Real Engine</span>
            </div>

            {/* Network Simulation Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-400">
                <span>NETWORK SIMULATION</span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.2 rounded font-bold ${
                    networkMode === 'LIVE'
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : networkMode === 'OFFLINE'
                      ? 'text-rose-400 bg-rose-500/10'
                      : 'text-amber-400 bg-amber-500/10'
                  }`}
                >
                  {networkMode}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {networkMode === 'OFFLINE' ? (
                  <button
                    onClick={handleRestoreNetwork}
                    disabled={isLoading}
                    className="col-span-2 py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 focus:ring-1 focus:ring-emerald-400"
                  >
                    <span>⚡</span> Restore Network (Sync)
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSimulateOffline}
                      disabled={isLoading}
                      className="py-2 px-2.5 bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-300 rounded-xl font-medium transition-all flex items-center justify-center gap-1 focus:ring-1 focus:ring-rose-400"
                    >
                      <span>✕</span> Simulate Offline
                    </button>
                    <button
                      onClick={handleSimulateDegraded}
                      disabled={isLoading || networkMode === 'DEGRADED'}
                      className="py-2 px-2.5 bg-amber-600/15 hover:bg-amber-600/25 border border-amber-500/30 text-amber-300 rounded-xl font-medium transition-all flex items-center justify-center gap-1 focus:ring-1 focus:ring-amber-400"
                    >
                      <span>~</span> Degraded
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Tactical Scenario Actions */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3">
              <span className="text-[11px] font-medium text-slate-400 block">SCENARIO CONTROLS</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleTriggerConflict}
                  disabled={isLoading}
                  title="Simulates an upstream server change to demonstrate BlackBox explicit conflict UI"
                  className="py-2 px-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 rounded-xl font-medium transition-all text-center focus:ring-1 focus:ring-cyan-400"
                >
                  ⚡ Trigger Conflict
                </button>
                <button
                  onClick={handleOpenReplay}
                  className="py-2 px-2 bg-cyan-950/40 hover:bg-cyan-900/40 border border-cyan-500/30 text-cyan-300 rounded-xl font-medium transition-all text-center focus:ring-1 focus:ring-cyan-400"
                >
                  ▶ Open Replay
                </button>
              </div>
            </div>

            {/* Quick Operator Switcher (One-Click Presenter Convenience) */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>OPERATOR SWITCH</span>
                <span className="font-mono text-[10px] text-slate-500 truncate max-w-[120px]">
                  {user ? user.name.split(' ')[0] : 'Guest'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleQuickLogin('COMMANDER')}
                  disabled={isLoading}
                  className="py-1.5 px-2 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 rounded-lg text-slate-300 hover:text-white transition-all text-[11px] text-center"
                >
                  Commander Cole
                </button>
                <button
                  onClick={() => handleQuickLogin('FIELD_OPERATOR')}
                  disabled={isLoading}
                  className="py-1.5 px-2 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700/60 rounded-lg text-slate-300 hover:text-white transition-all text-[11px] text-center"
                >
                  Operator Arjun
                </button>
              </div>
            </div>

            {/* Telemetry Snapshot */}
            <div className="bg-blackbox-dark/80 rounded-xl p-2.5 border border-slate-800 font-mono text-[10px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Pending Mutations:</span>
                <span className={pendingCount > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                  {pendingCount}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Conflicts Detected:</span>
                <span className={conflicts.length > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}>
                  {conflicts.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sync Status:</span>
                <span className={isSyncing ? 'text-cyan-400 animate-pulse' : 'text-slate-400'}>
                  {isSyncing ? 'SYNCING...' : 'IDLE'}
                </span>
              </div>
            </div>

            {/* Reset Demo State Button */}
            <div className="border-t border-slate-800/80 pt-3">
              <button
                onClick={() => setShowResetConfirm(true)}
                disabled={isLoading}
                className="w-full py-2 px-3 bg-rose-950/20 hover:bg-rose-950/40 border border-rose-900/50 hover:border-rose-700/60 text-rose-300 rounded-xl font-medium transition-all flex items-center justify-center gap-1.5 text-xs focus:ring-1 focus:ring-rose-500"
              >
                <span>↺</span> Reset Demo Environment
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Reset Demo */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-blackbox-card border border-rose-500/40 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 text-lg">
                ⚠️
              </div>
              <div>
                <h3 className="text-white font-bold text-base">Reset Demo Environment?</h3>
                <p className="text-slate-400 text-xs">Restore initial hackathon baseline</p>
              </div>
            </div>

            <p className="text-slate-300 text-xs leading-relaxed">
              This will safely clear only demo mission records and re-seed the default{' '}
              <strong className="text-white">Campus Emergency Operations</strong> scenario with 5 tasks,
              4 demo operatives, and standard event history.
            </p>

            <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-400 space-y-1">
              <div>✓ Real user data is protected & never touched</div>
              <div>✓ IndexedDB mutation queue & conflicts will reset</div>
              <div>✓ Returns to Commander Cole active session</div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-lg shadow-rose-900/30 transition-all flex items-center gap-1.5"
              >
                {isLoading ? 'Resetting...' : 'Confirm Demo Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
