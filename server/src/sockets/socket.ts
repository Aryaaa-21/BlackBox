import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { config } from '../config/env';
import { verifyToken } from '../utils/jwt';
import { AUTH_COOKIE_NAME } from '../utils/cookies';
import { UserPayload } from '../types';
import { afterCommit } from '../services/unitOfWork';

let io: SocketIOServer | null = null;

export const initializeSockets = (httpServer: HttpServer): SocketIOServer => {
  const allowedOrigins = config.isProduction
    ? config.corsOrigins
    : [...new Set([...config.corsOrigins, 'http://localhost:5173', 'http://127.0.0.1:5173'])];

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Socket.IO Authentication Middleware
  // Rejects unauthenticated connections and identifies user + role
  io.use((socket: Socket, next) => {
    let token: string | undefined;

    // 1. Handshake auth payload
    if (socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token;
    }

    // 2. Authorization header
    if (!token && socket.handshake.headers.authorization && socket.handshake.headers.authorization.startsWith('Bearer ')) {
      token = socket.handshake.headers.authorization.split(' ')[1];
    }

    // 3. HTTP-only cookie
    if (!token && socket.handshake.headers.cookie) {
      const match = socket.handshake.headers.cookie.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE_NAME}=([^;]+)`));
      if (match) {
        token = decodeURIComponent(match[1]);
      }
    }

    if (!token) {
      return next(new Error('AUTHENTICATION_REQUIRED'));
    }

    try {
      const decoded = verifyToken(token);
      socket.data.user = decoded;
      next();
    } catch {
      return next(new Error('INVALID_TOKEN'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as UserPayload;
    console.log(`[Socket.IO] Authenticated operator connected: ${user.name} (${user.role}) [ID: ${user.id}, Socket: ${socket.id}]`);

    // Join private user room
    const userRoom = `user:${user.id}`;
    socket.join(userRoom);
    socket.join(`role:${user.role}`);

    // Emit initial welcome event with authenticated operator identity
    socket.emit('system:welcome', {
      message: 'Connected to BlackBox Realtime Stream',
      timestamp: new Date().toISOString(),
      socketId: socket.id,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
      room: userRoom,
    });

    // Heartbeat ping/pong for realtime latency and connectivity tracking
    socket.on('client:ping', (data: { sentAt: number }) => {
      socket.emit('server:pong', {
        sentAt: data.sentAt,
        receivedAt: Date.now(),
      });
    });

    // Mission Room Authorization & Subscription (Sections 39 & 40)
    socket.on(
      'mission:join',
      async (
        data: string | { missionId: string },
        callback?: (res: { success: boolean; error?: string; room?: string }) => void
      ) => {
        try {
          const missionId = typeof data === 'string' ? data : data?.missionId;
          if (!missionId) {
            if (callback) callback({ success: false, error: 'MISSION_ID_REQUIRED' });
            return;
          }

          // Dynamic import to prevent circular dependency
          const { missionService } = await import('../services/mission.service');
          const canAccess = await missionService.canUserAccessMission(missionId, user);

          if (!canAccess) {
            console.warn(`[Socket.IO] Access denied: User ${user.name} tried to join mission:${missionId}`);
            if (callback) callback({ success: false, error: 'MISSION_ACCESS_DENIED' });
            return;
          }

          const roomName = `mission:${missionId}`;
          socket.join(roomName);
          console.log(`[Socket.IO] Operator ${user.name} joined operational room ${roomName}`);
          if (callback) callback({ success: true, room: roomName });
        } catch (err: unknown) {
          const error = err as Error;
          if (callback) callback({ success: false, error: error.message });
        }
      }
    );

    // Leave mission room
    socket.on('mission:leave', (data: string | { missionId: string }) => {
      const missionId = typeof data === 'string' ? data : data?.missionId;
      if (missionId) {
        const roomName = `mission:${missionId}`;
        socket.leave(roomName);
        console.log(`[Socket.IO] Operator ${user.name} left operational room ${roomName}`);
      }
    });

    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket.IO] Operator disconnected: ${user.name} (${socket.id}) - Reason: ${reason}`);
    });
  });

  return io;
};

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO is not initialized yet!');
  }
  return io;
};

/**
 * Emit an operational event directly to a specific user's private room
 */
export const emitToUser = (userId: string, event: string, data: unknown): void => {
  const snapshot: unknown = JSON.parse(JSON.stringify(data));
  afterCommit(() => { if (io) io.to(`user:${userId}`).emit(event, snapshot); });
};

/**
 * Emit a real-time event to an operational mission room
 */
export const emitToMission = (missionId: string, event: string, data: unknown): void => {
  const snapshot: unknown = JSON.parse(JSON.stringify(data));
  afterCommit(() => { if (io) io.to(`mission:${missionId}`).emit(event, snapshot); });
};
