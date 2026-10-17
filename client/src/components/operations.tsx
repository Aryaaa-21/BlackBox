import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, PriorityBadge, StatusBadge } from './ui'
import { entityName, eventDescription, relativeDate, shortTime } from '../lib/format'
import type { Mission, MissionEvent, Task } from '../types'

export function MissionRow({ mission, taskCount, teamCount }: { mission: Mission; taskCount?: number; teamCount?: number }) {
  return <tr>
    <td><Link className="table-link table-primary" to={`/missions/${mission.id}`}><strong>{mission.title}</strong><small>{mission.id.slice(0, 12)}</small></Link></td>
    <td><StatusBadge status={mission.status} /></td>
    <td><PriorityBadge priority={mission.severity} /></td>
    <td>{mission.location || '—'}</td>
    <td>{teamCount ?? '—'}</td>
    <td>{taskCount ?? '—'}</td>
    <td className="table-secondary">{relativeDate(mission.updatedAt)}</td>
  </tr>
}

export function TaskRow({ task, onOpen, onStatus }: { task: Task; onOpen: () => void; onStatus?: (status: Task['status']) => void }) {
  const next = task.status === 'PENDING' ? 'ACTIVE' : task.status === 'ACTIVE' ? 'COMPLETED' : task.status === 'BLOCKED' ? 'ACTIVE' : null
  return <tr>
    <td><button className="table-link table-primary" onClick={onOpen}><strong>{task.title}</strong><small>{task.id.slice(0, 12)}</small></button></td>
    <td><PriorityBadge priority={task.priority} /></td>
    <td>{entityName(task.assignedTo)}</td>
    <td><StatusBadge status={task.status} /></td>
    <td className="table-secondary">{relativeDate(task.updatedAt)}</td>
    {onStatus ? <td className="table-actions">{next ? <button className="button button--quiet" onClick={() => onStatus(next)}>{next === 'COMPLETED' ? 'Complete' : next === 'ACTIVE' ? 'Start' : next}</button> : null}</td> : null}
  </tr>
}

export function EventTimeline({ events, onSelect }: { events: MissionEvent[]; onSelect?: (event: MissionEvent) => void }) {
  return <div className="timeline">{events.length ? events.map((event) => <button key={event.id} className="timeline-item" onClick={() => onSelect?.(event)}>
    <span className="timeline-time">{shortTime(event.createdAt)}</span><span className="timeline-dot" aria-hidden="true" />
    <span className="timeline-content"><span>{event.eventType}</span><strong>{entityName(event.actorId)}</strong><p>{eventDescription(event)}</p></span>
  </button>) : <div className="loading-state">No activity recorded yet.</div>}</div>
}

export function KeyValue({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return <div className="metadata-list__item"><dt>{label}</dt><dd className={mono ? 'mono' : undefined}>{value}</dd></div>
}
