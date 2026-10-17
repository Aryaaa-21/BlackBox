const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

const root = path.resolve(__dirname, '../../..');
const serverRoot = path.join(root, 'server');
const clientRoot = path.join(root, 'client');
const browserStateFile = path.join(__dirname, 'browser-state.json');
let mongo;
let server;
let client;

function spawnNode(args, cwd, env) {
  return spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
}

function waitFor(child, label) {
  let output = '';
  child.stdout.on('data', (chunk) => { output = (output + chunk.toString()).slice(-8000); });
  child.stderr.on('data', (chunk) => { output = (output + chunk.toString()).slice(-8000); });
  child.__output = () => output;
  child.on('error', (error) => { child.__spawnError = error; });
  return async () => {
    if (child.__spawnError) throw child.__spawnError;
    if (!child.killed && child.exitCode !== null) throw new Error(`${label} exited with ${child.exitCode}: ${output}`);
  };
}

async function waitHttp(url, label, timeout = 60_000) {
  const started = Date.now();
  let last = '';
  while (Date.now() - started < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      last = `${response.status}`;
    } catch (error) { last = error.message; }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} did not become ready: ${last}`);
}

async function seedDatabase(uri) {
  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'phase4-browser-test-secret-012345678901234567890';
  process.env.ENABLE_DEMO_MODE = 'false';
  require('ts-node/register/transpile-only');
  const mongoose = require(path.join(root, 'node_modules/mongoose'));
  const { User } = require(path.join(serverRoot, 'src/models/User'));
  const { Mission } = require(path.join(serverRoot, 'src/models/Mission'));
  const { MissionMember } = require(path.join(serverRoot, 'src/models/MissionMember'));
  const { Task } = require(path.join(serverRoot, 'src/models/Task'));
  const { MissionEvent } = require(path.join(serverRoot, 'src/models/MissionEvent'));
  const { hashPassword } = require(path.join(serverRoot, 'src/utils/jwt'));
  await mongoose.connect(uri);
  await Promise.all([User, Mission, MissionMember, Task].map((model) => model.deleteMany({})));
  await MissionEvent.collection.deleteMany({});
  const passwordHash = await hashPassword('BrowserTest123!');
  const [commander, operator] = await User.create([
    { name: 'Browser Commander', email: 'commander@browser.test', role: 'COMMANDER', passwordHash, isActive: true },
    { name: 'Browser Operator', email: 'operator@browser.test', role: 'FIELD_OPERATOR', passwordHash, isActive: true },
  ]);
  const mission = await Mission.create({ title: 'Browser Acceptance Mission', description: 'Real browser acceptance fixture', location: 'Browser Test Zone', severity: 'HIGH', status: 'ACTIVE', createdBy: commander._id, startedAt: new Date() });
  await MissionMember.create([{ missionId: mission._id, userId: commander._id, role: 'COMMANDER', status: 'ACTIVE', joinedAt: new Date() }, { missionId: mission._id, userId: operator._id, role: 'FIELD_OPERATOR', status: 'ACTIVE', joinedAt: new Date() }]);
  const task = await Task.create({ missionId: mission._id, title: 'Browser Fixture Task', description: 'Seeded for UI acceptance', priority: 'HIGH', status: 'PENDING', createdBy: commander._id });
  await MissionEvent.create({ missionId: mission._id, actorId: commander._id, eventType: 'MISSION_CREATED', targetType: 'MISSION', targetId: mission._id, source: 'SYSTEM', payload: { title: mission.title, description: mission.description, location: mission.location, severity: mission.severity, status: 'DRAFT', createdBy: commander._id.toString(), createdAt: mission.createdAt.toISOString(), updatedAt: mission.updatedAt.toISOString() } });
  await MissionEvent.create({ missionId: mission._id, actorId: commander._id, eventType: 'MISSION_STARTED', targetType: 'MISSION', targetId: mission._id, source: 'SYSTEM', payload: { title: mission.title, status: 'ACTIVE', startedAt: mission.startedAt.toISOString(), createdAt: mission.createdAt.toISOString(), updatedAt: mission.updatedAt.toISOString() } });
  await MissionEvent.create({ missionId: mission._id, actorId: commander._id, eventType: 'TASK_CREATED', targetType: 'TASK', targetId: task._id, source: 'SYSTEM', payload: { taskId: task._id.toString(), title: task.title, description: task.description, priority: task.priority, status: task.status, createdBy: commander._id.toString(), createdAt: task.createdAt.toISOString(), updatedAt: task.updatedAt.toISOString() } });
  await mongoose.disconnect();
  return { missionId: mission.id, taskId: task.id };
}

module.exports = async function globalSetup() {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  const uri = mongo.getUri('blackbox_phase4_browser');
  const fixture = await seedDatabase(uri);
  const env = { ...process.env, NODE_ENV: 'test', MONGODB_URI: uri, JWT_SECRET: 'phase4-browser-test-secret-012345678901234567890', PORT: '5001', CLIENT_URL: 'http://127.0.0.1:5174', ENABLE_DEMO_MODE: 'false' };
  server = spawnNode([path.join(root, 'node_modules/ts-node/dist/bin.js'), 'src/server.ts'], serverRoot, env);
  waitFor(server, 'backend');
  // Serve the production bundle so the browser suite exercises the service
  // worker and real offline shell, not Vite's development-only module graph.
  client = spawnNode([path.join(root, 'node_modules/vite/bin/vite.js'), 'preview', '--host', '127.0.0.1', '--port', '5174'], clientRoot, { ...env, VITE_API_URL: 'http://127.0.0.1:5001/api/v1', VITE_SOCKET_URL: 'http://127.0.0.1:5001' });
  waitFor(client, 'frontend');
  await waitHttp('http://127.0.0.1:5001/api/v1/health', 'backend health');
  await waitHttp('http://127.0.0.1:5174/', 'frontend');
  fs.writeFileSync(browserStateFile, JSON.stringify({ ...fixture, apiURL: 'http://127.0.0.1:5001/api/v1' }), 'utf8');
  return async () => {
    for (const child of [client, server]) if (child && !child.killed) child.kill();
    await new Promise((resolve) => setTimeout(resolve, 500));
    if (mongo) await mongo.stop();
    try { fs.rmSync(browserStateFile, { force: true }); } catch { void 0; }
  };
};
