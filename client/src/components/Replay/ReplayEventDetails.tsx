/**
 * Phase 8 — Mission Replay
 * ReplayEventDetails — inspects individual event metadata, actor profile,
 * target parameters, origin source, sync status, and raw payload.
 */

import React, { useState } from 'react';
import { Info, User, Tag, Clock, HardDrive, Key, Code, ChevronDown, ChevronRight } from 'lucide-react';
import { useReplayStore } from '../../store/replayStore';
import { formatReplayEvent } from '../../services/replay/eventFormatter';

export const ReplayEventDetails: React.FC = () => {
  const { currentEvent } = useReplayStore();
  const [showRawPayload, setShowRawPayload] = useState(false);

  if (!currentEvent) {
    return (
      <div className="p-6 rounded-xl bg-blackbox-surface border border-blackbox-border text-center text-xs font-mono text-blackbox-muted">
        Select an event from the timeline to inspect details.
      </div>
    );
  }

  const vm = formatReplayEvent(currentEvent);

  return (
    <div className="p-5 rounded-xl bg-blackbox-surface border border-blackbox-border shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-blackbox-border">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-blackbox-text">
            Event Telemetry Inspection
          </h3>
        </div>

        <span
          className={`px-2 py-0.5 rounded text-[11px] font-mono border font-semibold ${vm.badgeColor.bg} ${vm.badgeColor.text} ${vm.badgeColor.border}`}
        >
          {vm.eventType}
        </span>
      </div>

      {/* Main Title & Description */}
      <div className="space-y-1">
        <h4 className="text-sm font-mono font-bold text-cyan-300">{vm.title}</h4>
        <p className="text-xs font-mono text-blackbox-textSecondary">{vm.description}</p>
      </div>

      {/* Grid of Key Telemetry Attributes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
        {/* Actor */}
        <div className="p-2.5 rounded-lg bg-blackbox-bg border border-blackbox-border space-y-1">
          <div className="flex items-center gap-1.5 text-blackbox-muted text-[11px]">
            <User className="w-3.5 h-3.5 text-cyan-400" />
            <span>OPERATIONAL ACTOR</span>
          </div>
          <div className="text-blackbox-text font-bold">{vm.actorName}</div>
          {vm.actorRole && (
            <div className="text-[10px] text-cyan-400 font-semibold">{vm.actorRole}</div>
          )}
        </div>

        {/* Timestamp */}
        <div className="p-2.5 rounded-lg bg-blackbox-bg border border-blackbox-border space-y-1">
          <div className="flex items-center gap-1.5 text-blackbox-muted text-[11px]">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <span>RECORDED TIMESTAMP</span>
          </div>
          <div className="text-blackbox-text font-bold">{vm.formattedTime}</div>
          <div className="text-[10px] text-blackbox-muted truncate">{currentEvent.createdAt}</div>
        </div>

        {/* Source & Network Origin */}
        <div className="p-2.5 rounded-lg bg-blackbox-bg border border-blackbox-border space-y-1">
          <div className="flex items-center gap-1.5 text-blackbox-muted text-[11px]">
            <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
            <span>ORIGIN SOURCE</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                currentEvent.source === 'LOCAL'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {currentEvent.source}
            </span>
            <span className="text-[11px] text-blackbox-muted">
              {currentEvent.syncState === 'PENDING' ? 'Pending Sync' : 'Synced & Verified'}
            </span>
          </div>
        </div>

        {/* Target Entity */}
        <div className="p-2.5 rounded-lg bg-blackbox-bg border border-blackbox-border space-y-1">
          <div className="flex items-center gap-1.5 text-blackbox-muted text-[11px]">
            <Tag className="w-3.5 h-3.5 text-amber-400" />
            <span>TARGET ENTITY</span>
          </div>
          <div className="text-blackbox-text font-bold truncate">
            {vm.targetName || currentEvent.targetType || 'Mission System'}
          </div>
          <div className="text-[10px] text-blackbox-muted truncate">
            ID: {currentEvent.targetId || 'N/A'}
          </div>
        </div>
      </div>

      {/* Idempotency Key */}
      {currentEvent.idempotencyKey && (
        <div className="p-2 rounded-lg bg-blackbox-bg border border-blackbox-border text-[11px] font-mono flex items-center justify-between text-blackbox-muted">
          <span className="flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-cyan-400" />
            <span>Idempotency Key:</span>
          </span>
          <span className="text-blackbox-text font-bold truncate max-w-[200px]">
            {currentEvent.idempotencyKey}
          </span>
        </div>
      )}

      {/* Collapsible Raw Payload Inspector */}
      <div className="pt-2">
        <button
          onClick={() => setShowRawPayload(!showRawPayload)}
          className="flex items-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <Code className="w-3.5 h-3.5" />
          <span>{showRawPayload ? 'Hide Event Payload' : 'Inspect Raw Payload Data'}</span>
          {showRawPayload ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {showRawPayload && (
          <div className="mt-2 p-3 rounded-lg bg-blackbox-bg border border-blackbox-border overflow-x-auto text-[11px] font-mono text-zinc-300 max-h-[200px]">
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(currentEvent.payload || {}, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
