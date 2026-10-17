import type { EntityRef, MissionEvent, UserSummary } from '../types'

export function entityName(value: EntityRef<UserSummary> | undefined | null): string {
  if (!value) return 'Unassigned'
  return typeof value === 'string' ? value.slice(0, 8) : value.name
}

export function shortDate(value?: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

export function shortTime(value?: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

export function relativeDate(value?: string | null): string {
  if (!value) return '—'
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.round(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

export function eventDescription(event: MissionEvent): string {
  const payload = event.payload || {}
  const label = typeof payload.title === 'string' ? payload.title : typeof payload.text === 'string' ? payload.text : typeof payload.name === 'string' ? payload.name : ''
  if (label) return label
  return event.eventType.replaceAll('_', ' ').toLowerCase()
}
