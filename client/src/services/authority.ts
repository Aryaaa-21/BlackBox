/** Shared ordering rule for API, realtime, sync, cache and in-memory views. */
export interface VersionedEntity { id: string; version?: number; updatedAt?: string; localPending?: boolean }

export function authoritativeVersion(value: { version?: unknown } | undefined): number | undefined {
  return typeof value?.version === 'number' && Number.isSafeInteger(value.version) && value.version >= 0 ? value.version : undefined;
}

export function preferAuthoritative<T extends VersionedEntity>(current: T | undefined, incoming: T): T {
  if (!current || current.id !== incoming.id) return incoming;
  if (current.localPending !== true && incoming.localPending === true) return current;
  const previous = authoritativeVersion(current);
  const next = authoritativeVersion(incoming);
  if (previous !== undefined && (next === undefined || next < previous)) return current;
  if (next !== undefined && (previous === undefined || next > previous)) return incoming;
  if (current.localPending === true && incoming.localPending !== true) return incoming;
  // Versionless Phase 2 records retain their timestamp concurrency semantics.
  if (previous === undefined && next === undefined && current.updatedAt && incoming.updatedAt && incoming.updatedAt < current.updatedAt) return current;
  return incoming;
}

/** A task view may overlay queued work only on its own authoritative base version.
 * This is deliberately separate from preferAuthoritative: projections are never
 * persisted as replacements for a server record.
 */
export function preferTaskView<T extends VersionedEntity>(current: T | undefined, incoming: T): T {
  if (current && incoming.localPending === true) {
    const previous = authoritativeVersion(current);
    const next = authoritativeVersion(incoming);
    if (next === previous || (next !== undefined && (previous === undefined || next > previous))) return incoming;
  }
  return preferAuthoritative(current, incoming);
}

export function mergeTaskViews<T extends VersionedEntity>(current: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  return incoming.map((item) => preferTaskView(byId.get(item.id), item));
}

export function mergeAuthoritativeRows<T extends VersionedEntity>(current: readonly T[], incoming: readonly T[]): T[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  return incoming.map((item) => preferAuthoritative(byId.get(item.id), item));
}
