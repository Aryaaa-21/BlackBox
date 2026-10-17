import supertest from 'supertest';
import { randomUUID } from 'crypto';
import { ProcessedMutation } from '../models/ProcessedMutation';
import { MissionEvent } from '../models/MissionEvent';
import { Task } from '../models/Task';
import { Mission } from '../models/Mission';
import { SyncConflict } from '../models/SyncConflict';
import { deterministicFingerprint } from '../services/idempotency.service';
import { IncomingMutation } from '../services/sync.service';
import { fork } from 'child_process';
import path from 'path';

export async function runPhase2Tests(
  request: ReturnType<typeof supertest>, token: string, operatorToken: string,
  commanderId: string, operatorId: string, assert: (condition: boolean, message: string) => void
): Promise<void> {
  console.log('\n--- PHASE 2 OFFLINE/SYNC RELIABILITY REGRESSIONS ---');
  const post = (path: string, body: object, auth = token) => request.post(path).set('Authorization', `Bearer ${auth}`).send(body);
  const missionResponse = await post('/api/v1/missions', { title: 'Phase 2 isolated reliability mission', description: 'Synthetic sync fixtures', location: 'Synthetic test zone', severity: 'HIGH' });
  const missionId = missionResponse.body.data.mission.id;
  await post(`/api/v1/missions/${missionId}/start`, {});
  await post(`/api/v1/missions/${missionId}/members`, { userId: operatorId });
  const make = (operationType: string, entityId: string, payload: Record<string, unknown> = {}, baseUpdatedAt?: string): IncomingMutation => {
    const time = new Date().toISOString();
    return { mutationId: randomUUID(), idempotencyKey: randomUUID(), missionId, operationType, entityType: operationType === 'RECORD_OBSERVATION' ? 'EVENT' : 'TASK', entityId, payload, actorId: commanderId, deviceId: 'phase2-server-test', createdAt: time, clientCreatedAt: time, baseUpdatedAt };
  };
  const batch = async (mutations: IncomingMutation[]) => (await post('/api/v1/sync', { mutations })).body.data.results;
  const one = async (mutation: IncomingMutation) => (await batch([mutation]))[0];
  const findMission = Mission.findById;
  try {
    (Mission as any).findById = () => { throw new Error('Injected database outage'); };
    assert((await one(make('RECORD_OBSERVATION', `local-${randomUUID()}`, { text: 'Retry after outage' }))).errorCode === 'SERVER_ERROR', 'Database outage is not disguised as permanent mission access denial');
  } finally { Mission.findById = findMission; }

  const creation = make('CREATE_TASK', `local-${randomUUID()}`, { title: 'Stable identity', description: 'Canonical payload', priority: 'HIGH' });
  const first = await one(creation);
  assert(first.status === 'SYNCED', 'Phase 2 CREATE_TASK first request succeeds');
  const taskId = first.serverId;
  const receipt = await ProcessedMutation.findOne({ idempotencyKey: creation.idempotencyKey });
  assert(Boolean(receipt?.fingerprint?.match(/^[0-9a-f]{64}$/)), 'SHA-256 fingerprint is actually persisted');
  assert(receipt?.entityId === creation.entityId, 'Receipt retains original local request identity');
  assert((await one(creation)).status === 'DUPLICATE', 'Exact CREATE retry replays previous authoritative result');
  assert((await one({ ...creation, payload: { priority: 'HIGH', description: 'Canonical payload', title: 'Stable identity' } })).status === 'DUPLICATE', 'Reordered equivalent payload is a duplicate');
  assert(deterministicFingerprint({ a: { y: 2, x: 1 }, b: [1, 2] }) === deterministicFingerprint({ b: [1, 2], a: { x: 1, y: 2 } }), 'Nested canonical fingerprints ignore object field ordering');
  assert(deterministicFingerprint([1, 2]) !== deterministicFingerprint([2, 1]), 'Canonical fingerprints preserve array ordering');
  for (const [name, changed] of [
    ['payload', { payload: { title: 'Collision' } }],
    ['operation', { operationType: 'UPDATE_TASK' }],
    ['entity', { entityId: `local-${randomUUID()}` }],
    ['base version', { baseUpdatedAt: '2020-01-01T00:00:00.000Z' }],
  ] as Array<[string, Partial<IncomingMutation>]>) {
    const result = await one({ ...creation, ...changed });
    assert(result.status === 'FAILED' && result.errorCode === 'IDEMPOTENCY_KEY_REUSED', `Changed ${name} with same key is rejected without execution`);
  }
  assert(await Task.countDocuments({ missionId, title: 'Stable identity' }) === 1, 'CREATE response-loss retries leave exactly one task');
  assert(await MissionEvent.countDocuments({ missionId, idempotencyKey: creation.idempotencyKey }) === 1, 'CREATE retry leaves exactly one logical TASK_CREATED event');
  const legacy = make('CREATE_TASK', `local-${randomUUID()}`, { title: 'Never execute unverified legacy payload' });
  await ProcessedMutation.create({ idempotencyKey: legacy.idempotencyKey, userId: commanderId, deviceId: legacy.deviceId, missionId, operationType: legacy.operationType, entityType: legacy.entityType, entityId: legacy.entityId, result: first.entity, serverId: taskId });
  assert((await one(legacy)).errorCode === 'IDEMPOTENCY_LEGACY_UNVERIFIABLE', 'Unhashed legacy receipt fails closed instead of silently validating a payload');

  // Dependent local IDs arrive in later HTTP batches, not only the create batch.
  const assignment = make('ASSIGN_TASK', creation.entityId, { userId: operatorId }, first.entity.updatedAt);
  const assigned = await one(assignment);
  assert(assigned.status === 'SYNCED' && assigned.serverId === taskId, 'Cross-batch local ID resolves for assignment');
  assert((await one(assignment)).status === 'DUPLICATE', 'Exact local-ID assignment retry retains original identity');
  const status = make('UPDATE_TASK_STATUS', creation.entityId, { status: 'ACTIVE' }, assigned.entity.updatedAt);
  const started = await one(status);
  assert(started.status === 'SYNCED' && started.entity.status === 'ACTIVE', 'Cross-batch CREATE -> ASSIGN -> STATUS succeeds');
  assert((await one(status)).status === 'DUPLICATE', 'Status retry does not replay task transition');
  for (const [mutation, eventType] of [[assignment, 'TASK_ASSIGNED'], [status, 'TASK_STARTED']] as const) {
    assert(await MissionEvent.countDocuments({ missionId, idempotencyKey: mutation.idempotencyKey, eventType }) === 1, `${eventType} is generated exactly once on retry`);
  }
  const concurrent = make('CREATE_TASK', `local-${randomUUID()}`, { title: 'Concurrent creation' });
  const simultaneous = await Promise.all([one(concurrent), one(concurrent)]);
  assert(simultaneous.map((r) => r.status).sort().join(',') === 'DUPLICATE,SYNCED', 'Concurrent duplicate CREATE executes once');
  assert(await Task.countDocuments({ missionId, title: 'Concurrent creation' }) === 1, 'Concurrent CREATE has one entity');
  assert(await MissionEvent.countDocuments({ missionId, idempotencyKey: concurrent.idempotencyKey }) === 1, 'Concurrent CREATE has one MissionEvent');
  const collision = make('CREATE_TASK', `local-${randomUUID()}`, { title: 'Concurrent key owner' });
  const colliding = await Promise.all([one(collision), one({ ...collision, payload: { title: 'Concurrent intruder' } })]);
  assert(colliding.filter((r) => r.status === 'SYNCED').length === 1 && colliding.some((r) => r.errorCode === 'IDEMPOTENCY_KEY_REUSED'), 'Concurrent different payload cannot inherit a duplicate result');
  const invalid = make('CREATE_TASK', `local-${randomUUID()}`, { title: '' });
  const invalidResults = await Promise.all([one(invalid), one(invalid)]);
  assert(invalidResults.every((r) => r.status === 'FAILED'), 'Concurrent validation failure is never relabeled DUPLICATE');

  const stale = make('ASSIGN_TASK', taskId, { userId: operatorId }, '2020-01-01T00:00:00.000Z');
  const staleResults = await Promise.all([one(stale), one(stale)]);
  assert(staleResults.every((r) => r.status === 'CONFLICT'), 'Concurrent stale assignment stays CONFLICT, never fake success');
  assert(await SyncConflict.countDocuments({ idempotencyKey: stale.idempotencyKey }) === 1, 'Concurrent conflict has one durable record');
  assert((await one({ ...stale, payload: { userId: commanderId } })).errorCode === 'IDEMPOTENCY_KEY_REUSED', 'Conflicted identity cannot be reused with another payload');
  const conflictId = staleResults[0].conflict.conflictId;
  const keepServer = await post(`/api/v1/sync/conflicts/${conflictId}/resolve`, { resolution: 'KEEP_SERVER' });
  assert(keepServer.status === 200 && keepServer.body.data.entity.status === 'ACTIVE', 'KEEP_SERVER returns the current authoritative task');
  const keepServerRetry = await post(`/api/v1/sync/conflicts/${conflictId}/resolve`, { resolution: 'KEEP_SERVER' });
  assert(keepServerRetry.status === 200, 'Lost KEEP_SERVER response can be replayed safely');
  const fieldMutation = { ...make('UPDATE_TASK_STATUS', taskId, { status: 'BLOCKED' }, '2020-01-01T00:00:00.000Z'), actorId: operatorId };
  const fieldSync = await post('/api/v1/sync', { mutations: [fieldMutation] }, operatorToken);
  const fieldConflict = fieldSync.body.data.results[0].conflict.conflictId;
  const deniedMerge = await post(`/api/v1/sync/conflicts/${fieldConflict}/resolve`, { resolution: 'MERGE', mergedState: { title: 'Forbidden' } }, operatorToken);
  assert(deniedMerge.status === 403, 'FIELD_OPERATOR cannot MERGE their own conflict');
  const merge = await post(`/api/v1/sync/conflicts/${fieldConflict}/resolve`, { resolution: 'MERGE', mergedState: { title: 'Commander merged title' } });
  assert(merge.status === 200 && merge.body.data.entity.title === 'Commander merged title', 'COMMANDER may MERGE through task validation');
  assert(merge.body.data.newMutation.mutationId !== fieldMutation.mutationId && merge.body.data.newMutation.idempotencyKey !== fieldMutation.idempotencyKey, 'MERGE has a new durable mutation identity');
  const mergeAgain = await post(`/api/v1/sync/conflicts/${fieldConflict}/resolve`, { resolution: 'MERGE', mergedState: { title: 'Commander merged title' } });
  assert(mergeAgain.status === 200 && mergeAgain.body.data.newMutation.mutationId === merge.body.data.newMutation.mutationId, 'MERGE retry returns original resolution identity');
  const mergeCollision = await post(`/api/v1/sync/conflicts/${fieldConflict}/resolve`, { resolution: 'MERGE', mergedState: { title: 'Another meaning' } });
  assert(mergeCollision.status === 409, 'Completed MERGE cannot be replayed with different data');
  const local = make('UPDATE_TASK', taskId, { description: 'Explicit approved offline content' }, '2020-01-01T00:00:00.000Z');
  const localConflict = await one(local);
  const localResolution = await post(`/api/v1/sync/conflicts/${localConflict.conflict.conflictId}/resolve`, { resolution: 'KEEP_LOCAL' });
  assert(localResolution.status === 200 && localResolution.body.data.entity.description === local.payload.description, 'KEEP_LOCAL applies an explicit fresh authoritative mutation');
  const localReceipt = await ProcessedMutation.findOne({ idempotencyKey: localResolution.body.data.newMutation.idempotencyKey });
  assert(Boolean(localReceipt?.fingerprint) && localResolution.body.data.newMutation.mutationId !== local.mutationId, 'KEEP_LOCAL persists new identity and fingerprint receipt');
  const staleResolution = await one(make('UPDATE_TASK', taskId, { title: 'Do not overwrite' }, '2020-01-01T00:00:00.000Z'));
  await request.patch(`/api/v1/tasks/${taskId}`).set('Authorization', `Bearer ${token}`).send({ title: 'Changed after conflict shown' });
  const staleChoice = await post(`/api/v1/sync/conflicts/${staleResolution.conflict.conflictId}/resolve`, { resolution: 'KEEP_LOCAL' });
  assert(staleChoice.status === 409 && staleChoice.body.code === 'CONFLICT_STALE_VERSION', 'KEEP_LOCAL refuses a newer version changed after conflict presentation');

  await runLargeQueue(request, token, missionId, operatorId, make, batch, assert);
  const golden = await new Promise<{ passed: boolean; message?: string; keys?: string[]; serverId?: string }>((resolve, reject) => {
    const child = fork(path.resolve(__dirname, '../../../client/tests/golden.cjs'), [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Client/server golden scenario timed out')); }, 30_000);
    child.once('message', (message) => { clearTimeout(timeout); resolve(message as any); });
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => { if (code) { clearTimeout(timeout); reject(new Error(`Client/server golden process exited ${code}`)); } });
    child.send({ baseURL: 'http://127.0.0.1:5066/api/v1', token, missionId, operatorId });
  });
  assert(golden.passed, `Real client queue -> Express/MongoDB golden scenario${golden.message ? `: ${golden.message}` : ''}`);
  if (golden.passed) {
    assert(await Task.countDocuments({ missionId, title: 'Golden offline task' }) === 1, 'Golden response loss creates exactly one offline task');
    assert(await ProcessedMutation.countDocuments({ idempotencyKey: { $in: golden.keys } }) === 4, 'Golden offline chain has four durable server receipts');
    assert(await MissionEvent.countDocuments({ missionId, idempotencyKey: { $in: golden.keys } }) === 4, 'Golden offline chain has four nonduplicate MissionEvents');
  }
  assert(await SyncConflict.countDocuments({ missionId, status: 'OPEN' }) === 1, 'Only the intentionally stale resolution remains open in the isolated mission');
  const fieldObservation = { ...make('RECORD_OBSERVATION', `local-${randomUUID()}`, { text: 'Receipt authorization regression' }), actorId: operatorId };
  const fieldFirst = await post('/api/v1/sync', { mutations: [fieldObservation] }, operatorToken);
  assert(fieldFirst.body.data.results[0].status === 'SYNCED', 'Active operator can record a durable observation');
  await request.delete(`/api/v1/missions/${missionId}/members/${operatorId}`).set('Authorization', `Bearer ${token}`);
  const revokedRetry = await post('/api/v1/sync', { mutations: [fieldObservation] }, operatorToken);
  assert(revokedRetry.body.data.results[0].status === 'FAILED' && !revokedRetry.body.data.results[0].entity, 'A stored receipt never bypasses current mission authorization');
}

async function runLargeQueue(
  request: ReturnType<typeof supertest>, token: string, missionId: string, operatorId: string,
  make: (op: string, id: string, payload?: Record<string, unknown>, base?: string) => IncomingMutation,
  batch: (mutations: IncomingMutation[]) => Promise<any[]>,
  assert: (condition: boolean, message: string) => void
): Promise<void> {
  const mutations: IncomingMutation[] = [];
  for (let i = 0; i < 11; i++) {
    const id = `local-large-${randomUUID()}`;
    mutations.push(make('CREATE_TASK', id, { title: `Large server task ${i}` }));
    mutations.push(make('UPDATE_TASK', id, { description: `Large queue revision ${i}` }));
    mutations.push(make('ASSIGN_TASK', id, { userId: operatorId }));
    mutations.push(make('UPDATE_TASK_STATUS', id, { status: 'ACTIVE' }));
    mutations.push(make('RECORD_OBSERVATION', `local-${randomUUID()}`, { text: `Large queue observation ${i}` }));
  }
  const results: any[] = [];
  for (let offset = 0; offset < mutations.length; offset += 20) results.push(...await batch(mutations.slice(offset, offset + 20)));
  assert(results.length === 55 && results.every((r) => r.status === 'SYNCED'), '55 mixed mutations process across three server-sized batches');
  const ids = results.filter((r) => r.entityType === 'TASK').map((r) => r.serverId);
  assert(new Set(ids).size === 11, 'Large queue creates exactly 11 unique tasks');
  const tasks = await Task.find({ _id: { $in: ids } });
  assert(tasks.length === 11 && tasks.every((t) => t.status === 'ACTIVE' && t.assignedTo?.toString() === operatorId), 'Large queue final assignments and statuses match authoritative DB');
  const keys = mutations.map((m) => m.idempotencyKey);
  assert(await ProcessedMutation.countDocuments({ idempotencyKey: { $in: keys }, fingerprint: { $type: 'string' } }) === 55, 'Every large queue acknowledgement has a durable fingerprint receipt');
  assert(await MissionEvent.countDocuments({ missionId, idempotencyKey: { $in: keys } }) === 55, 'Large queue creates exactly one logical event per mutation');
  const retries: any[] = [];
  for (let offset = 0; offset < mutations.length; offset += 20) retries.push(...await batch(mutations.slice(offset, offset + 20)));
  assert(retries.every((r) => r.status === 'DUPLICATE'), 'Replaying all 55 requests returns only duplicates');
  assert(await MissionEvent.countDocuments({ missionId, idempotencyKey: { $in: keys } }) === 55, 'Full queue retry does not duplicate MissionEvents');
  const replay = await request.get(`/api/v1/missions/${missionId}/replay`).set('Authorization', `Bearer ${token}`);
  assert(replay.status === 200 && replay.body.data.events.filter((e: any) => keys.includes(e.idempotencyKey)).length === 55, 'Replay contains all 55 resulting immutable events');
}
