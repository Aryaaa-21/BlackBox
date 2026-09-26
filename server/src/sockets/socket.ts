import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { config } from '../config/env';
import { verifyToken } from '../utils/jwt';
import { AUTH_COOKIE_NAME } from '../utils/cookies';
import { UserPayload } from '../types';

let io: SocketIOServer | null = null;

export const initializeSockets = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
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

    // Join private user room (Section 28)
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
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
};
