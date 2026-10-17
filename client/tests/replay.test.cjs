const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const r = require('./runtime.cjs');
const replay = require('../src/services/replay.ts');
const { replayApi } = require('../src/api/replay.ts');
const { http, ApiRequestError } = require('../src/api/http.ts');
const { useOperationsStore } = require('../src/stores/operations.store.ts');
const { tasksApi } = require('../src/api/tasks.ts');
const { preferAuthoritative } = require('../src/services/authority.ts');
const originalGet = http.get;
beforeEach(async () => { await r.reset(); useOperationsStore.getState().reset(); http.get = originalGet; });
after(() => { http.get = originalGet; r.db.close(); });
const event = (id, eventType, payload = {}, extra = {}) => ({ id, missionId: r.mission, eventType, payload, createdAt: r.now, source: 'USER', targetId: 'task-1', targetType: 'TASK', actor: { id: r.account, name: 'Historic actor' }, ...extra });
const task = { id: 'task-1', missionId: r.mission, title: 'Created historically', description: '', status: 'PENDING', priority: 'HIGH', assignedTo: null, createdBy: r.account, createdAt: r.now, updatedAt: r.now, version: 0 };
const mission = { id: r.mission, title: 'Current metadata must not seed history', description: '', location: 'Test', severity: 'LOW', status: 'COMPLETED', createdBy: r.account, createdAt: r.now, updatedAt: r.now, version: 1 };
const ok = (data, config) => ({ data: { success: true, data }, status: 200, config });
const page = (events, hasMore = false, nextCursor = null) => ({ mission, events, summary: { totalEvents: events.length }, pagination: { total: 4, limit: 2, hasMore, nextCursor } });
const freeze = (value) => { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze); } return value; };

test('replay frame zero is empty; state is deterministic and input histories stay immutable', () => {
  const events = freeze([
    event('m1', 'MISSION_CREATED', { ...mission, status: 'DRAFT', title: 'Original mission' }),
    event('m2', 'MISSION_STARTED', { status: 'ACTIVE', startedAt: r.now }),
    event('t1', 'TASK_CREATED', task),
    event('t2', 'TASK_ASSIGNED', { assignedTo: r.operator, assigneeName: 'Historical operator', version: 1 }),
    event('t3', 'TASK_STARTED', { startedAt: r.now, version: 2 }),
    event('t4', 'TASK_BLOCKED', { blockedAt: r.now, version: 3 }),
    event('t5', 'TASK_STARTED', { status: 'ACTIVE', blockedAt: null, version: 4 }),
    event('t6', 'TASK_COMPLETED', { completedAt: r.now, version: 5 }),
    event('o1', 'OBSERVATION_RECORDED', { text: 'Recorded observation' }),
  ]);
  const before = JSON.stringify(events);
  const frames = replay.buildReplayFrames(events);
  assert.deepEqual(frames[0], replay.createEmptyReplayState());
  assert.equal(frames[1].mission.title, 'Original mission');
  assert.equal(frames[3].tasks['task-1'].status, 'PENDING');
  assert.equal(frames[4].tasks['task-1'].assignedTo, r.operator);
  assert.equal(frames[8].tasks['task-1'].status, 'COMPLETED');
  assert.equal(frames[8].tasks['task-1'].blockedAt, null);
  assert.equal(frames[9].observations.length, 1);
  assert.equal(frames[9].mission.status, 'ACTIVE');
  assert.deepEqual(frames.at(-1), replay.reconstructReplay(events));
  assert.deepEqual(replay.reconstructReplay(events), replay.reconstructReplay(events));
  assert.equal(JSON.stringify(events), before);
});

test('team assignment, check-in, removal, reactivation, network and sync reconstruct from events', () => {
  const member = { userId: r.operator, userName: 'Historic member', role: 'FIELD_OPERATOR', joinedAt: r.now, createdAt: r.now, updatedAt: r.now };
  const events = [event('a', 'MEMBER_ASSIGNED', member, { targetId: 'member-1' }), event('b', 'MEMBER_CHECKED_IN', {}, { targetId: 'member-1' }), event('c', 'MEMBER_REMOVED', {}, { targetId: 'member-1' }), event('d', 'MEMBER_REACTIVATED', member, { targetId: 'member-1' }), event('e', 'NETWORK_LOST'), event('f', 'SYNC_STARTED'), event('g', 'NETWORK_RESTORED'), event('h', 'SYNC_COMPLETED')];
  const frames = replay.buildReplayFrames(events);
  assert.equal(frames[2].members['member-1'].checkedInAt, r.now);
  assert.equal(frames[3].members['member-1'].status, 'REMOVED');
  assert.equal(frames[4].members['member-1'].status, 'ACTIVE');
  assert.equal(frames[5].network, 'OFFLINE');
  assert.equal(frames[6].sync, 'SYNCING');
  assert.equal(frames[8].network, 'ONLINE');
  assert.equal(frames[8].sync, 'COMPLETED');
});

test('conflict detection never applies rejected local state; resolution applies only explicit authoritative snapshot', () => {
  const initial = replay.reconstructReplay([event('t', 'TASK_CREATED', task)]);
  const detected = replay.replayReducer(initial, event('c', 'SYNC_CONFLICT', { conflictId: 'conflict-1', entityType: 'TASK', entityId: 'task-1', localState: { title: 'Rejected' }, serverState: { ...task, title: 'Server' } }));
  assert.equal(detected.tasks['task-1'].title, task.title);
  const resolved = replay.replayReducer(detected, event('r', 'CONFLICT_RESOLVED', { conflictId: 'conflict-1', entityType: 'TASK', entityId: 'task-1', resolution: 'KEEP_SERVER', resolvedEntityState: { ...task, title: 'Server', version: 1 } }));
  assert.equal(resolved.tasks['task-1'].title, 'Server');
  assert.equal(resolved.conflicts['conflict-1'].status, 'RESOLVED');
  assert.equal(resolved.conflicts['conflict-1'].history.length, 2);
  assert.equal(detected.conflicts['conflict-1'].status, 'OPEN');
});

test('unknown/malformed/foreign/pending/duplicate events cannot corrupt state or stop subsequent events', () => {
  const events = [event('t', 'TASK_CREATED', task), null, event('unknown', 'FUTURE_EVENT', { title: 'Do not apply' }), event('bad', 'TASK_UPDATED', []), event('foreign', 'TASK_UPDATED', { title: 'Foreign' }, { missionId: 'other' }), event('pending', 'TASK_UPDATED', { title: 'Pending' }, { syncState: 'PENDING' }), event('t', 'TASK_UPDATED', { title: 'Duplicate' }), event('later', 'TASK_UPDATED', { title: 'Valid later' })];
  const state = replay.reconstructReplay(events);
  assert.equal(state.tasks['task-1'].title, 'Valid later');
  assert.equal(state.timeline.length, events.length);
  assert.equal(state.timeline.filter((e) => e.applied).length, 2);
  assert.ok(state.warnings.length >= 6);
});

test('invalid conflict resolution payload does not apply untrusted resolved state', () => {
  const state = replay.reconstructReplay([event('t', 'TASK_CREATED', task), event('bad', 'CONFLICT_RESOLVED', { conflictId: 'bad-conflict', entityType: 'TASK', resolution: 'UNKNOWN', resolvedEntityState: { title: 'Corruption' } })]);
  assert.equal(state.tasks['task-1'].title, task.title);
  assert.ok(state.warnings.some((warning) => warning.includes('invalid')));
});

test('legacy partial events disclose missing fields without borrowing current entities', () => {
  const state = replay.reconstructReplay([event('old', 'TASK_CREATED', { title: 'Old title' })]);
  assert.equal(state.mission, null);
  assert.equal(state.tasks['task-1'].status, undefined);
  assert.ok(state.tasks['task-1'].missingFields.includes('status'));
  assert.deepEqual(replay.reconstructReplay([]).tasks, {});
  assert.equal(replay.clampReplayIndex(99, 0), 0);
  assert.equal(replay.clampReplayIndex(-10, 3), 0);
  assert.equal(replay.clampReplayIndex(100, 3), 2);
  assert.equal(replay.clampReplayIndex(NaN, 3), 0);
});

test('all-page loader drains cursors, deduplicates boundaries and summarizes loaded history', async () => {
  const seen = [];
  const a = event('a', 'TASK_CREATED', task), b = event('b', 'OBSERVATION_RECORDED', { text: 'One' }), c = event('c', 'OBSERVATION_RECORDED', { text: 'Two' });
  http.get = async (_url, config) => { seen.push(config.params.cursor); return ok(config.params.cursor ? page([b, c]) : page([a, b], true, 'cursor-1'), config); };
  const result = await replayApi.all(r.mission, { limit: 2 });
  assert.deepEqual(seen, [undefined, 'cursor-1']);
  assert.deepEqual(result.events.map((e) => e.id), ['a', 'b', 'c']);
  assert.equal(result.summary.totalEvents, 3);
  assert.equal(result.summary.observationsCount, 2);
  assert.equal(result.summary.scope, 'LOADED_HISTORY');
  assert.equal(result.history.limited, false);
  assert.equal(result.pagination.hasMore, false);
});

test('interrupted pagination explicitly limits seek to already loaded authoritative events', async () => {
  http.get = async (_url, config) => {
    if (config.params.cursor) throw new ApiRequestError({ code: 'NETWORK_ERROR', message: 'Synthetic offline' });
    return ok(page([event('a', 'TASK_CREATED', task)], true, 'missing-page'), config);
  };
  const result = await replayApi.all(r.mission, { limit: 1 });
  assert.equal(result.events.length, 1);
  assert.equal(result.history.limited, true);
  assert.match(result.history.notice, /interrupted/i);
});

test('offline replay excludes pending markers, uses historical labels and handles timezone boundaries', async () => {
  await r.cacheMission(mission);
  const historical = event('historical', 'TASK_CREATED', { ...task, actor: { id: r.account, name: 'Then' } });
  await r.cacheEvents([
    { ...historical, actorId: { id: r.account, name: 'Current mutable profile' }, updatedAt: r.now },
    { ...event('legacy', 'OBSERVATION_RECORDED', { text: 'Legacy' }), actorId: { id: r.account, name: 'Current mutable profile' }, updatedAt: r.now },
    { ...event('local', 'OBSERVATION_RECORDED'), actorId: r.account, source: 'LOCAL', updatedAt: r.now },
    { ...event('pending', 'OBSERVATION_RECORDED'), actorId: r.account, syncState: 'PENDING', updatedAt: r.now },
  ]);
  http.get = async () => { throw new ApiRequestError({ code: 'NETWORK_ERROR', message: 'Synthetic offline' }); };
  const result = await replayApi.all(r.mission, { from: '2026-10-16T01:00:00+01:00', to: '2026-10-16T01:00:00+01:00' });
  assert.deepEqual(result.events.map((e) => e.id), ['historical', 'legacy']);
  assert.equal(result.events[0].actor.name, 'Then');
  assert.equal(result.events[1].actor.name, 'Unknown Operator');
  assert.equal(result.history.pendingExcluded, 2);
  assert.equal(result.history.source, 'cache');
  assert.equal(result.history.limited, true);
  assert.equal(result.summary.totalEvents, 2);
});

test('offline replay merges synced cached observations into a stale complete snapshot', async () => {
  await r.cacheMission(mission);
  const shared = event('shared', 'OBSERVATION_RECORDED', { text: 'Snapshot copy' }, { actorId: r.account });
  const staleOnly = event('stale-only', 'OBSERVATION_RECORDED', { text: 'Stale history' }, { createdAt: '2026-10-16T00:00:01.000Z' });
  const synced = { ...event('synced', 'OBSERVATION_RECORDED', { text: 'Acknowledged observation' }, { createdAt: '2026-10-16T00:00:03.000Z' }), actorId: r.account, source: 'USER', updatedAt: '2026-10-16T00:00:03.000Z' };
  const pending = { ...event('pending-replay', 'OBSERVATION_RECORDED', { text: 'Do not replay' }, { createdAt: '2026-10-16T00:00:04.000Z' }), actorId: r.account, source: 'LOCAL', syncState: 'PENDING' };
  await r.cacheEvents([shared, synced, pending]);
  await r.cacheResponse(r.cacheResponseKey(`replay-history:${r.mission}`, { eventType: 'OBSERVATION_RECORDED' }), page([shared, staleOnly, pending]), r.account);
  http.get = async () => { throw new ApiRequestError({ code: 'NETWORK_ERROR', message: 'Synthetic offline' }); };

  const result = await replayApi.all(r.mission, { eventType: 'OBSERVATION_RECORDED' });
  assert.deepEqual(result.events.map((item) => item.id), ['shared', 'stale-only', 'synced']);
  assert.equal(result.events.filter((item) => item.id === 'shared').length, 1);
  assert.equal(result.events.find((item) => item.id === 'synced').payload.text, 'Acknowledged observation');
  assert.equal(result.events.some((item) => item.id === 'pending-replay'), false);
  assert.equal(result.history.pendingExcluded, 1);
});

test('replay cache is account scoped; HTTP errors never masquerade as offline success', async () => {
  http.get = async (_url, config) => ok(page([event('a', 'TASK_CREATED', task)]), config);
  await replayApi.all(r.mission);
  http.get = async () => { throw new ApiRequestError({ code: 'HTTP_500', message: 'Synthetic server failure' }, 500); };
  await assert.rejects(replayApi.all(r.mission), { status: 500 });
  await r.saveSession({ userId: 'other-account', user: { id: 'other-account' }, token: 'synthetic', savedAt: r.now });
  http.get = async () => { throw new ApiRequestError({ code: 'NETWORK_ERROR', message: 'Synthetic offline' }); };
  await assert.rejects(replayApi.all(r.mission));
});

test('version 10 socket state defeats delayed version 9 API responses in cache and visible store', async () => {
  const old = { ...task, version: 9, title: 'Delayed old response' };
  const newer = { ...task, version: 10, title: 'New socket state' };
  let respond;
  http.get = (_url, config) => new Promise((resolve) => { respond = () => resolve(ok({ task: old }, config)); });
  const request = tasksApi.get(task.id);
  while (!respond) await new Promise((resolve) => setTimeout(resolve, 0));
  await r.cacheTask(newer);
  useOperationsStore.getState().upsertTask(newer);
  respond();
  const returned = await request;
  useOperationsStore.getState().upsertTask(returned);
  assert.equal(returned.version, 10);
  assert.equal((await r.getCachedTask(task.id)).title, newer.title);
  assert.equal(useOperationsStore.getState().tasksByMission[r.mission][0].title, newer.title);
  assert.equal(preferAuthoritative(newer, { ...old, version: undefined, updatedAt: '2099-01-01T00:00:00Z' }).version, 10);
  assert.equal(preferAuthoritative(newer, { ...old, version: 11, localPending: true }).version, 10);
});

test('duplicate authoritative socket events have one cache row and cannot become local pending', async () => {
  const authoritative = { ...event('stable', 'TASK_CREATED', task), actorId: r.account, updatedAt: r.now };
  await r.cacheEvent(authoritative);
  await r.cacheEvent(authoritative);
  await r.cacheEvent({ ...authoritative, source: 'LOCAL', payload: { title: 'Must not overwrite' } });
  useOperationsStore.getState().upsertEvent(authoritative);
  useOperationsStore.getState().upsertEvent(authoritative);
  assert.equal((await r.getCachedEvents(r.mission)).length, 1);
  assert.equal((await r.getCachedEvents(r.mission))[0].source, 'USER');
  assert.equal(useOperationsStore.getState().eventsByMission[r.mission].length, 1);
});

for (const count of [100, 500]) test(`replay reconstruction performance and frame boundaries for ${count} events`, () => {
  const events = [event('task', 'TASK_CREATED', task), ...Array.from({ length: count - 1 }, (_, i) => event(`o-${i}`, 'OBSERVATION_RECORDED', { text: `Observation ${i}` }))];
  const samples = [];
  for (let i = 0; i < 5; i++) {
    const before = performance.now();
    const frames = replay.buildReplayFrames(events);
    samples.push(performance.now() - before);
    assert.equal(frames.length, count + 1);
    assert.equal(frames.at(-1).observations.length, count - 1);
    assert.equal(frames[1].observations.length, 0);
  }
  samples.sort((a, b) => a - b);
  console.log(`[PHASE3_PERF] reducer ${count} events/all frames median=${samples[2].toFixed(2)}ms min=${samples[0].toFixed(2)}ms max=${samples[4].toFixed(2)}ms (Node, 5 samples; not browser rendering)`);
});
