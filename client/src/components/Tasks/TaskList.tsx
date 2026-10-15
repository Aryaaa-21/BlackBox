import React, { useState, useMemo } from 'react';
import {
  ListTodo,
  PlusCircle,
  Filter,
  CheckCircle2,
  Play,
  Clock,
  AlertOctagon,
  Search,
} from 'lucide-react';
import {
  Task,
  TaskStatus,
  TaskPriority,
  MissionMember,
  UserRole,
  CreateTaskPayload,
  TaskStats,
} from '../../types';
import { TaskCard } from './TaskCard';
import { CreateTaskDialog } from './CreateTaskDialog';
import { AssignTaskModal } from './AssignTaskModal';
import { TaskEditDialog } from './TaskEditDialog';
import { UpdateTaskPayload } from '../../types';

interface TaskListProps {
  missionId: string;
  tasks: Task[];
  stats: TaskStats | null;
  members: MissionMember[];
  isCommander: boolean;
  currentUserId: string;
  currentUserRole?: UserRole;
  missionOperational: boolean;
  isLoading?: boolean;
  isOffline?: boolean;
  onCreateTask: (payload: CreateTaskPayload) => Promise<void>;
  onAssignTask: (taskId: string, userId: string) => Promise<void>;
  onUnassignTask: (taskId: string) => Promise<void>;
  onStatusChange: (taskId: string, status: TaskStatus) => Promise<void>;
  onUpdateTask: (taskId: string, payload: UpdateTaskPayload) => Promise<void>;
}

export const TaskList: React.FC<TaskListProps> = ({
  missionId,
  tasks,
  stats,
  members,
  isCommander,
  currentUserId,
  currentUserRole,
  missionOperational,
  isLoading = false,
  isOffline = false,
  onCreateTask,
  onAssignTask,
  onUnassignTask,
  onStatusChange,
  onUpdateTask,
}) => {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTaskForAssign, setSelectedTaskForAssign] = useState<Task | null>(null);
  const [selectedTaskForEdit, setSelectedTaskForEdit] = useState<Task | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyMyTasks, setOnlyMyTasks] = useState(false);

  // Calculate live stats from tasks array if stats prop not supplied
  const taskStats = useMemo(() => {
    if (stats) return stats;
    return {
      total: tasks.length,
      pending: tasks.filter((t) => t.status === 'PENDING').length,
      active: tasks.filter((t) => t.status === 'ACTIVE').length,
      blocked: tasks.filter((t) => t.status === 'BLOCKED').length,
      completed: tasks.filter((t) => t.status === 'COMPLETED').length,
    };
  }, [tasks, stats]);

  // Section 81: Calculated progress percentage
  const progressPercent = useMemo(() => {
    if (taskStats.total === 0) return 0;
    return Math.round((taskStats.completed / taskStats.total) * 100);
  }, [taskStats]);

  // Section 58: Sorting rule: CRITICAL -> HIGH -> MEDIUM -> LOW, ACTIVE before PENDING
  const priorityWeight: Record<TaskPriority, number> = {
    CRITICAL: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  const statusWeight: Record<TaskStatus, number> = {
    ACTIVE: 4,
    BLOCKED: 3,
    PENDING: 2,
    COMPLETED: 1,
  };

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (statusFilter !== 'ALL' && task.status !== statusFilter) return false;
        if (priorityFilter !== 'ALL' && task.priority !== priorityFilter) return false;
        if (onlyMyTasks && task.assignedTo?.id !== currentUserId) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = task.title.toLowerCase().includes(q);
          const matchDesc = task.description?.toLowerCase().includes(q) || false;
          const matchAssignee = task.assignedTo?.name.toLowerCase().includes(q) || false;
          if (!matchTitle && !matchDesc && !matchAssignee) return false;
        }
        return true;
      })
      .sort((a, b) => {
        // Priority descending
        const pDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (pDiff !== 0) return pDiff;
        // Status order (Active before Pending)
        const sDiff = statusWeight[b.status] - statusWeight[a.status];
        if (sDiff !== 0) return sDiff;
        // Newest created first
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [tasks, statusFilter, priorityFilter, onlyMyTasks, searchQuery, currentUserId]);

  return (
    <div className="bg-blackbox-surface border border-blackbox-border rounded-xl p-5 shadow-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-blackbox-border/80">
        <div>
          <h2 className="text-sm font-mono font-bold text-blackbox-text uppercase tracking-wider flex items-center gap-2">
            <ListTodo className="w-4 h-4 text-blackbox-cyan" />
            OPERATIONAL TASKS ({taskStats.total})
            {isOffline && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-amber-700/40 bg-amber-950/20 text-amber-400">
                OFFLINE
              </span>
            )}
          </h2>
          <p className="text-[11px] font-mono text-blackbox-textSecondary mt-0.5">
            Mission objectives, tactical status, and direct field delegation
          </p>
        </div>

        {isCommander && missionOperational && (
          <button
            onClick={() => setIsCreateDialogOpen(true)}
            className="ops-button-primary px-3.5 py-1.5 text-xs self-start sm:self-auto"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>CREATE TASK</span>
          </button>
        )}
      </div>

      {/* Operational Progress Bar (Section 81) */}
      <div className="mt-4 p-4 rounded-lg bg-blackbox-panel/70 border border-blackbox-border">
        <div className="flex items-center justify-between text-xs font-mono mb-2">
          <span className="text-blackbox-muted font-semibold tracking-wider">
            MISSION TASK PROGRESS
          </span>
          <span className="text-blackbox-text font-bold">
            {taskStats.completed} / {taskStats.total} COMPLETED ({progressPercent}%)
          </span>
        </div>
        <div className="w-full h-2 bg-blackbox-surface rounded-full overflow-hidden border border-blackbox-border/80">
          <div
            className="h-full rounded-full bg-blackbox-cyan transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Status Distribution Counters (Section 56 & 82) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 pt-3 border-t border-blackbox-border/60">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`p-2 rounded border text-left transition-colors ${
              statusFilter === 'ALL'
                ? 'bg-blackbox-panel border-cyan-700'
                : 'bg-blackbox-surface border-blackbox-border hover:border-zinc-700'
            }`}
          >
            <div className="text-[10px] font-mono text-blackbox-muted">TOTAL</div>
            <div className="text-base font-mono font-bold text-blackbox-text">{taskStats.total}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('PENDING')}
            className={`p-2 rounded border text-left transition-colors ${
              statusFilter === 'PENDING'
                ? 'bg-zinc-900 border-zinc-600'
                : 'bg-blackbox-surface border-blackbox-border hover:border-zinc-700'
            }`}
          >
            <div className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> PENDING
            </div>
            <div className="text-base font-mono font-bold text-zinc-300">{taskStats.pending}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('ACTIVE')}
            className={`p-2 rounded border text-left transition-colors ${
              statusFilter === 'ACTIVE'
                ? 'bg-cyan-950/60 border-cyan-600'
                : 'bg-blackbox-surface border-blackbox-border hover:border-zinc-700'
            }`}
          >
            <div className="text-[10px] font-mono text-cyan-400 flex items-center gap-1">
              <Play className="w-2.5 h-2.5" /> ACTIVE
            </div>
            <div className="text-base font-mono font-bold text-cyan-300">{taskStats.active}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('BLOCKED')}
            className={`p-2 rounded border text-left transition-colors ${
              statusFilter === 'BLOCKED'
                ? 'bg-amber-950/60 border-amber-600'
                : 'bg-blackbox-surface border-blackbox-border hover:border-zinc-700'
            }`}
          >
            <div className="text-[10px] font-mono text-amber-400 flex items-center gap-1">
              <AlertOctagon className="w-2.5 h-2.5" /> BLOCKED
            </div>
            <div className="text-base font-mono font-bold text-amber-300">{taskStats.blocked}</div>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter('COMPLETED')}
            className={`p-2 rounded border text-left transition-colors ${
              statusFilter === 'COMPLETED'
                ? 'bg-emerald-950/60 border-emerald-600'
                : 'bg-blackbox-surface border-blackbox-border hover:border-zinc-700'
            }`}
          >
            <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-2.5 h-2.5" /> COMPLETED
            </div>
            <div className="text-base font-mono font-bold text-emerald-300">
              {taskStats.completed}
            </div>
          </button>
        </div>
      </div>

      {/* Filter and Search Controls (Section 57) */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-blackbox-muted pointer-events-none" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-blackbox-panel border border-blackbox-border rounded-lg text-xs font-mono text-blackbox-text placeholder:text-blackbox-muted focus:outline-none focus:border-blackbox-cyan transition-colors w-40 sm:w-48"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs font-mono text-blackbox-muted">
            <Filter className="w-3.5 h-3.5" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-blackbox-panel border border-blackbox-border rounded-lg text-xs font-mono text-blackbox-text focus:outline-none focus:border-blackbox-cyan"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        {currentUserRole === 'FIELD_OPERATOR' && (
          <button
            type="button"
            onClick={() => setOnlyMyTasks(!onlyMyTasks)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono transition-colors flex items-center gap-1.5 ${
              onlyMyTasks
                ? 'bg-cyan-950/60 border-blackbox-cyan text-blackbox-cyan font-bold'
                : 'bg-blackbox-panel border-blackbox-border text-blackbox-muted hover:text-blackbox-text'
            }`}
          >
            <span>ASSIGNED TO ME ONLY</span>
          </button>
        )}
      </div>

      {/* Task Cards List */}
      <div className="mt-4 space-y-3">
        {isLoading ? (
          <div className="py-12 text-center text-xs font-mono text-blackbox-muted flex items-center justify-center gap-2">
            <span className="w-3.5 h-3.5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            Retrieving mission task roster...
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-lg bg-blackbox-panel/40 border border-dashed border-blackbox-border">
            <div className="text-xs font-mono text-blackbox-muted">
              {tasks.length === 0
                ? 'No operational tasks created for this mission yet.'
                : 'No tasks match current filter criteria.'}
            </div>
            {isCommander && missionOperational && tasks.length === 0 && (
              <button
                onClick={() => setIsCreateDialogOpen(true)}
                className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-blackbox-panel hover:bg-zinc-800 border border-blackbox-border text-xs font-mono text-blackbox-cyan transition-colors"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                CREATE FIRST TASK
              </button>
            )}
          </div>
        ) : (
          filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isCommander={isCommander}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              missionMembers={members}
              onStatusChange={onStatusChange}
              onOpenAssignModal={(t) => setSelectedTaskForAssign(t)}
              onOpenEditModal={(t) => setSelectedTaskForEdit(t)}
            />
          ))
        )}
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        isOpen={isCreateDialogOpen}
        missionId={missionId}
        members={members}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreateTask={onCreateTask}
      />

      {/* Assign Task Modal */}
      <AssignTaskModal
        isOpen={selectedTaskForAssign !== null}
        task={selectedTaskForAssign}
        members={members}
        onClose={() => setSelectedTaskForAssign(null)}
        onAssign={onAssignTask}
        onUnassign={onUnassignTask}
      />

      <TaskEditDialog
        isOpen={selectedTaskForEdit !== null}
        task={selectedTaskForEdit}
        onClose={() => setSelectedTaskForEdit(null)}
        onUpdateTask={onUpdateTask}
      />
    </div>
  );
};
