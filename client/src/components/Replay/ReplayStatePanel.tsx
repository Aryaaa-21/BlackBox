/**
 * Phase 8 — Mission Replay
 * ReplayStatePanel — displays the reconstructed operational state at the current replay position,
 * including active/completed/blocked tasks, deployed team, field observations, and active conflicts.
 */

import React, { useState } from 'react';
import {
  Layers,
  AlertTriangle,
  Radio,
} from 'lucide-react';
import { useReplayStore } from '../../store/replayStore';
import { MissionStatusBadge } from '../Missions/MissionStatusBadge';
import { ReplayTask, ReplayMember } from '../../types/replay';

interface ReplayStatePanelProps {
  onInspectTask: (task: ReplayTask) => void;
  onInspectMember?: (member: ReplayMember) => void;
}

export const ReplayStatePanel: React.FC<ReplayStatePanelProps> = ({ onInspectTask }) => {
  const { reconstructedState } = useReplayStore();
  const [activeTab, setActiveTab] = useState<'TASKS' | 'TEAM' | 'OBSERVATIONS' | 'CONFLICTS'>('TASKS');

  const {
    missionStatus,
    tasks,
    members,
    observations,
    conflicts,
    activeTaskCount,
    completedTaskCount,
    blockedTaskCount,
    pendingTaskCount,
    teamMemberCount,
    connectivity,
  } = reconstructedState;

  return (
    <div className="bg-blackbox-surface border border-blackbox-border rounded-xl p-5 shadow-sm space-y-5">
      {/* Header & Mission Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-blackbox-border">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-blackbox-text">
            Operational State at Selected Time
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blackbox-bg border border-blackbox-border text-xs font-mono">
            <Radio
              className={`w-3 h-3 ${connectivity === 'ONLINE' ? 'text-emerald-400' : 'text-amber-400'}`}
            />
            <span className={connectivity === 'ONLINE' ? 'text-emerald-400' : 'text-amber-400 font-bold'}>
              {connectivity}
            </span>
          </div>
          <MissionStatusBadge status={missionStatus} size="sm" />
        </div>
      </div>

      {/* State Metric Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
        <div className="p-2.5 rounded-lg bg-blackbox-bg border border-blackbox-border text-center">
          <div className="text-cyan-400 font-bold text-base">{activeTaskCount}</div>
          <div className="text-blackbox-muted text-[11px] mt-0.5">Active Tasks</div>
        </div>

        <div className="p-2.5 rounded-lg bg-blackbox-bg border border-blackbox-border text-center">
          <div className="text-emerald-400 font-bold text-base">{completedTaskCount}</div>
          <div className="text-blackbox-muted text-[11px] mt-0.5">Completed</div>
        </div>

        <div className="p-2.5 rounded-lg bg-blackbox-bg border border-blackbox-border text-center">
          <div className="text-rose-400 font-bold text-base">{blockedTaskCount}</div>
          <div className="text-blackbox-muted text-[11px] mt-0.5">Blocked</div>
        </div>

        <div className="p-2.5 rounded-lg bg-blackbox-bg border border-blackbox-border text-center">
          <div className="text-amber-400 font-bold text-base">{pendingTaskCount}</div>
          <div className="text-blackbox-muted text-[11px] mt-0.5">Pending</div>
        </div>

        <div className="p-2.5 rounded-lg bg-blackbox-bg border border-blackbox-border text-center col-span-2 sm:col-span-1">
          <div className="text-indigo-400 font-bold text-base">{teamMemberCount}</div>
          <div className="text-blackbox-muted text-[11px] mt-0.5">Team Units</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-blackbox-border pb-1">
        <button
          onClick={() => setActiveTab('TASKS')}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            activeTab === 'TASKS'
              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
              : 'text-blackbox-muted hover:text-blackbox-text'
          }`}
        >
          Tasks ({tasks.length})
        </button>

        <button
          onClick={() => setActiveTab('TEAM')}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            activeTab === 'TEAM'
              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
              : 'text-blackbox-muted hover:text-blackbox-text'
          }`}
        >
          Team ({members.length})
        </button>

        <button
          onClick={() => setActiveTab('OBSERVATIONS')}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            activeTab === 'OBSERVATIONS'
              ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
              : 'text-blackbox-muted hover:text-blackbox-text'
          }`}
        >
          Observations ({observations.length})
        </button>

        {conflicts.length > 0 && (
          <button
            onClick={() => setActiveTab('CONFLICTS')}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1 ${
              activeTab === 'CONFLICTS'
                ? 'bg-orange-500/20 text-orange-300 font-bold border border-orange-500/40'
                : 'text-orange-400/80 hover:text-orange-300'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            <span>Conflicts ({conflicts.length})</span>
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="min-h-[220px] max-h-[360px] overflow-y-auto space-y-2 pr-1">
        {/* TASKS TAB */}
        {activeTab === 'TASKS' && (
          <>
            {tasks.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-blackbox-muted">
                No tasks created prior to this point in time.
              </div>
            ) : (
              tasks.map((task) => {
                const statusColor =
                  task.status === 'COMPLETED'
                    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                    : task.status === 'ACTIVE'
                    ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
                    : task.status === 'BLOCKED'
                    ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                    : 'text-amber-400 border-amber-500/30 bg-amber-500/10';

                return (
                  <div
                    key={task.id}
                    onClick={() => onInspectTask(task)}
                    className="p-3 rounded-lg bg-blackbox-bg hover:bg-blackbox-panel border border-blackbox-border cursor-pointer transition-colors group space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-blackbox-text group-hover:text-cyan-400 transition-colors line-clamp-1">
                        {task.title}
                      </span>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${statusColor}`}>
                        {task.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-mono text-blackbox-muted">
                      <span>Assigned: {task.assignedTo?.name || 'Unassigned'}</span>
                      <span className="text-cyan-400/80 group-hover:text-cyan-300 underline text-[10px]">
                        Inspect History →
                      </span>
                    </div>

                    {task.blockedReason && task.status === 'BLOCKED' && (
                      <div className="text-[11px] font-mono text-rose-300 bg-rose-950/20 border border-rose-900/40 p-1.5 rounded">
                        Blocked Reason: {task.blockedReason}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </>
        )}

        {/* TEAM TAB */}
        {activeTab === 'TEAM' && (
          <>
            {members.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-blackbox-muted">
                No team members assigned prior to this point.
              </div>
            ) : (
              members.map((member) => (
                <div
                  key={member.id}
                  className="p-3 rounded-lg bg-blackbox-bg border border-blackbox-border flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400 font-mono text-xs font-bold">
                      {member.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-mono font-bold text-blackbox-text">
                        {member.name}
                      </div>
                      <div className="text-[10px] font-mono text-blackbox-muted">
                        Role: {member.role}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {member.checkedIn && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        Checked In
                      </span>
                    )}
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                        member.status === 'ACTIVE'
                          ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {member.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {/* OBSERVATIONS TAB */}
        {activeTab === 'OBSERVATIONS' && (
          <>
            {observations.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-blackbox-muted">
                No observations recorded up to this point.
              </div>
            ) : (
              observations.map((obs) => (
                <div
                  key={obs.id}
                  className="p-3 rounded-lg bg-blackbox-bg border border-blackbox-border space-y-1 font-mono text-xs"
                >
                  <div className="flex items-center justify-between text-blackbox-muted text-[11px]">
                    <span>Recorded by: {obs.recordedByName}</span>
                    <span>
                      {new Date(obs.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-blackbox-text">
                    {typeof obs.payload.notes === 'string'
                      ? obs.payload.notes
                      : typeof obs.payload.text === 'string'
                      ? obs.payload.text
                      : JSON.stringify(obs.payload)}
                  </p>
                </div>
              ))
            )}
          </>
        )}

        {/* CONFLICTS TAB */}
        {activeTab === 'CONFLICTS' && (
          <>
            {conflicts.map((c) => (
              <div
                key={c.id}
                className="p-3 rounded-lg bg-orange-950/20 border border-orange-900/40 space-y-2 font-mono text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-orange-300">
                    {c.taskTitle ? `Task: ${c.taskTitle}` : 'Divergence Event'}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/40">
                    Resolution: {c.resolution || 'OPEN'}
                  </span>
                </div>
                <div className="text-[11px] text-orange-200/80">
                  Detected at:{' '}
                  {new Date(c.detectedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
