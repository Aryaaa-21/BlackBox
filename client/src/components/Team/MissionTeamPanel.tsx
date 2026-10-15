import React, { useState } from 'react';
import { Shield, UserPlus, UserX, AlertCircle, CheckCircle2 } from 'lucide-react';
import { MissionMember, UserRole } from '../../types';
import { AddMemberDialog } from './AddMemberDialog';
import { ConfirmDialog } from '../Common/ConfirmDialog';

interface MissionTeamPanelProps {
  missionId: string;
  members: MissionMember[];
  isCommander: boolean;
  currentUserRole?: UserRole;
  onAddMember: (userId: string) => Promise<void>;
  onRemoveMember: (userId: string) => Promise<void>;
  isLoading?: boolean;
}

export const MissionTeamPanel: React.FC<MissionTeamPanelProps> = ({
  missionId,
  members,
  isCommander,
  onAddMember,
  onRemoveMember,
  isLoading = false,
}) => {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<MissionMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeMembers = members.filter((m) => m.status === 'ACTIVE');
  const commanderMembers = activeMembers.filter((m) => m.role === 'COMMANDER');
  const fieldOperators = activeMembers.filter((m) => m.role === 'FIELD_OPERATOR');

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    setIsRemoving(true);
    setError(null);
    try {
      await onRemoveMember(memberToRemove.userId.id);
      setMemberToRemove(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to remove operator.';
      setError(message);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="bg-blackbox-surface border border-blackbox-border rounded-xl p-5 shadow-lg">
      <div className="flex items-center justify-between pb-4 border-b border-blackbox-border/80">
        <div>
          <h2 className="text-sm font-mono font-bold text-blackbox-text uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-4 h-4 text-blackbox-cyan" />
            TEAM ({activeMembers.length})
          </h2>
        </div>

        {isCommander && (
          <button
            onClick={() => setIsAddDialogOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border hover:border-blackbox-cyan text-xs font-mono text-blackbox-cyan transition-all flex items-center gap-1.5 focus:outline-none focus:ring-1 focus:ring-blackbox-cyan"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>ADD OPERATOR</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800 flex items-start gap-2.5 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {isLoading ? (
        <div className="py-8 text-center text-xs font-mono text-blackbox-muted flex items-center justify-center gap-2">
          <span className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          Loading team…
        </div>
      ) : (
        <div className="mt-4 space-y-5">
          {/* Commander section */}
          <div>
            <div className="text-[11px] font-mono font-bold text-blackbox-muted uppercase tracking-wider mb-2.5">
              PRIMARY COMMANDER
            </div>
            {commanderMembers.length === 0 ? (
              <div className="text-xs font-mono text-zinc-500 italic p-3 rounded bg-blackbox-panel/40 border border-blackbox-border/50">
                NO COMMANDER
              </div>
            ) : (
              <div className="space-y-2">
                {commanderMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-blackbox-panel/80 border border-blackbox-border"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-cyan-950/80 border border-cyan-700 text-blackbox-cyan flex items-center justify-center font-mono font-bold text-xs shrink-0">
                        {member.userId.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-semibold text-blackbox-text truncate">
                          {member.userId.name}
                        </div>
                        <div className="text-[11px] font-mono text-blackbox-muted truncate">
                          {member.userId.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono font-bold text-blackbox-cyan bg-cyan-950/60 border border-cyan-800/80 px-2 py-0.5 rounded tracking-wide">
                        COMMANDER
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        ACTIVE
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Field Operators section */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div className="text-[11px] font-mono font-bold text-blackbox-muted uppercase tracking-wider">
                FIELD OPERATORS ({fieldOperators.length})
              </div>
            </div>

            {fieldOperators.length === 0 ? (
              <div className="text-xs font-mono text-blackbox-muted text-center py-6 px-4 rounded-lg bg-blackbox-panel/40 border border-dashed border-blackbox-border">
                NO FIELD OPERATORS
              </div>
            ) : (
              <div className="space-y-2">
                {fieldOperators.map((operator) => (
                  <div
                    key={operator.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-blackbox-panel/60 border border-blackbox-border hover:border-zinc-700 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center font-mono font-bold text-xs shrink-0">
                        {operator.userId.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-mono font-medium text-blackbox-text truncate">
                          {operator.userId.name}
                        </div>
                        <div className="text-[11px] font-mono text-blackbox-muted truncate">
                          {operator.userId.email}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-700 px-2 py-0.5 rounded">
                        FIELD OPERATOR
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded">
                        ACTIVE
                      </span>

                      {isCommander && (
                        <button
                          onClick={() => setMemberToRemove(operator)}
                          className="p-1 rounded text-zinc-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900 transition-colors"
                          title="Remove operator from mission"
                          aria-label={`Remove ${operator.userId.name}`}
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Member Dialog */}
      <AddMemberDialog
        isOpen={isAddDialogOpen}
        missionId={missionId}
        currentMembers={members}
        onClose={() => setIsAddDialogOpen(false)}
        onMemberAdded={onAddMember}
      />

      {/* Remove Confirmation Dialog */}
      <ConfirmDialog
        isOpen={memberToRemove !== null}
        title="REMOVE OPERATOR FROM MISSION"
        message={`Are you sure you want to remove ${memberToRemove?.userId.name} from this mission? The operator will lose operational access. Existing task assignment records will be retained.`}
        confirmLabel="REMOVE OPERATOR"
        cancelLabel="CANCEL"
        variant="danger"
        isLoading={isRemoving}
        onConfirm={handleConfirmRemove}
        onCancel={() => setMemberToRemove(null)}
      />
    </div>
  );
};
