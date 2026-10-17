// Run the real TypeScript client modules with Node's test runner and IndexedDB adapter.
require('fake-indexeddb/auto');
const fs = require('node:fs');
const { transformSync } = require('esbuild');
require.extensions['.ts'] = (module, filename) => {
  const { code } = transformSync(fs.readFileSync(filename, 'utf8'), {
    loader: 'ts', format: 'cjs', target: 'node24',
    define: { 'import.meta.env': '{"DEV":false,"PROD":false}' },
    logLevel: 'silent',
  });
  module._compile(code, filename);
};
const database = require('../src/db/index.ts');
const sync = require('../src/services/sync.ts');
const policy = require('../src/services/sync-policy.ts');
const mutations = require('../src/services/mutations.ts');
const { syncApi } = require('../src/api/sync.ts');
const { connectivity } = require('../src/services/connectivity.ts');
const account = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const mission = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const operator = 'cccccccccccccccccccccccc';
const now = '2026-10-16T00:00:00.000Z';
const user = { id: account, name: 'Sync Test', email: 'sync@example.test', role: 'COMMANDER', isActive: true, createdAt: now, updatedAt: now };
async function reset() {
  await database.db.open();
  await database.db.transaction('rw', database.db.tables, async () => {
    for (const table of database.db.tables) await table.clear();
  });
  await database.saveSession({ userId: account, user, token: 'test-only-token', savedAt: now });
  connectivity.snapshot = { browser: 'offline', api: 'unreachable' };
}
async function reopen() { database.db.close(); await database.db.open(); }
async function due() {
  await database.db.mutations.toCollection().modify({ nextAttemptAt: undefined });
}
function envelope(results) {
  return { results, synced: results.filter((r) => r.status === 'SYNCED').length, duplicates: results.filter((r) => r.status === 'DUPLICATE').length, conflicts: results.filter((r) => r.status === 'CONFLICT').length, failed: results.filter((r) => r.status === 'FAILED').length, remaining: 0 };
}
// A deterministic boundary model; server behavior is independently tested against MongoDB.
function server() {
  const receipts = new Map(), tasks = new Map(), events = new Map(), requests = [];
  let seq = 0;
  async function submit(batch) {
    requests.push(structuredClone(batch));
    const results = [];
    for (const mutation of batch) {
      const existing = receipts.get(mutation.idempotencyKey);
      if (existing) { results.push({ ...existing, status: 'DUPLICATE' }); continue; }
      let entity;
      if (mutation.operationType === 'CREATE_TASK') {
        const id = (++seq).toString(16).padStart(24, '0');
        entity = { ...mutation.payload, id, missionId: mutation.missionId, status: 'PENDING', assignedTo: mutation.payload.assignedTo || null, createdBy: account, createdAt: now, updatedAt: new Date(Date.parse(now) + seq * 100).toISOString() };
      } else if (mutation.operationType === 'RECORD_OBSERVATION') {
        entity = { id: (++seq).toString(16).padStart(24, '0'), missionId: mission, actorId: account, eventType: 'OBSERVATION_RECORDED', payload: mutation.payload, source: 'USER', idempotencyKey: mutation.idempotencyKey, createdAt: now, updatedAt: now };
      } else {
        if (mutation.entityId.startsWith('local-') || !tasks.has(mutation.entityId)) throw new Error('Unresolved dependency reached transport');
        entity = policy.applyTaskMutation(tasks.get(mutation.entityId), mutation);
        entity.updatedAt = new Date(Date.parse(now) + (++seq) * 100).toISOString();
      }
      if (mutation.entityType === 'TASK') tasks.set(entity.id, entity);
      events.set(mutation.idempotencyKey, entity);
      const result = { mutationId: mutation.mutationId, idempotencyKey: mutation.idempotencyKey, status: 'SYNCED', entityType: mutation.entityType, localId: mutation.entityId, serverId: entity.id, entity };
      receipts.set(mutation.idempotencyKey, result);
      results.push(result);
    }
    return envelope(results);
  }
  return { submit, receipts, tasks, events, requests };
}
module.exports = { ...database, ...sync, ...policy, ...mutations, syncApi, connectivity, account, mission, operator, now, reset, reopen, due, envelope, server };
