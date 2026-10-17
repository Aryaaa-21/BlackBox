import type { EventQuery, Mission, MissionEvent, MissionQuery, Task, TaskQuery } from '../types';

export function filterTasks(tasks: Task[], query?: TaskQuery): Task[] {
  const priority = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  return tasks.filter((task) => (!query?.status || task.status === query.status) && (!query?.priority || task.priority === query.priority) && (!query?.assignedTo || (typeof task.assignedTo === 'string' ? task.assignedTo : task.assignedTo?.id) === query.assignedTo)).sort((a, b) => priority[b.priority] - priority[a.priority] || Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE') || b.createdAt.localeCompare(a.createdAt));
}

export function filterMissions(missions: Mission[], query?: MissionQuery): Mission[] {
  const search = query?.search?.toLocaleLowerCase();
  return missions.filter((mission) => (!query?.status || mission.status === query.status) && (!query?.severity || mission.severity === query.severity) && (!search || `${mission.title} ${mission.location}`.toLocaleLowerCase().includes(search)));
}

export function filterEvents(events: MissionEvent[], query?: EventQuery): MissionEvent[] {
  return events.filter((event) => !query?.eventType || event.eventType === query.eventType);
}

export function paginateCached<T>(items: T[], query?: { page?: number; limit?: number }, defaultLimit = 50): { items: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } } {
  const page = Math.max(1, query?.page || 1);
  const limit = Math.min(100, Math.max(1, query?.limit || defaultLimit));
  return { items: items.slice((page - 1) * limit, page * limit), pagination: { page, limit, total: items.length, totalPages: Math.ceil(items.length / limit) || 1 } };
}
