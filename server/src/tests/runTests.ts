import http from 'http';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { config } from '../config/env';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { initializeSockets } from '../sockets/socket';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import supertest from 'supertest';
import { User } from '../models/User';

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
