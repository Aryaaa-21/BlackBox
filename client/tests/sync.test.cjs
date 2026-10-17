const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const r = require('./runtime.cjs');
beforeEach(r.reset);
after(() => r.db.close());
const create = (title = 'Offline task') => r.createTaskMutation(r.mission, { title, priority: 'HIGH' }, { offline: true });
const queued = () => r.getAccountMutations(r.account);
const fail = (status, code = 'NETWORK_ERROR') => Object.assign(new Error('Injected transport failure'), { status, code });

test('identity, device, optimistic entity and queue survive database close/reopen', async () => {
  const task = await create();
  const before = await queued();
  const device = await r.getDeviceId();
  await r.reopen();
  assert.deepEqual(await queued(), before);
  assert.equal(await r.getDeviceId(), device);
  assert.equal((await r.getCachedTask(task.id)).title, task.title);
  assert.equal((await r.getMutationStateCounts()).pending, 1);
  assert.match(before[0].mutationId, /^[0-9a-f-]{36}$/);
});

test('all six offline operations persist and project local state after each reopen', async () => {
  const task = await create();
  await r.reopen();
  await r.changeTaskMutation(task.id, 'UPDATE_TASK', { title: 'Edited offline' }, { offline: true });
  await r.reopen();
  await r.changeTaskMutation(task.id, 'ASSIGN_TASK', { userId: r.operator }, { offline: true });
  await r.reopen();
  assert.equal((await r.getCachedTask(task.id)).assignedTo, r.operator);
  await r.changeTaskMutation(task.id, 'UNASSIGN_TASK', {}, { offline: true });
  await r.reopen();
  assert.equal((await r.getCachedTask(task.id)).assignedTo, null);
  await r.changeTaskMutation(task.id, 'UPDATE_TASK_STATUS', { status: 'ACTIVE' }, { offline: true });
  await r.reopen();
  await r.recordObservationMutation(r.mission, { text: 'Observation survives reload' }, true);
  await r.reopen();
  assert.equal((await r.getCachedTask(task.id)).title, 'Edited offline');
  assert.equal((await r.getCachedTask(task.id)).status, 'ACTIVE');
  assert.equal((await r.getCachedEvents(r.mission)).length, 1);
  assert.equal((await queued()).length, 6);
});

test('optimistic write and queue insert roll back together on cache failure', async () => {
  const reject = () => { throw new Error('Injected cache write failure'); };
  r.db.tasks.hook('creating', reject);
  try { await assert.rejects(create(), /Injected cache/); }
  finally { r.db.tasks.hook('creating').unsubscribe(reject); }
  assert.equal((await queued()).length, 0);
  assert.equal(await r.db.tasks.count(), 0);
});

test('cross-batch CREATE then delayed ASSIGN then STATUS uses durable mapping after reopen', async () => {
  const s = r.server(); r.syncApi.submit = s.submit;
  const task = await create();
  await r.syncQueuedMutations();
  const id = await r.resolveEntityId('TASK', task.id);
  assert.notEqual(id, task.id);
  await r.reopen();
  await r.changeTaskMutation(task.id, 'ASSIGN_TASK', { userId: r.operator }, { offline: true });
  await r.syncQueuedMutations();
  await r.reopen();
  await r.changeTaskMutation(task.id, 'UPDATE_TASK_STATUS', { status: 'ACTIVE' }, { offline: true });
  await r.syncQueuedMutations();
  assert.equal(s.tasks.size, 1);
  assert.equal(s.tasks.get(id).assignedTo, r.operator);
  assert.equal(s.tasks.get(id).status, 'ACTIVE');
  assert.equal((await queued()).length, 0);
  assert.equal(await r.db.tasks.get(task.id), undefined);
});

test('CREATE -> ASSIGN -> STATUS waits for acknowledgement, not just timestamp order', async () => {
  const s = r.server(); r.syncApi.submit = s.submit;
  const task = await create();
  await r.changeTaskMutation(task.id, 'ASSIGN_TASK', { userId: r.operator }, { offline: true });
  await r.changeTaskMutation(task.id, 'UPDATE_TASK_STATUS', { status: 'ACTIVE' }, { offline: true });
  assert.equal(r.selectMutationBatch(await queued(), [], Date.now()).length, 1);
  await r.reopen();
  await r.syncQueuedMutations();
  assert.deepEqual(s.requests.map((batch) => batch.map((m) => m.operationType)), [['CREATE_TASK'], ['ASSIGN_TASK'], ['UPDATE_TASK_STATUS']]);
  assert.equal((await r.getCachedTasks(r.mission))[0].status, 'ACTIVE');
});

test('dependency remains blocked if a queue ordering attempt moves child first', async () => {
  const task = await create();
  await r.changeTaskMutation(task.id, 'ASSIGN_TASK', { userId: r.operator }, { offline: true });
  const q = await queued();
  q[1].queueOrder = -1;
  assert.deepEqual(r.selectMutationBatch(q, [], Date.now()).map((m) => m.operationType), ['CREATE_TASK']);
});

test('response loss retries the exact persisted wire body, with one entity and event', async () => {
  const s = r.server(); let lost = true;
  r.syncApi.submit = async (batch) => {
    const result = await s.submit(batch);
    if (lost) { lost = false; throw fail(undefined); }
    return result;
  };
  await create();
  const identity = (await queued())[0];
  await assert.rejects(r.syncQueuedMutations());
  await r.reopen(); await r.due();
  const summary = await r.syncQueuedMutations();
  assert.equal(summary.duplicates, 1);
  assert.equal(s.tasks.size, 1); assert.equal(s.events.size, 1);
  assert.deepEqual(s.requests[0], s.requests[1]);
  assert.equal(s.requests[1][0].idempotencyKey, identity.idempotencyKey);
  assert.equal((await queued()).length, 0);
});

test('crash while local acknowledgement persists rolls back mapping/cache/deletion atomically', async () => {
  const s = r.server(); r.syncApi.submit = s.submit;
  const task = await create();
  const reject = () => { throw new Error('Crash during acknowledgement'); };
  r.db.mutations.hook('deleting', reject);
  try { await assert.rejects(r.syncQueuedMutations(), /Crash during acknowledgement/); }
  finally { r.db.mutations.hook('deleting').unsubscribe(reject); }
  assert.equal((await queued())[0].status, 'SYNCING');
  assert.equal((await r.getIdMappings(r.account)).length, 0);
  assert.ok(await r.db.tasks.get(task.id));
  await r.reopen();
  const result = await r.syncQueuedMutations();
  assert.equal(result.duplicates, 1);
  assert.equal(s.tasks.size, 1); assert.equal(s.events.size, 1);
  assert.equal((await queued()).length, 0);
});

test('interruption before request is recoverable without regenerating identity', async () => {
  await create(); const mutation = (await queued())[0];
  const wireMutation = r.mutationForTransport(mutation, []);
  await r.db.mutations.update(mutation.mutationId, { status: 'SYNCING', wireMutation, attempts: 1 });
  await r.reopen();
  const s = r.server(); r.syncApi.submit = s.submit;
  await r.syncQueuedMutations();
  assert.deepEqual(s.requests[0][0], wireMutation);
  assert.equal((await queued()).length, 0);
});

test('rapid double sync invocation runs one effective processor', async () => {
  const s = r.server(); r.syncApi.submit = s.submit;
  await create();
  await Promise.all([r.syncQueuedMutations(), r.syncQueuedMutations(), r.syncQueuedMutations()]);
  assert.equal(s.requests.length, 1);
  assert.equal(s.tasks.size, 1);
});

for (const status of [400, 401, 403, 404, 409, 422]) {
  test(`HTTP ${status} is not auto-retried or used as offline cache success`, async () => {
    await create();
    r.syncApi.submit = async () => { throw fail(status, `HTTP_${status}`); };
    await assert.rejects(r.syncQueuedMutations());
    assert.equal((await queued())[0].status, 'FAILED');
    assert.equal(r.canUseOfflineCache(fail(status)), false);
    assert.equal(r.isRetryableFailure(fail(status)), false);
  });
}
for (const status of [undefined, 408, 429, 500, 503]) {
  test(`${status || 'network loss'} remains durable with backoff but only transport permits cache fallback`, async () => {
    await create();
    const original = (await queued())[0];
    r.syncApi.submit = async () => { throw fail(status); };
    await assert.rejects(r.syncQueuedMutations());
    await r.reopen();
    const mutation = (await queued())[0];
    assert.equal(mutation.status, 'PENDING');
    assert.equal(mutation.attempts, 1);
    assert.ok(Date.parse(mutation.nextAttemptAt) > Date.now() - 500);
    assert.equal(mutation.idempotencyKey, original.idempotencyKey);
    assert.equal(r.canUseOfflineCache(fail(status)), status === undefined);
  });
}

test('retry ceiling is durable and explicit retry keeps identity', async () => {
  await create(); const mutation = (await queued())[0];
  await r.db.mutations.update(mutation.mutationId, { attempts: 7 });
  r.syncApi.submit = async () => { throw fail(503); };
  await assert.rejects(r.syncQueuedMutations()); await r.reopen();
  assert.equal((await queued())[0].status, 'FAILED');
  await r.retryMutation(mutation.mutationId);
  assert.equal((await queued())[0].idempotencyKey, mutation.idempotencyKey);
  assert.equal((await queued())[0].attempts, 8);
  assert.equal(r.retryDelayMs(1000), 60000);
});

test('partial response preserves acknowledged A/B/E, conflict C, retryable D and blocks dependent C', async () => {
  const tasks = [];
  for (const label of ['A', 'B', 'C', 'D', 'E']) tasks.push(await create(label));
  await r.changeTaskMutation(tasks[2].id, 'UPDATE_TASK', { title: 'C depends' }, { offline: true });
  const original = await queued(), s = r.server();
  r.syncApi.submit = async (batch) => {
    const results = [];
    for (const m of batch) {
      if (m.payload.title === 'C') results.push({ mutationId: m.mutationId, idempotencyKey: m.idempotencyKey, status: 'CONFLICT', serverId: 'dddddddddddddddddddddddd', conflict: { conflictId: 'conflict-C', localState: m.payload, serverState: { title: 'Server C' } } });
      else if (m.payload.title === 'D') results.push({ mutationId: m.mutationId, idempotencyKey: m.idempotencyKey, status: 'FAILED', errorCode: 'SERVICE_UNAVAILABLE' });
      else results.push(...(await s.submit([m])).results);
    }
    return r.envelope(results);
  };
  await r.syncQueuedMutations(); await r.reopen();
  let q = await queued();
  assert.equal(q.length, 3);
  assert.equal(q.find((m) => m.payload.title === 'C').status, 'CONFLICT');
  assert.equal(q.find((m) => m.payload.title === 'D').status, 'PENDING');
  assert.equal((await r.getCachedOpenConflicts()).length, 1);
  assert.equal(s.tasks.size, 3);
  r.syncApi.submit = s.submit; await r.due(); await r.syncQueuedMutations();
  q = await queued();
  assert.equal(q.length, 2); assert.equal(s.tasks.size, 4);
  for (const id of original.filter((m) => ['A', 'B', 'E'].includes(m.payload.title)).map((m) => m.mutationId)) assert.ok(!q.some((m) => m.mutationId === id));
});

test('50+ mutation multi-batch queue survives reopen, network loss, conflict and reconciliation', async () => {
  const s = r.server();
  for (let i = 0; i < 11; i++) {
    const task = await create(`Large task ${i}`);
    await r.changeTaskMutation(task.id, 'UPDATE_TASK', { title: `Large updated ${i}` }, { offline: true });
    await r.changeTaskMutation(task.id, 'ASSIGN_TASK', { userId: r.operator }, { offline: true });
    await r.changeTaskMutation(task.id, 'UPDATE_TASK_STATUS', { status: 'ACTIVE' }, { offline: true });
    await r.recordObservationMutation(r.mission, { text: `Large observation ${i}` }, true);
  }
  assert.equal((await queued()).length, 55);
  const identities = new Map((await queued()).map((m) => [m.mutationId, m.idempotencyKey]));
  await r.reopen();
  let lost = true;
  r.syncApi.submit = async (batch) => {
    assert.ok(batch.length <= 20);
    const results = [];
    for (const m of batch) {
      assert.equal(identities.get(m.mutationId), m.idempotencyKey);
      if (m.payload.title === 'Large updated 0') results.push({ mutationId: m.mutationId, idempotencyKey: m.idempotencyKey, status: 'CONFLICT', serverId: m.entityId, conflict: { conflictId: 'large-conflict', localState: m.payload, serverState: s.tasks.get(m.entityId) } });
      else results.push(...(await s.submit([m])).results);
    }
    if (lost) { lost = false; throw fail(undefined); }
    return r.envelope(results);
  };
  await assert.rejects(r.syncQueuedMutations()); await r.reopen(); await r.due();
  await r.syncQueuedMutations();
  const q = await queued();
  assert.equal(q.length, 3); // conflict + two dependent entries remain recoverable.
  assert.equal(q.filter((m) => m.status === 'CONFLICT').length, 1);
  assert.equal(q.filter((m) => m.status === 'SYNCING').length, 0);
  assert.equal(s.tasks.size, 11); assert.equal(s.events.size, 52);
  assert.equal((await r.getCachedTasks(r.mission)).length, 11);
  assert.equal((await r.getIdMappings(r.account)).filter((m) => m.entityType === 'TASK').length, 11);
  assert.equal([...s.tasks.values()].filter((t) => t.status === 'ACTIVE' && t.assignedTo === r.operator).length, 10);
  assert.equal((await r.getCachedOpenConflicts()).length, 1);
});

test('connectivity distinguishes offline network, reached API errors and server unavailable', () => {
  r.connectivity.snapshot = { browser: 'online', api: 'unknown' };
  for (const status of [400, 401, 403, 404, 409, 422]) {
    r.connectivity.reportRequestFailure({ status }); assert.equal(r.connectivity.getSnapshot().api, 'reachable');
  }
  r.connectivity.reportRequestFailure({ status: 503 }); assert.equal(r.connectivity.getSnapshot().api, 'unreachable');
  r.connectivity.reportRequestSuccess(); assert.equal(r.connectivity.getSnapshot().api, 'reachable');
  r.connectivity.snapshot = { browser: 'offline', api: 'unknown' };
  r.connectivity.reportRequestSuccess(); assert.equal(r.connectivity.getSnapshot().api, 'unknown');
});

test('conflict resolution atomically stops old retry, caches server and releases dependent', async () => {
  const s = r.server(); r.syncApi.submit = s.submit;
  const task = await create(); await r.syncQueuedMutations();
  const id = await r.resolveEntityId('TASK', task.id);
  await r.changeTaskMutation(id, 'UPDATE_TASK', { title: 'Conflicting' }, { offline: true });
  await r.changeTaskMutation(id, 'ASSIGN_TASK', { userId: r.operator }, { offline: true });
  const first = (await queued())[0];
  const conflict = { id: 'resolve-test', missionId: r.mission, mutationId: first.mutationId, entityType: 'TASK', entityId: id, status: 'RESOLVED', resolution: 'KEEP_SERVER' };
  await r.db.mutations.update(first.mutationId, { status: 'SYNCING' });
  await r.db.mutations.update(first.mutationId, { status: 'CONFLICT' });
  r.syncApi.resolve = async () => ({ conflict, entity: s.tasks.get(id) });
  await r.resolveQueuedConflict(conflict.id, { resolution: 'KEEP_SERVER' });
  await r.reopen();
  assert.equal((await queued()).length, 1);
  await r.syncQueuedMutations(); assert.equal((await queued()).length, 0);
  assert.notEqual(s.tasks.get(id).title, 'Conflicting');
});

test('invalid queue transitions are rejected by the persistence boundary', async () => {
  await create(); const mutation = (await queued())[0];
  await assert.rejects(r.db.mutations.update(mutation.mutationId, { status: 'CONFLICT' }), /Invalid queue transition/);
  await r.db.mutations.update(mutation.mutationId, { status: 'SYNCING' });
  await r.db.mutations.update(mutation.mutationId, { status: 'CONFLICT' });
  await assert.rejects(r.db.mutations.update(mutation.mutationId, { status: 'PENDING' }), /Invalid queue transition/);
  assert.equal((await queued())[0].status, 'CONFLICT');
});

test('stale cache fallback is exercised through the real operations store', async () => {
  const { tasksApi } = require('../src/api/tasks.ts');
  const { useOperationsStore } = require('../src/stores/operations.store.ts');
  const { ApiRequestError } = require('../src/api/http.ts');
  const task = await create();
  const original = tasksApi.mission;
  try {
    for (const status of [400, 401, 403, 404, 409, 422, 500]) {
      tasksApi.mission = async () => { throw new ApiRequestError({ success: false, code: `HTTP_${status}`, message: 'Visible API failure' }, status); };
      await assert.rejects(useOperationsStore.getState().loadTasks(r.mission), /Visible API failure/);
    }
    tasksApi.mission = async () => { throw new ApiRequestError({ success: false, code: 'NETWORK_ERROR', message: 'Transport unavailable' }); };
    assert.equal((await useOperationsStore.getState().loadTasks(r.mission))[0].id, task.id);
  } finally { tasksApi.mission = original; useOperationsStore.getState().reset(); }
});

test('cached event fallback includes mapped authoritative EVENT rows', async () => {
  const { http, ApiRequestError } = require('../src/api/http.ts');
  const { cacheResponse, cacheResponseKey } = require('../src/db/index.ts');
  const { useOperationsStore } = require('../src/stores/operations.store.ts');
  const authoritativeId = 'dddddddddddddddddddddddd';
  const authoritative = { id: authoritativeId, missionId: r.mission, actorId: r.account, eventType: 'OBSERVATION_RECORDED', targetType: 'OBSERVATION', targetId: null, payload: { text: 'Synced observation' }, source: 'USER', createdAt: r.now, updatedAt: r.now };
  await r.cacheEvent(authoritative);
  await r.db.idMappings.put({ accountId: r.account, entityType: 'EVENT', localId: 'local-observation', serverId: authoritativeId, mutationId: 'mutation-observation', updatedAt: r.now });
  await cacheResponse(cacheResponseKey(`events:${r.mission}`, {}), { events: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } }, r.account);
  const originalGet = http.get;
  http.get = async () => { throw new ApiRequestError({ code: 'NETWORK_ERROR', message: 'Synthetic offline' }); };
  try {
    const result = await useOperationsStore.getState().loadEvents(r.mission);
    assert.deepEqual(result.events.map((event) => event.id), [authoritativeId]);
  } finally {
    http.get = originalGet;
    useOperationsStore.getState().reset();
  }
});

test('offline observation survives refresh, transport loss, retry and authoritative reconciliation', async () => {
  const s = r.server();
  const originalSubmit = r.syncApi.submit;
  let lostResponse = true;
  r.syncApi.submit = async (batch) => {
    const response = await s.submit(batch);
    if (lostResponse) { lostResponse = false; throw fail(undefined); }
    return response;
  };
  try {
    const observation = await r.recordObservationMutation(r.mission, { text: 'Durable offline SITREP' }, true);
    const before = (await queued())[0];
    assert.equal(before.operationType, 'RECORD_OBSERVATION');
    assert.equal(before.entityType, 'EVENT');
    assert.equal(before.entityId, observation.id);
    assert.equal(before.payload.text, 'Durable offline SITREP');
    assert.equal(before.status, 'PENDING');
    assert.ok(before.idempotencyKey);
    assert.equal((await r.getCachedEvents(r.mission))[0].source, 'LOCAL');

    await r.reopen();
    assert.equal((await queued()).length, 1);
    assert.equal((await r.getCachedEvents(r.mission))[0].payload.text, 'Durable offline SITREP');

    await assert.rejects(r.syncQueuedMutations(), /Injected transport failure/);
    assert.equal((await queued())[0].status, 'PENDING');
    await r.reopen();
    await r.due();
    const retry = await r.syncQueuedMutations();
    assert.equal(retry.duplicates, 1);
    assert.equal((await queued()).length, 0);
    assert.equal(s.events.size, 1);

    const mapping = (await r.getIdMappings(r.account)).find((item) => item.entityType === 'EVENT');
    assert.ok(mapping);
    const authoritative = await r.db.events.get(mapping.serverId);
    assert.equal(authoritative.source, 'USER');
    assert.equal(authoritative.eventType, 'OBSERVATION_RECORDED');
    assert.equal(authoritative.payload.text, 'Durable offline SITREP');
    assert.equal((await r.getCachedEvents(r.mission)).filter((item) => item.payload.text === 'Durable offline SITREP').length, 1);
  } finally {
    r.syncApi.submit = originalSubmit;
  }
});

test('incomplete acknowledgement leaves only missing entries retryable', async () => {
  await create('First'); await create('Second');
  const s = r.server();
  r.syncApi.submit = async (batch) => {
    const result = await s.submit(batch);
    return r.envelope(result.results.slice(0, 1));
  };
  await assert.rejects(r.syncQueuedMutations(), /did not include/);
  assert.equal((await queued()).length, 1);
  assert.equal((await queued())[0].status, 'PENDING');
  r.syncApi.submit = s.submit; await r.reopen(); await r.due();
  assert.equal((await r.syncQueuedMutations()).duplicates, 1);
  assert.equal(s.tasks.size, 2); assert.equal(s.events.size, 2);
});

test('an unexpired durable lease prevents a second tab draining the queue', async () => {
  await create(); const s = r.server(); r.syncApi.submit = s.submit;
  await r.db.metadata.put({ key: 'syncLease', value: JSON.stringify({ owner: 'other-tab', expiresAt: Date.now() + 60000 }) });
  assert.equal(await r.syncQueuedMutations(), undefined);
  assert.equal(s.requests.length, 0);
  await r.db.metadata.put({ key: 'syncLease', value: JSON.stringify({ owner: 'crashed-tab', expiresAt: Date.now() - 1 }) });
  await r.syncQueuedMutations(); assert.equal(s.tasks.size, 1);
});

test('schema v3 upgrade preserves stable legacy mutations and adds durable dependencies', async () => {
  await create(); const original = (await queued())[0];
  await r.db.delete();
  const Dexie = require('dexie').default;
  const legacy = new Dexie('blackbox-operational-cache');
  legacy.version(3).stores({
    missions: 'id, accountId, status, updatedAt, createdAt', tasks: 'id, accountId, missionId, status, updatedAt, createdAt',
    members: 'id, accountId, missionId, userId, status, updatedAt', events: 'id, accountId, missionId, eventType, createdAt, idempotencyKey',
    users: 'id, accountId, role, email, name', mutations: 'mutationId, accountId, missionId, entityId, status, createdAt, idempotencyKey',
    conflicts: 'id, accountId, missionId, entityId, status, detectedAt', metadata: 'key', sessions: 'userId, savedAt',
  });
  const old = { ...original }; delete old.queueOrder; delete old.accountId;
  await legacy.table('mutations').put(old);
  await legacy.table('mutations').put({ ...old, mutationId: r.createUuid(), idempotencyKey: r.createUuid(), operationType: 'ASSIGN_TASK', payload: { userId: r.operator } });
  legacy.close(); await r.db.open();
  const upgraded = await r.getAccountMutations(r.account);
  assert.equal(upgraded.length, 2);
  assert.ok(upgraded.every((m) => m.accountId === r.account && m.queueOrder > 0));
  assert.ok(upgraded.some((m) => m.mutationId === original.mutationId && m.idempotencyKey === original.idempotencyKey));
  assert.equal(upgraded[0].operationType, 'CREATE_TASK');
  assert.equal(upgraded[1].dependsOnMutationId, upgraded[0].mutationId);
});

test('persistence refuses mutation identity changes during retry', async () => {
  await create(); const mutation = (await queued())[0];
  for (const key of ['idempotencyKey', 'deviceId', 'clientCreatedAt', 'entityId']) {
    await assert.rejects(r.db.mutations.update(mutation.mutationId, { [key]: 'changed' }), /immutable/);
  }
  assert.equal((await queued())[0].idempotencyKey, mutation.idempotencyKey);
});

test('offline bootstrap restores the persisted session without a network prerequisite', async () => {
  const { authApi } = require('../src/api/auth.ts');
  const { useAuthStore } = require('../src/stores/auth.store.ts');
  const original = authApi.me;
  let calls = 0;
  authApi.me = async () => { calls++; throw new Error('No network should be needed'); };
  try {
    await r.reopen();
    assert.equal((await useAuthStore.getState().loadCurrentUser()).id, r.account);
    assert.equal(calls, 0);
  } finally { authApi.me = original; }
});
