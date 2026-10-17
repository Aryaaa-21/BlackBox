import supertest from 'supertest';
import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { performance } from 'perf_hooks';
import { Mission } from '../models/Mission';
import { Task } from '../models/Task';
import { User } from '../models/User';
import { MissionEvent } from '../models/MissionEvent';
import { ProcessedMutation } from '../models/ProcessedMutation';
import { SyncConflict } from '../models/SyncConflict';
import { SyncService, IncomingMutation } from '../services/sync.service';
import { missionEventService } from '../services/missionEvent.service';
import { afterCommit, withUnitOfWork } from '../services/unitOfWork';
import { getIO } from '../sockets/socket';
import { EventSource, EventTargetType, MissionEventType, UserPayload } from '../types';

type Assert = (condition: boolean, message: string) => void;

/** Real replica-set integration. Fault injection replaces only the failing boundary. */
export async function runPhase3Tests(
  request: ReturnType<typeof supertest>, token: string, operatorToken: string,
  commanderId: string, operatorId: string, assert: Assert
): Promise<void> {
  console.log('\n--- PHASE 3 ATOMICITY / CONCURRENCY / REPLAY ---');
  const post = (url: string, body: object, auth = token) => request.post(url).set('Authorization', `Bearer ${auth}`).send(body);
  const created = await post('/api/v1/missions', { title: 'Phase 3 isolated mission', description: 'Synthetic consistency fixtures', location: 'Test zone', severity: 'HIGH' });
  const missionId: string = created.body.data.mission.id;
  await post(`/api/v1/missions/${missionId}/start`, {});
  await post(`/api/v1/missions/${missionId}/members`, { userId: operatorId });
  const user = { id: commanderId, role: 'COMMANDER' } as UserPayload;
  const make = (operationType: string, entityId: string, payload: Record<string, unknown>, baseVersion?: number): IncomingMutation => {
    const time = new Date().toISOString();
    return { mutationId: randomUUID(), idempotencyKey: randomUUID(), missionId, entityType: operationType === 'RECORD_OBSERVATION' ? 'EVENT' : 'TASK', operationType, entityId, payload, baseVersion, actorId: commanderId, deviceId: 'phase3-test', createdAt: time, clientCreatedAt: time };
  };
  // Different service instances intentionally do NOT share their in-process locks.
  const one = async (mutation: IncomingMutation) => (await new SyncService().syncMutations([mutation], user)).results[0];
  const io = getIO();
  const originalTo = io.to;
  let notifications: string[] = [];
  (io as any).to = () => ({ emit: (name: string) => { notifications.push(name); } });
  try {
    for (const stage of ['entity', 'event', 'receipt', 'commit']) {
      const mutation = make('CREATE_TASK', `local-${randomUUID()}`, { title: `Rollback ${stage}` });
      const model = stage === 'entity' ? Task : stage === 'event' ? MissionEvent : ProcessedMutation;
      const originalSave = model.prototype.save;
      const originalStart = mongoose.connection.startSession;
      if (stage === 'commit') {
        (mongoose.connection as any).startSession = async (...args: any[]) => {
          const session = await (originalStart as any).apply(mongoose.connection, args);
          session.commitTransaction = async () => { throw new Error('Injected commit failure before commit'); };
          return session;
        };
      } else {
        (model.prototype as any).save = async function (...args: any[]) {
          await (originalSave as any).apply(this, args);
          throw new Error(`Injected ${stage} write failure after persistence`);
        };
      }
      notifications = [];
      let result;
      try { result = await one(mutation); }
      finally { model.prototype.save = originalSave as any; mongoose.connection.startSession = originalStart; }
      assert(result.status === 'FAILED', `${stage} failure cannot acknowledge SYNCED`);
      assert(await Task.countDocuments({ missionId, title: `Rollback ${stage}` }) === 0, `${stage} failure rolls back entity`);
      assert(await MissionEvent.countDocuments({ missionId, idempotencyKey: mutation.idempotencyKey }) === 0, `${stage} failure rolls back MissionEvent`);
      assert(await ProcessedMutation.countDocuments({ idempotencyKey: mutation.idempotencyKey }) === 0, `${stage} failure leaves no success receipt`);
      assert(notifications.length === 0, `${stage} failure emits no operational socket notifications`);
      const retry = await one(mutation);
      assert(retry.status === 'SYNCED' && notifications.includes('task:created'), `${stage} failure permits exact-key retry and post-commit notification`);
      assert((await one(mutation)).status === 'DUPLICATE', `${stage} recovered write remains idempotent`);
    }
  } finally { io.to = originalTo; }

  let callbacks = 0;
  let attempts = 0;
  await withUnitOfWork(async () => {
    attempts++;
    afterCommit(() => { callbacks++; });
    if (attempts === 1) throw Object.assign(new Error('Injected labelled transient error'), { errorLabels: ['TransientTransactionError'] });
  });
  assert(attempts === 2 && callbacks === 1, 'Transaction retry discards callbacks from aborted attempt');

  const concurrent = make('CREATE_TASK', `local-${randomUUID()}`, { title: 'Cross-instance same key' });
  const duplicates = await Promise.all([one(concurrent), one(concurrent)]);
  assert(duplicates.map((r) => r.status).sort().join(',') === 'DUPLICATE,SYNCED', 'Independent service instances coordinate duplicate CREATE through MongoDB');
  assert(await Task.countDocuments({ missionId, title: concurrent.payload.title }) === 1 && await MissionEvent.countDocuments({ missionId, idempotencyKey: concurrent.idempotencyKey }) === 1, 'Cross-instance race commits one entity and one event');
  const collision = make('CREATE_TASK', `local-${randomUUID()}`, { title: 'Cross-instance collision owner' });
  const collisions = await Promise.all([one(collision), one({ ...collision, payload: { title: 'Cross-instance collision other' } })]);
  assert(collisions.filter((r) => r.status === 'SYNCED').length === 1 && collisions.some((r) => r.errorCode === 'IDEMPOTENCY_KEY_REUSED'), 'Cross-instance changed-payload collision has one winner');
  assert(await Task.countDocuments({ missionId, title: { $in: ['Cross-instance collision owner', 'Cross-instance collision other'] } }) === 1, 'Losing key-collision transaction rolls back its entity');

  for (const scenario of ['same field', 'different fields', 'assignment versus status', 'edit versus status']) {
    const fresh = await one(make('CREATE_TASK', `local-${randomUUID()}`, { title: `Version race ${scenario}` }));
    const taskId = fresh.serverId!;
    const base = fresh.entity!.version as number;
    const left = scenario === 'assignment versus status'
      ? make('ASSIGN_TASK', taskId, { userId: operatorId }, base)
      : make('UPDATE_TASK', taskId, { title: 'Winning or rejected title' }, base);
    const right = scenario.includes('status')
      ? make('UPDATE_TASK_STATUS', taskId, { status: 'ACTIVE' }, base)
      : make('UPDATE_TASK', taskId, scenario === 'same field' ? { title: 'Other title' } : { description: 'Other field' }, base);
    const results = await Promise.all([one(left), one(right)]);
    assert(results.map((r) => r.status).sort().join(',') === 'CONFLICT,SYNCED', `${scenario}: same base has one success and one deterministic conflict`);
    const task = await Task.findById(taskId);
    assert(task?.version === base + 1, `${scenario}: entity version advances exactly once`);
    const conflict = results.find((r) => r.status === 'CONFLICT')!;
    const resolved = await Promise.all([
      post(`/api/v1/sync/conflicts/${conflict.conflict!.conflictId}/resolve`, { resolution: 'KEEP_LOCAL', expectedServerVersion: task!.version }),
      post(`/api/v1/sync/conflicts/${conflict.conflict!.conflictId}/resolve`, { resolution: 'KEEP_LOCAL', expectedServerVersion: task!.version }),
    ]);
    assert(resolved.every((r) => r.status === 200) && resolved[0].body.data.newMutation.mutationId === resolved[1].body.data.newMutation.mutationId, `${scenario}: double resolution replays one identity`);
    const after = await Task.findById(taskId);
    assert(after?.version === base + 2 && await MissionEvent.countDocuments({ missionId, eventType: 'CONFLICT_RESOLVED', 'payload.conflictId': conflict.conflict!.conflictId }) === 1, `${scenario}: resolution increments once and has one audit event`);
  }

  const observationA = make('RECORD_OBSERVATION', `local-${randomUUID()}`, { text: 'Simultaneous observation A' });
  const observationB = make('RECORD_OBSERVATION', `local-${randomUUID()}`, { text: 'Simultaneous observation B' });
  const missionBefore = await Mission.findById(missionId);
  assert((await Promise.all([one(observationA), one(observationB)])).every((r) => r.status === 'SYNCED'), 'Simultaneous distinct observations both commit');
  assert((await Mission.findById(missionId))?.version === missionBefore?.version, 'Event clock does not increment mission entity version');
  const chronological = await MissionEvent.find({ missionId }).sort({ createdAt: 1, _id: 1 });
  assert(chronological.every((event, i) => !i || event.createdAt > chronological[i - 1].createdAt), 'Concurrent operational appends have strictly increasing causal timestamps');

  await verifyHistory(request, token, operatorToken, missionId, commanderId, operatorId, assert);
}

async function verifyHistory(
  request: ReturnType<typeof supertest>, token: string, operatorToken: string,
  missionId: string, commanderId: string, operatorId: string, assert: Assert
): Promise<void> {
  const auth = (url: string, selected = token) => request.get(url).set('Authorization', `Bearer ${selected}`);
  const event = (await MissionEvent.findOne({ missionId }))!;
  const originalPayload = JSON.stringify(event.payload);
  const forbidden: Array<() => PromiseLike<unknown>> = [
    () => MissionEvent.updateOne({ _id: event._id }, { $set: { payload: { altered: true } } }),
    () => MissionEvent.findByIdAndUpdate(event._id, { $set: { eventType: 'TASK_CREATED' } }),
    () => MissionEvent.replaceOne({ _id: event._id }, { missionId }),
    () => MissionEvent.deleteMany({ missionId }),
    () => event.deleteOne(),
    () => MissionEvent.bulkWrite([{ deleteOne: { filter: { _id: event._id } } }]),
    () => { event.payload = { altered: true }; return event.save(); },
  ];
  for (const [i, operation] of forbidden.entries()) {
    let code;
    try { await operation(); } catch (error) { code = (error as any).code; }
    assert(code === 'MISSION_EVENT_IMMUTABLE', `Immutable history rejects ordinary mutation path ${i + 1}`);
  }
  assert(JSON.stringify((await MissionEvent.findById(event._id))!.payload) === originalPayload, 'Rejected event edits leave persisted history unchanged');

  const actor = (await User.findById(commanderId))!;
  const input = { missionId, actorId: commanderId, eventType: MissionEventType.OBSERVATION_RECORDED, targetType: EventTargetType.OBSERVATION, source: EventSource.USER, idempotencyKey: randomUUID(), payload: { text: 'Historical snapshot', actor: { name: 'Spoofed' }, actorName: 'Spoofed alias', items: [{ text: 'safe', token: 'synthetic-redacted' }] } };
  const snapshot = await missionEventService.createMissionEvent(input);
  assert((snapshot.payload.actor as any).name === actor.name && !snapshot.payload.actorName, 'Historical actor snapshot is server-derived, not caller-spoofed');
  assert(Array.isArray(snapshot.payload.items) && !(snapshot.payload.items as any[])[0].token, 'Recursive sanitation preserves array shape while removing credentials');
  try {
    await User.updateOne({ _id: commanderId }, { $set: { name: 'Changed current display name' } });
    const replayed = await missionEventService.createMissionEvent(input);
    assert(replayed.id === snapshot.id, 'Idempotent event retry survives a current actor rename');
    const history = await auth(`/api/v1/missions/${missionId}/replay`);
    assert(history.body.data.events.find((e: any) => e.id === snapshot.id).actor.name === actor.name, 'Replay uses immutable actor label rather than current User');
  } finally { await User.updateOne({ _id: commanderId }, { $set: { name: actor.name } }); }

  // A legacy entity without __v must remain editable and expose one counter.
  const legacyId = new mongoose.Types.ObjectId();
  await Task.collection.insertOne({ _id: legacyId, missionId: new mongoose.Types.ObjectId(missionId), createdBy: new mongoose.Types.ObjectId(commanderId), title: 'Legacy versionless task', description: '', priority: 'MEDIUM', status: 'PENDING', assignedTo: null, createdAt: new Date(), updatedAt: new Date() } as any);
  const legacyResult = await request.patch(`/api/v1/tasks/${legacyId}`).set('Authorization', `Bearer ${token}`).send({ title: 'Legacy edited' });
  assert(legacyResult.status === 200 && legacyResult.body.data.task.version === 1, 'Legacy versionless task upgrades to version 1 on first operational edit');

  // Existing-entity failure must undo version/timestamps as well as field data.
  const taskBefore = (await Task.findById(legacyId))!.toJSON();
  const saveEvent = MissionEvent.prototype.save;
  (MissionEvent.prototype as any).save = async () => { throw new Error('Injected update event failure'); };
  let failed;
  try { failed = await request.patch(`/api/v1/tasks/${legacyId}`).set('Authorization', `Bearer ${token}`).send({ title: 'Must roll back' }); }
  finally { MissionEvent.prototype.save = saveEvent; }
  const taskAfter = (await Task.findById(legacyId))!.toJSON();
  assert(failed.status === 500 && JSON.stringify(taskBefore) === JSON.stringify(taskAfter), 'Failed task update rolls back entity fields, version and timestamps');

  const created = await request.post('/api/v1/missions').set('Authorization', `Bearer ${token}`).send({ title: 'Phase 3 replay pagination fixture', description: 'Synthetic replay data', location: 'Test zone', severity: 'LOW' });
  const replayMission: string = created.body.data.mission.id;
  await request.post(`/api/v1/missions/${replayMission}/members`).set('Authorization', `Bearer ${token}`).send({ userId: operatorId });
  const start = Date.parse('2025-01-01T00:00:00.000Z');
  const fixtures = Array.from({ length: 500 }, (_, i) => ({
    _id: new mongoose.Types.ObjectId(i.toString(16).padStart(24, '0')),
    missionId: new mongoose.Types.ObjectId(replayMission), actorId: new mongoose.Types.ObjectId(commanderId),
    eventType: 'OBSERVATION_RECORDED', targetType: 'OBSERVATION', source: 'USER',
    payload: { text: `Fixture ${i}`, actor: { name: 'Historical fixture actor' } },
    createdAt: new Date(start + Math.floor(i / 5) * 1000), updatedAt: new Date(start),
  }));
  // Raw collection inserts are fixture construction, not a production event-edit API.
  await MissionEvent.collection.insertMany([...fixtures].reverse() as any);
  await MissionEvent.collection.insertMany([
    { ...fixtures[0], _id: new mongoose.Types.ObjectId(), source: 'LOCAL' },
    { ...fixtures[0], _id: new mongoose.Types.ObjectId(), syncState: 'PENDING' },
    { ...fixtures[0], _id: new mongoose.Types.ObjectId(), eventType: 'FUTURE_EVENT', payload: 'malformed legacy root' },
  ] as any);
  const url = `/api/v1/missions/${replayMission}/replay`;
  const first = await auth(url).query({ limit: 61, eventType: 'OBSERVATION_RECORDED' });
  assert(first.status === 200 && first.body.data.pagination.total === 500, 'Replay excludes LOCAL and PENDING fixtures from authoritative total');
  assert(first.body.data.summary.scope === 'PAGE' && first.body.data.summary.totalEvents === 61, 'Page summary declares its returned-event scope');
  const cursor = first.body.data.pagination.nextCursor;
  assert(typeof cursor === 'string' && first.body.data.pagination.hasMore, 'First replay page returns a bounded cursor');
  await missionEventService.recordObservation(replayMission, { id: commanderId, role: 'COMMANDER' } as UserPayload, { text: 'Append after first-page high water' });
  const ids: string[] = first.body.data.events.map((e: any) => e.id);
  let page = first.body.data;
  while (page.pagination.hasMore && ids.length < 1000) {
    const response = await auth(url).query({ limit: 61, eventType: 'OBSERVATION_RECORDED', cursor: page.pagination.nextCursor });
    if (response.status !== 200) throw new Error(`Replay page failed: ${response.status}`);
    page = response.body.data;
    ids.push(...page.events.map((e: any) => e.id));
  }
  assert(ids.length === 500 && new Set(ids).size === 500 && ids.every((id, i) => id === fixtures[i]._id.toHexString()), '500-event cursor drain is stable across identical timestamps, without skips/duplicates/new appends');
  assert(page.pagination.nextCursor === null && !page.pagination.hasMore && page.pagination.total === 500, 'Final cursor page preserves high-water total and ends explicitly');
  const from = new Date(start + 10_000).toISOString();
  const to = new Date(start + 12_000).toISOString();
  const window = await auth(url).query({ from, to, eventType: 'OBSERVATION_RECORDED', limit: 100 });
  assert(window.body.data.events.length === 15 && window.body.data.events.every((e: any) => e.createdAt >= from && e.createdAt <= to), 'from/to filters include both timestamp boundaries');
  assert((await auth(url).query({ from: '2030-01-01', to: '2030-01-02' })).body.data.events.length === 0, 'Empty replay window returns a safe empty stream');
  const unknown = await auth(url).query({ eventType: 'FUTURE_EVENT' });
  assert(unknown.body.data.events.length === 1 && unknown.body.data.events[0].payload.legacyPayload === 'malformed legacy root', 'Unknown event and malformed legacy payload remain inspectable');
  for (const query of [
    { cursor: `${cursor}x`, eventType: 'OBSERVATION_RECORDED' },
    { cursor, eventType: 'TASK_CREATED' },
    { cursor, eventType: 'OBSERVATION_RECORDED', from },
    { from: '2025-02-30' }, { from: to, to: from },
    { limit: 0 }, { limit: 5001 }, { limit: 1.5 },
  ]) {
    assert((await auth(url).query(query)).status === 400, `Replay rejects invalid cursor/filter/date/limit ${JSON.stringify(Object.keys(query))}`);
  }
  assert((await auth(`/api/v1/missions/${missionId}/replay`).query({ cursor, eventType: 'OBSERVATION_RECORDED' })).status === 400, 'Cursor cannot be reused for another mission');
  assert((await auth(url, operatorToken).query({ limit: 5 })).status === 200, 'Active member may read replay');
  await request.delete(`/api/v1/missions/${replayMission}/members/${operatorId}`).set('Authorization', `Bearer ${token}`);
  assert((await auth(url, operatorToken).query({ cursor, eventType: 'OBSERVATION_RECORDED' })).status === 403, 'Membership revocation is checked again on every cursor page');
  assert((await request.get(url)).status === 401, 'Replay rejects unauthenticated access');

  for (const count of [100, 500]) {
    const samples: number[] = [];
    for (let i = 0; i < 3; i++) {
      const before = performance.now();
      const response = await auth(url).query({ eventType: 'OBSERVATION_RECORDED', limit: count });
      samples.push(performance.now() - before);
      assert(response.status === 200 && response.body.data.events.length === count, `Measured replay returns ${count} events (sample ${i + 1})`);
    }
    samples.sort((a, b) => a - b);
    console.log(`[PHASE3_PERF] replay ${count} events: median=${samples[1].toFixed(2)}ms min=${samples[0].toFixed(2)}ms max=${samples[2].toFixed(2)}ms (local HTTP + replica-set Mongo, 3 samples)`);
  }
  assert(await SyncConflict.countDocuments({ missionId, status: 'OPEN' }) === 0, 'All concurrency fixtures finish with resolved conflicts');
}
