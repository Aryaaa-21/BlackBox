import React, { useState, useEffect } from 'react';
import { Search, UserPlus, X, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
import { teamApi } from '../../services/teamApi';
import { User, MissionMember } from '../../types';

interface AddMemberDialogProps {
  isOpen: boolean;
  missionId: string;
  currentMembers: MissionMember[];
  onClose: () => void;
  onMemberAdded: (userId: string) => Promise<void>;
}

export const AddMemberDialog: React.FC<AddMemberDialogProps> = ({
  isOpen,
  currentMembers,
  onClose,
  onMemberAdded,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [candidates, setCandidates] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [submittingUserId, setSubmittingUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setSearchQuery('');
      setCandidates([]);
      setError(null);
      setSubmittingUserId(null);
      return;
    }

    const loadOperators = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const users = await teamApi.searchFieldOperators(searchQuery);
        setCandidates(users);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unable to query field operators.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(() => {
      loadOperators();
    }, 200);

    return () => clearTimeout(timer);
  }, [isOpen, searchQuery]);

  if (!isOpen) return null;

  // Filter out users who are already ACTIVE members
  const activeMemberUserIds = new Set(
    currentMembers
      .filter((m) => m.status === 'ACTIVE')
      .map((m) => m.userId.id)
  );

  const handleAdd = async (userId: string) => {
    setSubmittingUserId(userId);
    setError(null);
    try {
      await onMemberAdded(userId);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to add operator to mission.';
      setError(message);
    } finally {
      setSubmittingUserId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-member-dialog-title"
    >
      <div className="w-full max-w-lg bg-blackbox-surface border border-blackbox-border rounded-xl shadow-2xl p-6 relative animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-blackbox-muted hover:text-blackbox-text hover:bg-blackbox-panel transition-colors"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-cyan-950/60 border border-cyan-800 flex items-center justify-center text-blackbox-cyan">
            <UserPlus className="w-4 h-4" />
          </div>
          <div>
            <h3 id="add-member-dialog-title" className="text-base font-mono font-bold text-blackbox-text">
              ADD FIELD OPERATOR
            </h3>
            <p className="text-xs text-blackbox-textSecondary font-mono">
              Authorize field personnel for this mission operation
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/40 border border-rose-800 flex items-start gap-2.5 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Search input */}
        <div className="relative mb-4">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-blackbox-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, callsign, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-blackbox-panel border border-blackbox-border rounded-lg text-xs font-mono text-blackbox-text placeholder:text-blackbox-muted focus:outline-none focus:border-blackbox-cyan focus:ring-1 focus:ring-blackbox-cyan transition-colors"
            autoFocus
          />
        </div>

        {/* Results List */}
        <div className="max-h-64 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {isLoading ? (
            <div className="py-8 text-center text-xs font-mono text-blackbox-muted flex items-center justify-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              Scanning operational personnel directory...
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-8 text-center text-xs font-mono text-blackbox-muted">
              {searchQuery ? 'No field operators match query.' : 'No registered field operators available.'}
            </div>
          ) : (
            candidates.map((user) => {
              const isAlreadyMember = activeMemberUserIds.has(user.id);
              const isSubmitting = submittingUserId === user.id;

              return (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-blackbox-panel/70 border border-blackbox-border/80 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-mono font-bold text-zinc-300 shrink-0">
                      {user.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-medium text-blackbox-text truncate">
                        {user.name}
                      </div>
                      <div className="text-[11px] font-mono text-blackbox-muted truncate flex items-center gap-2">
                        <span>{user.email}</span>
                        <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400">
                          <Shield className="w-2.5 h-2.5" />
                          OPERATOR
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    {isAlreadyMember ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-800/60 px-2.5 py-1 rounded">
                        <CheckCircle2 className="w-3 h-3" />
                        ASSIGNED
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAdd(user.id)}
                        disabled={isSubmitting || submittingUserId !== null}
                        className="px-3 py-1.5 rounded bg-blackbox-cyan hover:bg-cyan-300 text-black text-xs font-mono font-bold border border-cyan-400 disabled:opacity-50 transition-all flex items-center gap-1.5"
                      >
                        {isSubmitting ? (
                          <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <UserPlus className="w-3.5 h-3.5" />
                        )}
                        <span>DEPLOY</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-5 pt-4 border-t border-blackbox-border/80 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border text-xs font-mono text-blackbox-text transition-colors"
          >
            DISMISS
          </button>
        </div>
      </div>
    </div>
  );
};
