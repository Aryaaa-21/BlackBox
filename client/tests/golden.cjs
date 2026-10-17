// Invoked by the server integration runner with synthetic credentials over IPC.
// This executes the real client queue/API/Dexie code, NOT a browser renderer.
const assert = require('node:assert/strict');
const r = require('./runtime.cjs');
const { http } = require('../src/api/http.ts');

process.once('message', async ({ baseURL, token, missionId, operatorId }) => {
  try {
    await r.reset();
    http.defaults.baseURL = baseURL;
    http.defaults.headers.common.Authorization = `Bearer ${token}`;
    const profile = (await http.get('/auth/me')).data.data.user;
    await r.saveSession({ userId: profile.id, user: profile, token, savedAt: r.now });
    const online = await r.createTaskMutation(missionId, { title: 'Golden online task' }, { offline: true });
    await r.syncQueuedMutations();
    await r.changeTaskMutation(online.id, 'ASSIGN_TASK', { userId: operatorId }, { offline: true });
    await r.syncQueuedMutations();
    await r.changeTaskMutation(online.id, 'UPDATE_TASK_STATUS', { status: 'ACTIVE' }, { offline: true });
    await r.syncQueuedMutations();
    assert.equal((await r.getCachedTask(online.id)).status, 'ACTIVE');

    // Offline: persist then close/reopen the actual Dexie database after each action.
    const local = await r.createTaskMutation(missionId, { title: 'Golden offline task' }, { offline: true });
    await r.reopen();
    await r.changeTaskMutation(local.id, 'ASSIGN_TASK', { userId: operatorId }, { offline: true });
    await r.reopen();
    await r.changeTaskMutation(local.id, 'UPDATE_TASK_STATUS', { status: 'ACTIVE' }, { offline: true });
    await r.reopen();
    await r.recordObservationMutation(missionId, { text: 'Golden durable observation' }, true);
    const before = await r.getAccountMutations(profile.id);
    assert.equal(before.length, 4);
    await r.reopen();
    assert.deepEqual(await r.getAccountMutations(profile.id), before);
    assert.equal((await r.getCachedTask(local.id)).status, 'ACTIVE');
    assert.equal((await r.getCachedTask(local.id)).assignedTo, operatorId);

    // Real server commits the request; simulate losing only the response at the client boundary.
    const submit = r.syncApi.submit;
    let lost = true;
    r.syncApi.submit = async (...args) => {
      const response = await submit(...args);
      if (lost) { lost = false; throw Object.assign(new Error('Injected response loss'), { code: 'NETWORK_ERROR' }); }
      return response;
    };
    await assert.rejects(r.syncQueuedMutations(), /Injected response loss/);
    await r.reopen(); await r.due();
    const result = await r.syncQueuedMutations();
    assert.ok(result.duplicates >= 1);
    assert.equal((await r.getAccountMutations(profile.id)).length, 0);
    const serverId = await r.resolveEntityId('TASK', local.id);
    assert.notEqual(serverId, local.id);
    const serverTask = (await http.get(`/tasks/${serverId}`)).data.data.task;
    assert.equal(serverTask.status, 'ACTIVE');
    assert.equal(serverTask.assignedTo.id || serverTask.assignedTo, operatorId);
    assert.equal((await r.getCachedTask(local.id)).id, serverId);
    const replay = (await http.get(`/missions/${missionId}/replay`)).data.data;
    const keys = before.map((mutation) => mutation.idempotencyKey);
    assert.equal(replay.events.filter((event) => keys.includes(event.idempotencyKey)).length, 4);
    await r.db.close();
    process.send({ passed: true, keys, serverId });
  } catch (error) {
    process.send({ passed: false, message: error.message });
  } finally {
    process.disconnect();
  }
});
