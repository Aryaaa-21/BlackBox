import http from 'http';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { config } from '../config/env';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { initializeSockets } from '../sockets/socket';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import supertest from 'supertest';
import { User } from '../models/User';
import { Mission } from '../models/Mission';
import { MissionEvent } from '../models/MissionEvent';
import { missionEventService } from '../services/missionEvent.service';
import { MissionEventType, EventTargetType, EventSource } from '../types';

async function runTests() {
  console.log('\n--- STARTING BLACKBOX PHASE 2 TEST SUITE ---\n');
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, testName: string) => {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  };

  try {
    // 1. Connect Database
    console.log('[Test Setup] Connecting database...');
    await connectDatabase();
    assert(true, 'Database connection established');

    // Clean up test users
    await User.deleteMany({ email: /test.*@blackbox\.local/i });

    // 2. Setup server for integration and socket testing
    const app = createApp();
    const httpServer = http.createServer(app);
    initializeSockets(httpServer);

    const testPort = 5066;
    await new Promise<void>((resolve) => httpServer.listen(testPort, resolve));

    const request = supertest(app);

    // 3. Test Health Endpoints
    const healthRes = await request.get('/api/v1/health');
    assert(healthRes.status === 200, 'GET /api/v1/health returns 200 OK');
    assert(healthRes.body.success === true, 'GET /api/v1/health has standard success format');

    // 4. Test Registration (Commander)
    const commanderEmail = `test.commander.${Date.now()}@blackbox.local`;
    const regCommanderRes = await request.post('/api/v1/auth/register').send({
      name: 'Commander Sarah Vance',
      email: commanderEmail,
      password: 'TacticalPassword123!',
      role: 'COMMANDER',
    });

    assert(regCommanderRes.status === 201, 'POST /api/v1/auth/register (Commander) returns 201 Created');
    assert(regCommanderRes.body.success === true, 'Register response format is standard');
    assert(Boolean(regCommanderRes.body.data.token), 'Register returns JWT token');
    assert(regCommanderRes.body.data.user.role === 'COMMANDER', 'Register assigns COMMANDER role');
    assert(regCommanderRes.body.data.user.isActive === true, 'User is initialized with isActive=true');
    assert(!regCommanderRes.body.data.user.passwordHash, 'Password hash is NOT exposed in response');

    // Check HTTP-only cookie set
    const setCookieRaw = regCommanderRes.header['set-cookie'];
    const cookiesArray = Array.isArray(setCookieRaw) ? setCookieRaw : [setCookieRaw || ''];
    assert(
      cookiesArray.some((c: string) => c.includes('blackbox_token') && c.includes('HttpOnly')),
      'Register sets secure HTTP-only blackbox_token cookie'
    );

    // 5. Test Registration (Field Operator)
    const operatorEmail = `test.operator.${Date.now()}@blackbox.local`;
    const regOperatorRes = await request.post('/api/v1/auth/register').send({
      name: 'Operator Logan Vance',
      email: operatorEmail,
      password: 'TacticalPassword123!',
      role: 'FIELD_OPERATOR',
    });

    assert(regOperatorRes.status === 201, 'POST /api/v1/auth/register (Field Operator) returns 201 Created');
    assert(regOperatorRes.body.data.user.role === 'FIELD_OPERATOR', 'Register assigns FIELD_OPERATOR role');

    // 6. Security Scenario 3: Reject Arbitrary Role Assignment (e.g. ADMIN)
    const badRoleRes = await request.post('/api/v1/auth/register').send({
      name: 'Rogue Operator',
      email: `rogue.${Date.now()}@blackbox.local`,
      password: 'Password123!',
      role: 'ADMIN',
    });
    assert(badRoleRes.status === 400, 'Server rejects unauthorized arbitrary role assignment (ADMIN) with 400 Bad Request');

    // 7. Duplicate Email Registration
    const dupRes = await request.post('/api/v1/auth/register').send({
      name: 'Duplicate Commander',
      email: commanderEmail,
      password: 'AnotherPassword123!',
    });
    assert(dupRes.status === 409, 'Duplicate email registration returns 409 Conflict');
    assert(dupRes.body.code === 'EMAIL_ALREADY_EXISTS', 'Duplicate email returns standard EMAIL_ALREADY_EXISTS code');

    // 8. Security Scenario 4: Login Wrong Password
    const badPasswordRes = await request.post('/api/v1/auth/login').send({
      email: commanderEmail,
      password: 'WrongPassword!',
    });
    assert(badPasswordRes.status === 401, 'Login with wrong password returns 401 Unauthorized');
    assert(badPasswordRes.body.code === 'INVALID_CREDENTIALS', 'Returns generic INVALID_CREDENTIALS code');

    // 9. Security Scenario 5: Inactive Account Login Rejection
    const inactiveEmail = `test.inactive.${Date.now()}@blackbox.local`;
    const inactiveUser = new User({
      name: 'Deactivated Unit',
      email: inactiveEmail,
      passwordHash: regCommanderRes.body.data.token, // Dummy hash
      role: 'FIELD_OPERATOR',
      isActive: false,
    });
    await inactiveUser.save();

    const inactiveLoginRes = await request.post('/api/v1/auth/login').send({
      email: inactiveEmail,
      password: 'AnyPassword123!',
    });
    assert(inactiveLoginRes.status === 403, 'Inactive account login is rejected with 403 Forbidden');
    assert(inactiveLoginRes.body.code === 'ACCOUNT_INACTIVE', 'Inactive login returns ACCOUNT_INACTIVE code');

    // 10. Login Success & lastLoginAt Update
    const loginRes = await request.post('/api/v1/auth/login').send({
      email: commanderEmail,
      password: 'TacticalPassword123!',
    });
    assert(loginRes.status === 200, 'POST /api/v1/auth/login returns 200 OK');
    assert(Boolean(loginRes.body.data.token), 'Login returns JWT token');
    assert(Boolean(loginRes.body.data.user.lastLoginAt), 'Login updates user lastLoginAt timestamp');
    const commanderToken = loginRes.body.data.token;
    const operatorToken = regOperatorRes.body.data.token;

    // 11. Security Scenario 1: Unauthenticated request to /api/v1/auth/me
    const meNoAuth = await request.get('/api/v1/auth/me');
    assert(meNoAuth.status === 401, 'Unauthenticated request to GET /api/v1/auth/me returns 401');

    // 12. Authenticated request using Bearer Header
    const meBearer = await request
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(meBearer.status === 200, 'GET /api/v1/auth/me with Bearer token returns 200 OK');
    assert(meBearer.body.data.user.email === commanderEmail, 'Returns commander profile');
    assert(meBearer.body.data.user.role === 'COMMANDER', 'Returns verified COMMANDER role');

    // 13. Authenticated request using HTTP-only Cookie
    const meCookie = await request
      .get('/api/v1/auth/me')
      .set('Cookie', [`blackbox_token=${commanderToken}`]);
    assert(meCookie.status === 200, 'GET /api/v1/auth/me with HTTP-only cookie returns 200 OK');

    // 14. Security Scenario 7: Malformed JWT
    const malformedRes = await request
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer this.is.not.a.valid.jwt');
    assert(malformedRes.status === 401, 'Malformed JWT returns 401 Unauthorized');

    // 15. Security Scenario 6: Expired JWT
    const expiredToken = jwt.sign(
      { id: 'dummy_id', email: commanderEmail, role: 'COMMANDER', name: 'Commander' },
      config.jwtSecret,
      { expiresIn: '-1s' }
    );
    const expiredRes = await request
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);
    assert(expiredRes.status === 401, 'Expired JWT returns 401 Unauthorized');

    // 16. Security Scenario 2: Role Authorization Enforcement
    // Commander calls commander-only action
    const commanderActionRes = await request
      .post('/api/v1/auth/commander-action')
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(commanderActionRes.status === 200, 'COMMANDER is authorized to execute commander-only action (200 OK)');

    // Field Operator calls commander-only action
    const operatorActionRes = await request
      .post('/api/v1/auth/commander-action')
      .set('Authorization', `Bearer ${operatorToken}`);
    assert(operatorActionRes.status === 403, 'FIELD_OPERATOR calling commander-only action is rejected with 403 Forbidden');
    assert(operatorActionRes.body.code === 'FORBIDDEN_ROLE', 'Returns FORBIDDEN_ROLE security code');

    // 17. Security Scenario 8: Socket.IO Unauthenticated Connection Rejection
    const unauthSocket: ClientSocketType = ClientSocket(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      autoConnect: false,
    });

    const unauthRejected = await new Promise<boolean>((resolve) => {
      unauthSocket.on('connect_error', (err) => {
        resolve(err.message === 'AUTHENTICATION_REQUIRED');
      });
      unauthSocket.on('connect', () => resolve(false));
      unauthSocket.connect();
      setTimeout(() => resolve(false), 3000);
    });
    assert(unauthRejected, 'Unauthenticated Socket.IO connection is rejected by server');
    unauthSocket.disconnect();

    // 18. Authenticated Socket.IO Connection & Private User Room (Section 27 & 28)
    const authSocket: ClientSocketType = ClientSocket(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      auth: { token: commanderToken },
      autoConnect: false,
    });

    const connectPromise = new Promise<boolean>((resolve) => {
      authSocket.on('connect', () => resolve(true));
      authSocket.on('connect_error', (err) => {
        console.error('[Socket Connect Error]', err);
        resolve(false);
      });
      setTimeout(() => resolve(false), 4000);
    });

    const welcomePromise = new Promise<{ user?: { role: string }; room?: string } | null>((resolve) => {
      authSocket.on('system:welcome', (data) => resolve(data));
      setTimeout(() => resolve(null), 4000);
    });

    // Initiate connection now that listeners are primed
    authSocket.connect();

    const authConnected = await connectPromise;
    assert(authConnected, 'Authenticated Socket.IO connection succeeds with valid token');

    const welcomeData = await welcomePromise;
    assert(
      Boolean(welcomeData && welcomeData.user?.role === 'COMMANDER' && welcomeData.room?.startsWith('user:')),
      'Socket receives welcome package with operator role and private user room'
    );
    authSocket.disconnect();

    // 19. Logout API
    const logoutRes = await request.post('/api/v1/auth/logout');
    const clearedRaw = logoutRes.header['set-cookie'];
    const clearedArray = Array.isArray(clearedRaw) ? clearedRaw : [clearedRaw || ''];
    assert(
      clearedArray.some((c: string) => c.includes('blackbox_token=;') || c.includes('Expires=') || c.includes('Max-Age=0')),
      'Logout response clears blackbox_token cookie'
    );

    // ==========================================
    // PHASE 3 — MISSION MANAGEMENT TEST SUITE
    // ==========================================
    console.log('\n--- STARTING BLACKBOX PHASE 3 MISSION MANAGEMENT TESTS ---\n');

    // Clean up test missions
    await Mission.deleteMany({});

    // Register Commander B for ownership tests
    const commanderBEmail = `test.commander.b.${Date.now()}@blackbox.local`;
    const regCommanderBRes = await request.post('/api/v1/auth/register').send({
      name: 'Commander Marcus Cole',
      email: commanderBEmail,
      password: 'TacticalPassword123!',
      role: 'COMMANDER',
    });
    const commanderBToken = regCommanderBRes.body.data.token;
    assert(regCommanderBRes.status === 201, 'Commander B registered for ownership testing');

    // 20. Mission Creation - Unauthenticated attempt (Section 55 #5)
    const unauthCreateRes = await request.post('/api/v1/missions').send({
      title: 'Unauthorized Mission',
      description: 'Attempt without login',
      location: 'Sector 0',
      severity: 'LOW',
    });
    assert(unauthCreateRes.status === 401, 'Unauthenticated mission creation returns 401 Unauthorized');

    // 21. Mission Creation - Field Operator attempt (Section 55 #6)
    const operatorCreateRes = await request
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({
        title: 'Operator Rogue Mission',
        description: 'Field operators cannot create missions',
        location: 'Sector 1',
        severity: 'LOW',
      });
    assert(operatorCreateRes.status === 403, 'Field operator creation attempt is rejected with 403 Forbidden');
    assert(operatorCreateRes.body.code === 'FORBIDDEN_ROLE', 'Returns FORBIDDEN_ROLE security code');

    // 22. Mission Creation - Validation Failures (Section 55 #2, #3, #4)
    const missingTitleRes = await request
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({
        description: 'Emergency response exercise for Building B',
        location: 'Building B',
        severity: 'HIGH',
      });
    assert(missingTitleRes.status === 400, 'Mission creation without title returns 400 Bad Request');

    const missingDescRes = await request
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({
        title: 'Campus Drill',
        location: 'Building B',
        severity: 'HIGH',
      });
    assert(missingDescRes.status === 400, 'Mission creation without description returns 400 Bad Request');

    const badSeverityRes = await request
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({
        title: 'Campus Drill',
        description: 'Emergency response exercise for Building B',
        location: 'Building B',
        severity: 'SUPER_CRITICAL', // invalid
      });
    assert(badSeverityRes.status === 400, 'Mission creation with invalid severity returns 400 Bad Request');

    // 23. Mission Creation - Successful (Section 55 #1 & Section 7 & 60)
    // Verify createdBy is derived from auth and client-provided createdBy is ignored
    const createRes = await request
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({
        title: 'Campus Building B Emergency Drill',
        description: 'Emergency response exercise for Building B',
        location: 'Building B',
        severity: 'HIGH',
        createdBy: 'spoofed_user_id', // Must be ignored by server
      });

    assert(createRes.status === 201, 'POST /api/v1/missions (Commander) returns 201 Created');
    assert(createRes.body.success === true, 'Mission create returns standard success format');
    assert(createRes.body.data.mission.status === 'DRAFT', 'Initial mission status is DRAFT');
    assert(createRes.body.data.mission.severity === 'HIGH', 'Severity is correctly assigned to HIGH');
    assert(createRes.body.data.mission.title === 'Campus Building B Emergency Drill', 'Title is correctly persisted');
    assert(
      createRes.body.data.mission.createdBy.id === regCommanderRes.body.data.user.id,
      'Mission createdBy is authenticated Commander A, ignoring any client spoof'
    );
    const missionAId = createRes.body.data.mission.id;

    // Verify in MongoDB directly (Section 61)
    const missionInDb = await Mission.findById(missionAId);
    assert(Boolean(missionInDb), 'Mission record is confirmed in MongoDB');
    assert(missionInDb?.status === 'DRAFT', 'MongoDB confirms status = DRAFT');

    // 24. Mission List (Section 55 #7 & Section 8)
    const listCommanderRes = await request
      .get('/api/v1/missions')
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(listCommanderRes.status === 200, 'GET /api/v1/missions returns 200 OK');
    assert(listCommanderRes.body.data.missions.length >= 1, 'Commander A sees created mission in list');
    assert(Boolean(listCommanderRes.body.data.pagination), 'Response includes pagination metadata');

    // Commander B list should NOT show Commander A's mission
    const listCommanderBRes = await request
      .get('/api/v1/missions')
      .set('Authorization', `Bearer ${commanderBToken}`);
    assert(listCommanderBRes.status === 200, 'Commander B list returns 200 OK');
    assert(
      !listCommanderBRes.body.data.missions.some((m: { id: string }) => m.id === missionAId),
      'Commander B does NOT see Commander A missions in list'
    );

    // 25. Mission Detail - Valid & Invalid ObjectId (Section 51 & Section 55 #8, #10, #11)
    const invalidIdRes = await request
      .get('/api/v1/missions/not-a-valid-id')
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(invalidIdRes.status === 400, 'Invalid MongoDB ObjectId returns 400 Bad Request');
    assert(invalidIdRes.body.code === 'INVALID_MISSION_ID', 'Returns INVALID_MISSION_ID code');

    const notFoundRes = await request
      .get('/api/v1/missions/507f1f77bcf86cd799439011')
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(notFoundRes.status === 404, 'Non-existent mission returns 404 Not Found');
    assert(notFoundRes.body.code === 'MISSION_NOT_FOUND', 'Returns MISSION_NOT_FOUND code');

    const detailRes = await request
      .get(`/api/v1/missions/${missionAId}`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(detailRes.status === 200, 'GET /api/v1/missions/:missionId returns 200 OK');
    assert(detailRes.body.data.mission.id === missionAId, 'Detail matches requested mission');

    // 26. CRITICAL SECURITY TEST (Section 57)
    // Field Operator A attempts to edit Mission A -> 403
    const operatorEditRes = await request
      .patch(`/api/v1/missions/${missionAId}`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ title: 'Tampered Title' });
    assert(operatorEditRes.status === 403, 'Field Operator A editing Mission A returns 403 Forbidden');

    // Commander B attempts to edit Mission A -> 403
    const commanderBEditRes = await request
      .patch(`/api/v1/missions/${missionAId}`)
      .set('Authorization', `Bearer ${commanderBToken}`)
      .send({ title: 'Commander B Tampered Title' });
    assert(commanderBEditRes.status === 403, 'Commander B editing Mission A returns 403 Forbidden (Ownership Enforced)');
    assert(commanderBEditRes.body.code === 'MISSION_ACCESS_DENIED', 'Returns MISSION_ACCESS_DENIED code');

    // Commander A edits Mission A -> 200
    const commanderAEditRes = await request
      .patch(`/api/v1/missions/${missionAId}`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({
        title: 'Campus Building B Emergency Drill - Updated',
        location: 'Building B, East Wing',
      });
    assert(commanderAEditRes.status === 200, 'Commander A (Owner) edits Mission A returns 200 OK');
    assert(
      commanderAEditRes.body.data.mission.title === 'Campus Building B Emergency Drill - Updated',
      'Title successfully updated'
    );
    assert(
      commanderAEditRes.body.data.mission.location === 'Building B, East Wing',
      'Location successfully updated'
    );

    // 27. Security: Reject direct status/system field update via PATCH (Section 10)
    const rejectDirectStatusRes = await request
      .patch(`/api/v1/missions/${missionAId}`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({
        status: 'COMPLETED', // illegal directly via PATCH
      });
    assert(
      rejectDirectStatusRes.status === 400,
      'PATCH directly modifying status is rejected with 400 Bad Request'
    );

    // 28. CRITICAL STATE MACHINE TEST (Section 58)
    // Attempt invalid transition: DRAFT -> COMPLETED (Must fail)
    const invalidDraftToComplete = await request
      .post(`/api/v1/missions/${missionAId}/complete`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(invalidDraftToComplete.status === 400, 'State machine rejects DRAFT -> COMPLETED transition');
    assert(invalidDraftToComplete.body.code === 'MISSION_INVALID_STATUS', 'Returns MISSION_INVALID_STATUS code');

    // Transition 1: DRAFT -> ACTIVE
    const startRes = await request
      .post(`/api/v1/missions/${missionAId}/start`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(startRes.status === 200, 'POST /missions/:missionId/start transitions DRAFT -> ACTIVE (200 OK)');
    assert(startRes.body.data.mission.status === 'ACTIVE', 'Mission status is now ACTIVE');
    assert(Boolean(startRes.body.data.mission.startedAt), 'Server assigned startedAt timestamp');

    // Attempt start again when already active (Concurrency check Section 52)
    const doubleStartRes = await request
      .post(`/api/v1/missions/${missionAId}/start`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(doubleStartRes.status === 400, 'Restarting active mission returns 400');
    assert(doubleStartRes.body.code === 'MISSION_ALREADY_ACTIVE', 'Returns MISSION_ALREADY_ACTIVE code');

    // Attempt non-owner Commander B completing Mission A -> 403
    const commanderBComplete = await request
      .post(`/api/v1/missions/${missionAId}/complete`)
      .set('Authorization', `Bearer ${commanderBToken}`);
    assert(commanderBComplete.status === 403, 'Non-owner Commander B completing mission returns 403');

    // Transition 2: ACTIVE -> COMPLETED
    const completeRes = await request
      .post(`/api/v1/missions/${missionAId}/complete`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(completeRes.status === 200, 'POST /missions/:missionId/complete transitions ACTIVE -> COMPLETED (200 OK)');
    assert(completeRes.body.data.mission.status === 'COMPLETED', 'Mission status is now COMPLETED');
    assert(Boolean(completeRes.body.data.mission.completedAt), 'Server assigned completedAt timestamp');

    // Attempt invalid transition: COMPLETED -> ACTIVE (Must fail)
    const completedToActive = await request
      .post(`/api/v1/missions/${missionAId}/start`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(completedToActive.status === 400, 'State machine rejects COMPLETED -> ACTIVE transition');

    // Attempt invalid transition: COMPLETED -> CANCELLED (Must fail)
    const completedToCancelled = await request
      .post(`/api/v1/missions/${missionAId}/cancel`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(completedToCancelled.status === 400, 'State machine rejects COMPLETED -> CANCELLED transition');

    // 29. State Machine: DRAFT -> CANCELLED & CANCELLED -> ACTIVE rejection
    const missionBRes = await request
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({
        title: 'Secondary Recon Mission',
        description: 'Secondary tactical reconnaissance mission',
        location: 'Sector 9',
        severity: 'LOW',
      });
    const missionBId = missionBRes.body.data.mission.id;

    // Transition: DRAFT -> CANCELLED
    const cancelRes = await request
      .post(`/api/v1/missions/${missionBId}/cancel`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(cancelRes.status === 200, 'POST /missions/:missionId/cancel transitions DRAFT -> CANCELLED (200 OK)');
    assert(cancelRes.body.data.mission.status === 'CANCELLED', 'Status is now CANCELLED');
    assert(Boolean(cancelRes.body.data.mission.cancelledAt), 'Server assigned cancelledAt timestamp');

    // Attempt invalid transition: CANCELLED -> ACTIVE (Must fail)
    const cancelledToActive = await request
      .post(`/api/v1/missions/${missionBId}/start`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(cancelledToActive.status === 400, 'State machine rejects CANCELLED -> ACTIVE transition');

    // 30. State Machine: ACTIVE -> CANCELLED
    const missionCRes = await request
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({
        title: 'Tertiary Perimeter Defense',
        description: 'Perimeter check for Sector 4',
        location: 'Sector 4',
        severity: 'MEDIUM',
      });
    const missionCId = missionCRes.body.data.mission.id;
    await request.post(`/api/v1/missions/${missionCId}/start`).set('Authorization', `Bearer ${commanderToken}`);

    const activeToCancel = await request
      .post(`/api/v1/missions/${missionCId}/cancel`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(activeToCancel.status === 200, 'State machine transitions ACTIVE -> CANCELLED (200 OK)');
    assert(activeToCancel.body.data.mission.status === 'CANCELLED', 'Status is CANCELLED');

    // 31. Mission Statistics API (Section 37 & 67)
    const statsRes = await request
      .get('/api/v1/missions/stats')
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(statsRes.status === 200, 'GET /api/v1/missions/stats returns 200 OK');
    assert(statsRes.body.data.stats.total === 3, 'Stats accurately counts 3 total missions created by Commander A');
    assert(statsRes.body.data.stats.completed === 1, 'Stats accurately counts 1 completed mission');
    assert(statsRes.body.data.stats.cancelled === 2, 'Stats accurately counts 2 cancelled missions');

    // 32. Socket.IO Mission Room Authorization (Section 39, 40, 55 #20)
    // Commander A connects socket and attempts to join missionA room
    const commanderASocket: ClientSocketType = ClientSocket(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      auth: { token: commanderToken },
      autoConnect: false,
    });

    const roomJoinCommanderA = await new Promise<boolean>((resolve) => {
      commanderASocket.on('connect', () => {
        commanderASocket.emit('mission:join', missionAId, (res: { success: boolean }) => {
          resolve(Boolean(res && res.success === true));
        });
      });
      commanderASocket.connect();
      setTimeout(() => resolve(false), 4000);
    });
    assert(roomJoinCommanderA, 'Authorized Commander A joins mission room successfully');
    commanderASocket.disconnect();

    // Commander B connects socket and attempts to join Commander A's mission room -> Must be rejected
    const commanderBSocket: ClientSocketType = ClientSocket(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      auth: { token: commanderBToken },
      autoConnect: false,
    });

    const roomJoinCommanderB = await new Promise<boolean>((resolve) => {
      commanderBSocket.on('connect', () => {
        commanderBSocket.emit('mission:join', missionAId, (res: { success: boolean; error?: string }) => {
          resolve(Boolean(res && res.success === false && res.error === 'MISSION_ACCESS_DENIED'));
        });
      });
      commanderBSocket.connect();
      setTimeout(() => resolve(false), 4000);
    });
    assert(roomJoinCommanderB, 'Unauthorized Commander B is rejected from joining mission room (403)');
    commanderBSocket.disconnect();

    // =========================================================================
    // PHASE 4: TEAM MANAGEMENT & TASK OPERATIONS TESTS (Sections 94 - 101)
    // =========================================================================

    // Register Operator B for isolation and cross-operator testing
    const operatorBEmail = `test.operator.b.${Date.now()}@blackbox.local`;
    const regOperatorBRes = await request.post('/api/v1/auth/register').send({
      name: 'Operator Maya Lin',
      email: operatorBEmail,
      password: 'TacticalPassword123!',
      role: 'FIELD_OPERATOR',
    });
    const operatorBToken = regOperatorBRes.body.data.token;
    const operatorBId = regOperatorBRes.body.data.user.id;
    const operatorAId = regOperatorRes.body.data.user.id;
    const commanderAId = regCommanderRes.body.data.user.id;

    // Create operational mission for Phase 4 Team & Task operations (Section 102 Step 2)
    const drillMissionRes = await request
      .post('/api/v1/missions')
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({
        title: 'Campus Building B Emergency Drill',
        description: 'Comprehensive tactical drill in Sector B',
        location: 'Building B East Wing',
        severity: 'HIGH',
      });
    const drillMissionId = drillMissionRes.body.data.mission.id;
    await request.post(`/api/v1/missions/${drillMissionId}/start`).set('Authorization', `Bearer ${commanderToken}`);

    // 33. Automatic Commander Membership on Mission Creation (Section 7)
    const membersInitRes = await request
      .get(`/api/v1/missions/${drillMissionId}/members`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(membersInitRes.status === 200, 'GET /missions/:missionId/members returns 200 OK');
    assert(membersInitRes.body.data.members.length >= 1, 'Mission has initial members');
    const autoCommander = membersInitRes.body.data.members.find(
      (m: { role: string; userId: { id: string } }) => m.role === 'COMMANDER' && m.userId.id === commanderAId
    );
    assert(Boolean(autoCommander), 'Mission creator is automatically registered as active COMMANDER member');
    assert(autoCommander.status === 'ACTIVE', 'Commander membership is ACTIVE');

    // Reject adding members to COMPLETED mission (Section 68)
    const completedAddMember = await request
      .post(`/api/v1/missions/${missionAId}/members`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({ userId: operatorAId });
    assert(completedAddMember.status === 400, 'Cannot add member to COMPLETED mission (400)');
    assert(completedAddMember.body.code === 'MISSION_NOT_OPERATIONAL', 'Returns MISSION_NOT_OPERATIONAL code');

    // 34. Field Operator Directory Search (Section 20 & 21)
    const userSearchRes = await request
      .get('/api/v1/users?role=FIELD_OPERATOR')
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(userSearchRes.status === 200, 'GET /api/v1/users?role=FIELD_OPERATOR returns 200 OK');
    assert(Array.isArray(userSearchRes.body.data.users), 'Users directory returns array');
    const hasSafeFieldsOnly = userSearchRes.body.data.users.every(
      (u: { id?: string; name?: string; email?: string; role?: string; passwordHash?: unknown }) =>
        Boolean(u.id && u.name && u.email && u.role && u.passwordHash === undefined)
    );
    assert(hasSafeFieldsOnly, 'User search exposes safe fields only and never leaks passwordHash');

    // 35. Add Member API (Section 9 & 10)
    const addMemberRes = await request
      .post(`/api/v1/missions/${drillMissionId}/members`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({ userId: operatorAId });
    assert(addMemberRes.status === 201, 'Commander adds Field Operator A to mission (201 Created)');
    assert(addMemberRes.body.data.member.role === 'FIELD_OPERATOR', 'Server enforces role = FIELD_OPERATOR');
    assert(addMemberRes.body.data.member.status === 'ACTIVE', 'Membership status is ACTIVE');

    // 36. Compound Unique Membership Constraint: Reject Duplicate Member (Section 6 & 10)
    const dupMemberRes = await request
      .post(`/api/v1/missions/${drillMissionId}/members`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({ userId: operatorAId });
    assert(dupMemberRes.status === 409, 'Adding duplicate member returns 409 Conflict');
    assert(dupMemberRes.body.code === 'MEMBER_ALREADY_EXISTS', 'Returns MEMBER_ALREADY_EXISTS code');

    // 37. Reject Commander Adding Themselves (Section 10)
    const selfAddRes = await request
      .post(`/api/v1/missions/${drillMissionId}/members`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({ userId: commanderAId });
    assert(selfAddRes.status === 400, 'Commander adding themselves returns 400 Bad Request');
    assert(selfAddRes.body.code === 'INVALID_MEMBER', 'Returns INVALID_MEMBER code');

    // 38. Non-Commander Cannot Add Members (Section 10 & 14)
    const opAddMemberRes = await request
      .post(`/api/v1/missions/${drillMissionId}/members`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ userId: operatorBId });
    assert(opAddMemberRes.status === 403, 'Field Operator cannot add members (403 Forbidden)');

    // 39. Field Operator Can Access Mission Once Active Member (Section 15)
    const opAccessMissionRes = await request
      .get(`/api/v1/missions/${drillMissionId}`)
      .set('Authorization', `Bearer ${operatorToken}`);
    assert(opAccessMissionRes.status === 200, 'Active Field Operator member can access mission (200 OK)');

    // 40. Primary Commander Cannot Be Removed (Section 11)
    const removeCommanderRes = await request
      .delete(`/api/v1/missions/${drillMissionId}/members/${commanderAId}`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(removeCommanderRes.status === 400, 'Cannot remove primary mission commander (400)');
    assert(removeCommanderRes.body.code === 'CANNOT_REMOVE_COMMANDER', 'Returns CANNOT_REMOVE_COMMANDER code');

    // 41. Remove Member Soft-Deletion (Section 11)
    const removeOpRes = await request
      .delete(`/api/v1/missions/${drillMissionId}/members/${operatorAId}`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(removeOpRes.status === 200, 'Commander removes Field Operator A (200 OK)');
    assert(removeOpRes.body.data.member.status === 'REMOVED', 'Member status updated to REMOVED');

    // Default member list returns ACTIVE only
    const activeMembersOnly = await request
      .get(`/api/v1/missions/${drillMissionId}/members`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(
      !activeMembersOnly.body.data.members.some((m: { userId: { id: string } }) => m.userId.id === operatorAId),
      'Removed member is excluded from default ACTIVE members list'
    );

    // 42. Removed Member Security: Loses Mission Access (Section 69 & 101)
    const removedMemberAccess = await request
      .get(`/api/v1/missions/${drillMissionId}`)
      .set('Authorization', `Bearer ${operatorToken}`);
    assert(removedMemberAccess.status === 403, 'Removed member loses mission access (403 Forbidden)');
    assert(removedMemberAccess.body.code === 'MISSION_ACCESS_DENIED', 'Returns MISSION_ACCESS_DENIED code');

    // 43. Reactivate Removed Member without Duplicate Document (Section 12 & 102)
    const reactivateRes = await request
      .post(`/api/v1/missions/${drillMissionId}/members`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({ userId: operatorAId });
    assert(
      reactivateRes.status === 200 || reactivateRes.status === 201,
      'Adding removed member reactivates existing membership'
    );
    assert(reactivateRes.body.data.member.status === 'ACTIVE', 'Reactivated status is ACTIVE');

    // 44. Task Creation in Operational Mission (Section 24, 25, 95)
    // Commander creates Task 1
    const task1Res = await request
      .post(`/api/v1/missions/${drillMissionId}/tasks`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({
        title: 'Check Zone C',
        description: 'Inspect the assigned area for security breaches',
        priority: 'HIGH',
      });
    assert(task1Res.status === 201, 'Commander creates task in active mission (201 Created)');
    assert(task1Res.body.data.task.title === 'Check Zone C', 'Task title recorded');
    assert(task1Res.body.data.task.priority === 'HIGH', 'Task priority recorded');
    assert(task1Res.body.data.task.status === 'PENDING', 'Task initial status is PENDING');
    assert(task1Res.body.data.task.createdBy === commanderAId || task1Res.body.data.task.createdBy?.id === commanderAId, 'Server derived createdBy as Commander');
    const task1Id = task1Res.body.data.task.id;

    // 45. Task Creation Security & Validation (Section 25 & 95)
    // Field Operator cannot create task
    const opCreateTaskRes = await request
      .post(`/api/v1/missions/${drillMissionId}/tasks`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ title: 'Unauthorized Task' });
    assert(opCreateTaskRes.status === 403, 'Field Operator cannot create tasks (403 Forbidden)');

    // Cannot create task in completed mission
    const completedTaskRes = await request
      .post(`/api/v1/missions/${missionAId}/tasks`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({ title: 'Task in completed mission' });
    assert(completedTaskRes.status === 400, 'Cannot create task in COMPLETED mission (400)');
    assert(completedTaskRes.body.code === 'MISSION_NOT_OPERATIONAL', 'Returns MISSION_NOT_OPERATIONAL code');

    // Invalid priority rejected
    const badPriorityRes = await request
      .post(`/api/v1/missions/${drillMissionId}/tasks`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({ title: 'Bad Priority Task', priority: 'SUPER_CRITICAL' });
    assert(badPriorityRes.status === 400, 'Invalid priority is rejected with 400 Bad Request');

    // 46. Task Assignment Rules (Section 26, 27, 70, 96)
    // Attempt assigning to non-member (Operator B is not in drill mission)
    const assignNonMemberRes = await request
      .patch(`/api/v1/tasks/${task1Id}/assign`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({ userId: operatorBId });
    assert(assignNonMemberRes.status === 400, 'Assigning task to non-member is rejected (400)');
    assert(assignNonMemberRes.body.code === 'TASK_INVALID_ASSIGNEE', 'Returns TASK_INVALID_ASSIGNEE code');

    // Attempt assigning to Commander
    const assignCommanderRes = await request
      .patch(`/api/v1/tasks/${task1Id}/assign`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({ userId: commanderAId });
    assert(assignCommanderRes.status === 400, 'Assigning task to Commander is rejected (400)');
    assert(assignCommanderRes.body.code === 'TASK_INVALID_ASSIGNEE', 'Returns TASK_INVALID_ASSIGNEE code');

    // Valid assignment to active member Field Operator A
    const assignOpARes = await request
      .patch(`/api/v1/tasks/${task1Id}/assign`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({ userId: operatorAId });
    assert(assignOpARes.status === 200, 'Commander assigns task to active Field Operator A (200 OK)');
    assert(assignOpARes.body.data.task.assignedTo.id === operatorAId, 'Task assignedTo is Operator A');

    // Field Operator cannot assign tasks
    const opAssignRes = await request
      .patch(`/api/v1/tasks/${task1Id}/assign`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ userId: operatorAId });
    assert(opAssignRes.status === 403, 'Field Operator cannot assign tasks (403 Forbidden)');

    // 47. Unassign Task (Section 28 & 96)
    const unassignRes = await request
      .patch(`/api/v1/tasks/${task1Id}/unassign`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(unassignRes.status === 200, 'Commander unassigns task (200 OK)');
    assert(unassignRes.body.data.task.assignedTo === null, 'Task assignedTo is now null');

    // Reassign back to Operator A for state-machine testing
    await request
      .patch(`/api/v1/tasks/${task1Id}/assign`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({ userId: operatorAId });

    // 48. Strict Task State Machine Transitions & Authorization (Section 23, 31, 32, 33, 97, 98)
    // Disallowed transition: PENDING -> COMPLETED (Must fail)
    const pendingToComplete = await request
      .patch(`/api/v1/tasks/${task1Id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'COMPLETED' });
    assert(pendingToComplete.status === 400, 'State machine rejects PENDING -> COMPLETED (400)');
    assert(pendingToComplete.body.code === 'TASK_INVALID_STATUS_TRANSITION', 'Returns TASK_INVALID_STATUS_TRANSITION code');

    // Other Operator (B) attempts to update Operator A's assigned task -> 403 TASK_ACCESS_DENIED
    // First deploy Operator B to mission so they have mission access
    await request
      .post(`/api/v1/missions/${drillMissionId}/members`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({ userId: operatorBId });
    const crossOpStatusRes = await request
      .patch(`/api/v1/tasks/${task1Id}/status`)
      .set('Authorization', `Bearer ${operatorBToken}`)
      .send({ status: 'ACTIVE' });
    assert(crossOpStatusRes.status === 403, 'Operator B cannot update Operator A task status (403)');
    assert(crossOpStatusRes.body.code === 'TASK_ACCESS_DENIED', 'Returns TASK_ACCESS_DENIED code');

    // Allowed transition 1: PENDING -> ACTIVE (Field Operator A starts task)
    const startTaskRes = await request
      .patch(`/api/v1/tasks/${task1Id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'ACTIVE' });
    assert(startTaskRes.status === 200, 'Assigned Operator starts task: PENDING -> ACTIVE (200 OK)');
    assert(startTaskRes.body.data.task.status === 'ACTIVE', 'Task status is ACTIVE');
    assert(Boolean(startTaskRes.body.data.task.startedAt), 'Server assigned startedAt timestamp');

    // Allowed transition 2: ACTIVE -> BLOCKED
    const blockTaskRes = await request
      .patch(`/api/v1/tasks/${task1Id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'BLOCKED' });
    assert(blockTaskRes.status === 200, 'Assigned Operator blocks task: ACTIVE -> BLOCKED (200 OK)');
    assert(blockTaskRes.body.data.task.status === 'BLOCKED', 'Task status is BLOCKED');
    assert(Boolean(blockTaskRes.body.data.task.blockedAt), 'Server assigned blockedAt timestamp');

    // Disallowed transition: BLOCKED -> COMPLETED (Must fail)
    const blockedToComplete = await request
      .patch(`/api/v1/tasks/${task1Id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'COMPLETED' });
    assert(blockedToComplete.status === 400, 'State machine rejects BLOCKED -> COMPLETED (400)');

    // Allowed transition 3: BLOCKED -> ACTIVE (Resume task)
    const resumeTaskRes = await request
      .patch(`/api/v1/tasks/${task1Id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'ACTIVE' });
    assert(resumeTaskRes.status === 200, 'Assigned Operator resumes task: BLOCKED -> ACTIVE (200 OK)');
    assert(resumeTaskRes.body.data.task.status === 'ACTIVE', 'Task status is ACTIVE');

    // Allowed transition 4: ACTIVE -> COMPLETED (Complete task)
    const completeTaskRes = await request
      .patch(`/api/v1/tasks/${task1Id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'COMPLETED' });
    assert(completeTaskRes.status === 200, 'Assigned Operator completes task: ACTIVE -> COMPLETED (200 OK)');
    assert(completeTaskRes.body.data.task.status === 'COMPLETED', 'Task status is COMPLETED');
    assert(Boolean(completeTaskRes.body.data.task.completedAt), 'Server assigned completedAt timestamp');

    // Disallowed transition: COMPLETED -> ACTIVE (Terminal state)
    const completedToActiveTask = await request
      .patch(`/api/v1/tasks/${task1Id}/status`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ status: 'ACTIVE' });
    assert(completedToActiveTask.status === 400, 'State machine rejects COMPLETED -> ACTIVE (400)');

    // 49. Task List & Calculated Stats Verification (Section 29, 79, 81, 82)
    const missionTasksRes = await request
      .get(`/api/v1/missions/${drillMissionId}/tasks`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(missionTasksRes.status === 200, 'GET /missions/:missionId/tasks returns 200 OK');
    assert(missionTasksRes.body.data.tasks.length === 1, 'Returns 1 task');
    assert(missionTasksRes.body.data.stats.total === 1, 'Stats total is 1');
    assert(missionTasksRes.body.data.stats.completed === 1, 'Stats completed is 1');

    const globalTaskStatsRes = await request
      .get('/api/v1/tasks/stats')
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(globalTaskStatsRes.status === 200, 'GET /api/v1/tasks/stats returns 200 OK');
    assert(globalTaskStatsRes.body.data.stats.completed >= 1, 'Global task stats counts completed task');

    const myTasksRes = await request
      .get('/api/v1/tasks/my')
      .set('Authorization', `Bearer ${operatorToken}`);
    assert(myTasksRes.status === 200, 'GET /api/v1/tasks/my returns 200 OK');
    assert(
      myTasksRes.body.data.tasks.some((t: { id: string }) => t.id === task1Id),
      'Operator A retrieves assigned task in My Tasks'
    );

    // 50. Real-time Team and Task Events in Mission Room (Section 60, 61, 63, 64)
    const operatorSocket: ClientSocketType = ClientSocket(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      auth: { token: operatorToken },
      autoConnect: false,
    });

    let taskCreatedEventReceived = false;
    let memberAddedEventReceived = false;

    await new Promise<void>((resolve) => {
      operatorSocket.on('connect', () => {
        operatorSocket.emit('mission:join', drillMissionId, () => {
          operatorSocket.on('task:created', (payload: { task: { title: string } }) => {
            if (payload?.task?.title === 'Secondary Checkpoint Scan') {
              taskCreatedEventReceived = true;
            }
          });

          operatorSocket.on('mission:member_added', (payload: { member: { role: string } }) => {
            if (payload?.member) {
              memberAddedEventReceived = true;
            }
          });

          resolve();
        });
      });
      operatorSocket.connect();
    });

    // Commander triggers task creation -> triggers task:created broadcast
    await request
      .post(`/api/v1/missions/${drillMissionId}/tasks`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({
        title: 'Secondary Checkpoint Scan',
        priority: 'MEDIUM',
      });

    // Wait brief window for socket event
    await new Promise((r) => setTimeout(r, 600));
    assert(taskCreatedEventReceived, 'Operator socket received real-time task:created event in mission room');

    operatorSocket.disconnect();

    // ==============================================================
    // --- STARTING BLACKBOX PHASE 5 EVENT SYSTEM & REAL-TIME TESTS ---
    // ==============================================================
    console.log('\n--- STARTING BLACKBOX PHASE 5 EVENT SYSTEM & REAL-TIME TESTS ---\n');

    // 1. Mission Lifecycle Events in MongoDB (Section 26 & 88)
    const missionCreatedEvent = await MissionEvent.findOne({
      missionId: drillMissionId,
      eventType: 'MISSION_CREATED',
    });
    assert(Boolean(missionCreatedEvent), 'Mission creation automatically persisted MISSION_CREATED event');
    assert(
      (missionCreatedEvent?.payload as any)?.title === 'Campus Building B Emergency Drill',
      'MISSION_CREATED event recorded correct mission title'
    );
    assert(
      missionCreatedEvent?.targetType === 'MISSION',
      'MISSION_CREATED targetType is MISSION'
    );

    const missionStartedEvent = await MissionEvent.findOne({
      missionId: drillMissionId,
      eventType: 'MISSION_STARTED',
    });
    assert(Boolean(missionStartedEvent), 'Mission start automatically persisted MISSION_STARTED event');

    // 2. Team Membership Events in MongoDB (Section 27 & 88)
    const memberAssignedEvent = await MissionEvent.findOne({
      missionId: drillMissionId,
      eventType: 'MEMBER_ASSIGNED',
    });
    assert(Boolean(memberAssignedEvent), 'Adding field operator automatically persisted MEMBER_ASSIGNED event');

    const memberRemovedEvent = await MissionEvent.findOne({
      missionId: drillMissionId,
      eventType: 'MEMBER_REMOVED',
    });
    assert(Boolean(memberRemovedEvent), 'Removing operator automatically persisted MEMBER_REMOVED event');

    const memberReactivatedEvent = await MissionEvent.findOne({
      missionId: drillMissionId,
      eventType: 'MEMBER_REACTIVATED',
    });
    assert(Boolean(memberReactivatedEvent), 'Reactivating operator automatically persisted MEMBER_REACTIVATED event');

    // 3. Task Mutation Events in MongoDB (Section 28 & 88)
    const taskCreatedEvents = await MissionEvent.find({
      missionId: drillMissionId,
      eventType: 'TASK_CREATED',
    });
    assert(taskCreatedEvents.length >= 1, 'Task creation automatically persisted TASK_CREATED event');

    const taskAssignedEvent = await MissionEvent.findOne({
      missionId: drillMissionId,
      eventType: 'TASK_ASSIGNED',
    });
    assert(Boolean(taskAssignedEvent), 'Assigning task automatically persisted TASK_ASSIGNED event');

    const taskUnassignedEvent = await MissionEvent.findOne({
      missionId: drillMissionId,
      eventType: 'TASK_UNASSIGNED',
    });
    assert(Boolean(taskUnassignedEvent), 'Unassigning task automatically persisted TASK_UNASSIGNED event');

    const taskStartedEvent = await MissionEvent.findOne({
      missionId: drillMissionId,
      eventType: 'TASK_STARTED',
    });
    assert(Boolean(taskStartedEvent), 'Starting task automatically persisted TASK_STARTED event');

    const taskBlockedEvent = await MissionEvent.findOne({
      missionId: drillMissionId,
      eventType: 'TASK_BLOCKED',
    });
    assert(Boolean(taskBlockedEvent), 'Blocking task automatically persisted TASK_BLOCKED event');

    const taskCompletedEvent = await MissionEvent.findOne({
      missionId: drillMissionId,
      eventType: 'TASK_COMPLETED',
    });
    assert(Boolean(taskCompletedEvent), 'Completing task automatically persisted TASK_COMPLETED event');

    // 4. REST Event Retrieval API: GET /api/v1/missions/:missionId/events (Section 22, 23, 24)
    const eventsListRes = await request
      .get(`/api/v1/missions/${drillMissionId}/events?page=1&limit=50`)
      .set('Authorization', `Bearer ${commanderToken}`);

    assert(eventsListRes.status === 200, 'GET /missions/:missionId/events returns 200 OK');
    assert(Array.isArray(eventsListRes.body.data.events), 'Events response contains events array');
    assert(eventsListRes.body.data.events.length >= 8, 'Events response contains all generated events');
    assert(eventsListRes.body.data.pagination.page === 1, 'Pagination page is 1');
    assert(eventsListRes.body.data.pagination.total >= 8, 'Pagination total tracks total events');

    // Actor details populated safely without leaking secrets (Section 15, 50, 106)
    const firstEvent = eventsListRes.body.data.events[0];
    assert(Boolean(firstEvent.actorId?.name), 'Event actor is populated with user name');
    assert(firstEvent.actorId.password === undefined, 'Event actor does not leak password');
    assert(firstEvent.actorId.passwordHash === undefined, 'Event actor does not leak passwordHash');

    // 5. Event Chronological Ordering: newest first (Section 29 & 100)
    const returnedEvents = eventsListRes.body.data.events;
    let isChronological = true;
    for (let i = 0; i < returnedEvents.length - 1; i++) {
      const current = new Date(returnedEvents[i].createdAt).getTime();
      const next = new Date(returnedEvents[i + 1].createdAt).getTime();
      if (current < next) {
        isChronological = false;
        break;
      }
    }
    assert(isChronological, 'Events are returned in deterministic descending chronological order (newest first)');

    // 6. Event Immutability (Sections 13 & 89)
    const immutabilityPatchRes = await request
      .patch(`/api/v1/missions/${drillMissionId}/events/${firstEvent.id}`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({ eventType: 'FAKE_MODIFIED' });
    assert(
      immutabilityPatchRes.status === 404,
      'PATCH /missions/:missionId/events/:id returns 404 (Event modification is forbidden/not exposed)'
    );

    const immutabilityDeleteRes = await request
      .delete(`/api/v1/missions/${drillMissionId}/events/${firstEvent.id}`)
      .set('Authorization', `Bearer ${commanderToken}`);
    assert(
      immutabilityDeleteRes.status === 404,
      'DELETE /missions/:missionId/events/:id returns 404 (Event deletion is forbidden/not exposed)'
    );

    // 7. Event Authorization (Sections 25 & 90)
    // Authorized Field Operator member can read events
    const opEventsRes = await request
      .get(`/api/v1/missions/${drillMissionId}/events`)
      .set('Authorization', `Bearer ${operatorToken}`);
    assert(opEventsRes.status === 200, 'Assigned Field Operator can read mission events (200 OK)');

    // Removed Member cannot read events (403)
    await request
      .delete(`/api/v1/missions/${drillMissionId}/members/${operatorAId}`)
      .set('Authorization', `Bearer ${commanderToken}`);

    const removedOpEventsRes = await request
      .get(`/api/v1/missions/${drillMissionId}/events`)
      .set('Authorization', `Bearer ${operatorToken}`);
    assert(removedOpEventsRes.status === 403, 'Removed member is denied access to mission events (403 Forbidden)');

    // Re-add operator to restore membership
    await request
      .post(`/api/v1/missions/${drillMissionId}/members`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({ userId: operatorAId });

    // Unrelated Commander B cannot read events (403)
    const unrelatedEventsRes = await request
      .get(`/api/v1/missions/${drillMissionId}/events`)
      .set('Authorization', `Bearer ${commanderBToken}`);
    assert(unrelatedEventsRes.status === 403, 'Unrelated Commander B is denied access to mission events (403 Forbidden)');

    // 8. Event Idempotency (Sections 20, 21, 94)
    const key = `test-idempotency-${Date.now()}`;
    const firstCall = await missionEventService.createMissionEvent({
      missionId: drillMissionId,
      actorId: commanderAId,
      eventType: MissionEventType.TASK_CREATED,
      targetType: EventTargetType.TASK,
      payload: { title: 'Idempotency Test Task' },
      source: EventSource.USER,
      idempotencyKey: key,
    });

    const secondCall = await missionEventService.createMissionEvent({
      missionId: drillMissionId,
      actorId: commanderAId,
      eventType: MissionEventType.TASK_CREATED,
      targetType: EventTargetType.TASK,
      payload: { title: 'Duplicate Attempt' },
      source: EventSource.USER,
      idempotencyKey: key,
    });

    assert(firstCall.id === secondCall.id, 'Idempotency returns existing event on duplicate key without duplicating');
    const idempotencyCount = await MissionEvent.countDocuments({
      missionId: drillMissionId,
      idempotencyKey: key,
    });
    assert(idempotencyCount === 1, 'Only one event document is saved for a given idempotency key');

    // 9. Real-time Socket.IO Broadcast: mission:event_created & Room Isolation (Sections 37, 95, 98)
    const roomSocketA: ClientSocketType = ClientSocket(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      auth: { token: operatorToken },
      autoConnect: false,
    });

    const roomSocketB: ClientSocketType = ClientSocket(`http://localhost:${testPort}`, {
      transports: ['websocket'],
      auth: { token: commanderBToken },
      autoConnect: false,
    });

    let roomAReceivedEventCreated = false;
    let roomBReceivedEventCreated = false;

    await new Promise<void>((resolve) => {
      let connectedCount = 0;
      const onBothConnected = () => {
        connectedCount++;
        if (connectedCount === 2) resolve();
      };

      roomSocketA.on('connect', () => {
        roomSocketA.emit('mission:join', drillMissionId, () => {
          roomSocketA.on('mission:event_created', (data: { missionId: string; event: { eventType: string } }) => {
            if (data?.missionId === drillMissionId && data?.event?.eventType === 'TASK_CREATED') {
              roomAReceivedEventCreated = true;
            }
          });
          onBothConnected();
        });
      });

      roomSocketB.on('connect', () => {
        roomSocketB.on('mission:event_created', () => {
          roomBReceivedEventCreated = true;
        });
        onBothConnected();
      });

      roomSocketA.connect();
      roomSocketB.connect();
    });

    // Commander creates a task -> triggers real-time mission:event_created to drillMissionId room
    await request
      .post(`/api/v1/missions/${drillMissionId}/tasks`)
      .set('Authorization', `Bearer ${commanderToken}`)
      .send({
        title: 'Realtime Broadcast Validation Task',
        priority: 'HIGH',
      });

    await new Promise((r) => setTimeout(r, 600));

    assert(roomAReceivedEventCreated, 'Connected member receives real-time mission:event_created in mission room');
    assert(!roomBReceivedEventCreated, 'Room isolation enforced: unrelated client does NOT receive mission:event_created');

    roomSocketA.disconnect();
    roomSocketB.disconnect();

    // Clean up
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    await disconnectDatabase();

    console.log(`\n--- TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---\n`);

    if (failed > 0) {
      process.exit(1);
    }
    process.exit(0);
  } catch (error) {
    console.error('[Test Error] Uncaught error during testing:', error);
    try {
      await disconnectDatabase();
    } catch {
      // ignore
    }
    process.exit(1);
  }
}

runTests();
