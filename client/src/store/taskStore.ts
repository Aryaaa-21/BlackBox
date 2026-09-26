import { create } from 'zustand';
import {
  Task,
  TaskStats,
  TaskFilters,
  CreateTaskPayload,
  UpdateTaskPayload,
  TaskStatus,
  PaginationMeta,
  ApiError,
} from '../types';
import { taskApi } from '../services/taskApi';

interface TaskState {
  tasks: Task[];
  myTasks: Task[];
  selectedTask: Task | null;
  stats: TaskStats | null;
  pagination: PaginationMeta | null;
  filters: TaskFilters;
  isLoading: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  error: string | null;

  // Actions
  fetchTasks: (missionId: string, filters?: TaskFilters) => Promise<void>;
  fetchMyTasks: () => Promise<void>;
  fetchStats: () => Promise<void>;
  createTask: (missionId: string, payload: CreateTaskPayload) => Promise<Task>;
  updateTask: (taskId: string, payload: UpdateTaskPayload) => Promise<Task>;
  assignTask: (taskId: string, userId: string) => Promise<Task>;
  unassignTask: (taskId: string) => Promise<Task>;
  updateTaskStatus: (taskId: string, status: TaskStatus) => Promise<Task>;
  setFilters: (filters: Partial<TaskFilters>) => void;
  clearTasks: () => void;
  clearError: () => void;

  // Real-time synchronization handlers (Section 61 & 64)
  handleTaskCreated: (task: Task) => void;
  handleTaskUpdated: (task: Task) => void;
  handleTaskAssigned: (task: Task) => void;
  handleTaskUnassigned: (task: Task) => void;
  handleTaskStatusChanged: (task: Task) => void;
}

const computeStats = (tasks: Task[]): TaskStats => {
  return {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === 'PENDING').length,
    active: tasks.filter((t) => t.status === 'ACTIVE').length,
    blocked: tasks.filter((t) => t.status === 'BLOCKED').length,
    completed: tasks.filter((t) => t.status === 'COMPLETED').length,
  };
};

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  myTasks: [],
  selectedTask: null,
  stats: null,
  pagination: null,
  filters: {},
  isLoading: false,
  isCreating: false,
  isUpdating: false,
  error: null,

  fetchTasks: async (missionId: string, customFilters?: TaskFilters) => {
    set({ isLoading: true, error: null });
    try {
      const activeFilters = customFilters || get().filters;
      const result = await taskApi.getMissionTasks(missionId, activeFilters);
      set({
        tasks: result.tasks,
        stats: result.stats,
        pagination: result.pagination,
        isLoading: false,
      });
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Unable to retrieve mission tasks.',
        isLoading: false,
      });
    }
  },

  fetchMyTasks: async () => {
    try {
      const myTasks = await taskApi.getMyTasks();
      set({ myTasks });
    } catch (err: unknown) {
      const error = err as ApiError;
      set({ error: error.message || 'Unable to retrieve assigned tasks.' });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await taskApi.getTaskStats();
      set({ stats });
    } catch (err: unknown) {
      const error = err as ApiError;
      set({ error: error.message || 'Unable to retrieve task stats.' });
    }
  },

  createTask: async (missionId: string, payload: CreateTaskPayload) => {
    set({ isCreating: true, error: null });
    try {
      const newTask = await taskApi.createTask(missionId, payload);
      set((state) => {
        const updatedTasks = [newTask, ...state.tasks];
        return {
          tasks: updatedTasks,
          stats: computeStats(updatedTasks),
          isCreating: false,
        };
      });
      return newTask;
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Failed to create task.',
        isCreating: false,
      });
      throw err;
    }
  },

  updateTask: async (taskId: string, payload: UpdateTaskPayload) => {
    set({ isUpdating: true, error: null });
    try {
      const updated = await taskApi.updateTask(taskId, payload);
      set((state) => {
        const tasks = state.tasks.map((t) => (t.id === taskId ? updated : t));
        const myTasks = state.myTasks.map((t) => (t.id === taskId ? updated : t));
        return {
          tasks,
          myTasks,
          selectedTask: state.selectedTask?.id === taskId ? updated : state.selectedTask,
          isUpdating: false,
        };
      });
      return updated;
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Failed to update task details.',
        isUpdating: false,
      });
      throw err;
    }
  },

  assignTask: async (taskId: string, userId: string) => {
    set({ isUpdating: true, error: null });
    try {
      const updated = await taskApi.assignTask(taskId, userId);
      set((state) => {
        const tasks = state.tasks.map((t) => (t.id === taskId ? updated : t));
        const myTasks = state.myTasks.map((t) => (t.id === taskId ? updated : t));
        return {
          tasks,
          myTasks,
          selectedTask: state.selectedTask?.id === taskId ? updated : state.selectedTask,
          isUpdating: false,
        };
      });
      return updated;
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Failed to assign operator to task.',
        isUpdating: false,
      });
      throw err;
    }
  },

  unassignTask: async (taskId: string) => {
    set({ isUpdating: true, error: null });
    try {
      const updated = await taskApi.unassignTask(taskId);
      set((state) => {
        const tasks = state.tasks.map((t) => (t.id === taskId ? updated : t));
        const myTasks = state.myTasks.filter((t) => t.id !== taskId);
        return {
          tasks,
          myTasks,
          selectedTask: state.selectedTask?.id === taskId ? updated : state.selectedTask,
          isUpdating: false,
        };
      });
      return updated;
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Failed to unassign operator from task.',
        isUpdating: false,
      });
      throw err;
    }
  },

  updateTaskStatus: async (taskId: string, status: TaskStatus) => {
    set({ isUpdating: true, error: null });
    try {
      const updated = await taskApi.updateTaskStatus(taskId, status);
      set((state) => {
        const tasks = state.tasks.map((t) => (t.id === taskId ? updated : t));
        const myTasks = state.myTasks.map((t) => (t.id === taskId ? updated : t));
        return {
          tasks,
          myTasks,
          stats: computeStats(tasks),
          selectedTask: state.selectedTask?.id === taskId ? updated : state.selectedTask,
          isUpdating: false,
        };
      });
      return updated;
    } catch (err: unknown) {
      const error = err as ApiError;
      set({
        error: error.message || 'Invalid task status transition.',
        isUpdating: false,
      });
      throw err;
    }
  },

  setFilters: (newFilters: Partial<TaskFilters>) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  clearTasks: () => {
    set({ tasks: [], stats: null, pagination: null, error: null, selectedTask: null });
  },

  clearError: () => {
    set({ error: null });
  },

  // Real-time synchronization
  handleTaskCreated: (task: Task) => {
    set((state) => {
      if (state.tasks.some((t) => t.id === task.id)) return state;
      const tasks = [task, ...state.tasks];
      return {
        tasks,
        stats: computeStats(tasks),
      };
    });
  },

  handleTaskUpdated: (task: Task) => {
    set((state) => {
      const tasks = state.tasks.map((t) => (t.id === task.id ? task : t));
      const myTasks = state.myTasks.map((t) => (t.id === task.id ? task : t));
      return {
        tasks,
        myTasks,
        selectedTask: state.selectedTask?.id === task.id ? task : state.selectedTask,
      };
    });
  },

  handleTaskAssigned: (task: Task) => {
    set((state) => {
      const tasks = state.tasks.map((t) => (t.id === task.id ? task : t));
      const myTasks = state.myTasks.map((t) => (t.id === task.id ? task : t));
      return {
        tasks,
        myTasks,
        selectedTask: state.selectedTask?.id === task.id ? task : state.selectedTask,
      };
    });
  },

  handleTaskUnassigned: (task: Task) => {
    set((state) => {
      const tasks = state.tasks.map((t) => (t.id === task.id ? task : t));
      const myTasks = state.myTasks.filter((t) => t.id !== task.id);
      return {
        tasks,
        myTasks,
        selectedTask: state.selectedTask?.id === task.id ? task : state.selectedTask,
      };
    });
  },

  handleTaskStatusChanged: (task: Task) => {
    set((state) => {
      const tasks = state.tasks.map((t) => (t.id === task.id ? task : t));
      const myTasks = state.myTasks.map((t) => (t.id === task.id ? task : t));
      return {
        tasks,
        myTasks,
        stats: computeStats(tasks),
        selectedTask: state.selectedTask?.id === task.id ? task : state.selectedTask,
      };
    });
  },
}));
