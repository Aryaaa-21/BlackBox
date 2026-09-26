import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();
  private activeMissionId: string | null = null;

  connect(authToken?: string): Socket | null {
    const token = authToken || (typeof window !== 'undefined' ? localStorage.getItem('blackbox_token') : null);

    // If no authentication token exists, do not attempt to connect to operational socket
    if (!token) {
      console.log('[Socket] Deferring connection: Operator authentication token required');
      return null;
    }

    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.auth = { token };
      this.socket.connect();
      return this.socket;
    }

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      auth: { token },
      autoConnect: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log(`[Socket] Authenticated to BlackBox Realtime Stream (Socket ID: ${this.socket?.id})`);
      this.notifyListeners('connection_change', { connected: true, socketId: this.socket?.id });
      // If we were inside an active mission prior to connect/reconnect, automatically rejoin
      if (this.activeMissionId) {
        this.socket?.emit('mission:join', { missionId: this.activeMissionId });
      }
    });

    this.socket.on('system:welcome', (data) => {
      console.log('[Socket] Server welcome package received:', data);
      this.notifyListeners('welcome', data);
    });

    this.socket.on('server:pong', (data) => {
      const rtt = Date.now() - data.sentAt;
      this.notifyListeners('latency', { latencyMs: rtt });
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.warn(`[Socket] Disconnected from stream (${reason})`);
      this.notifyListeners('connection_change', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Socket] Connection error:', error.message);
      this.notifyListeners('connection_error', error);
    });

    // Capture and dispatch all server room broadcasts to registered subscribers
    this.socket.onAny((event: string, ...args: unknown[]) => {
      this.notifyListeners(event, args[0]);
    });

    // Reconnection handling (Sections 44 & 82)
    this.socket.io.on('reconnect', (attempt: number) => {
      console.log(`[Socket] Reconnection restored on attempt ${attempt}`);
      this.notifyListeners('reconnect', { attempt });
      if (this.activeMissionId) {
        this.socket?.emit('mission:join', { missionId: this.activeMissionId });
      }
    });

    return this.socket;
  }

  joinMission(missionId: string): void {
    this.activeMissionId = missionId;
    if (this.socket && this.isConnected) {
      this.socket.emit('mission:join', { missionId });
    }
  }

  leaveMission(missionId: string): void {
    if (this.activeMissionId === missionId) {
      this.activeMissionId = null;
    }
    if (this.socket && this.isConnected) {
      this.socket.emit('mission:leave', { missionId });
    }
  }

  reconnectWithAuth(token: string): void {
    this.disconnect();
    this.connect(token);
  }

  ping(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit('client:ping', { sentAt: Date.now() });
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.notifyListeners('connection_change', { connected: false, reason: 'manual_disconnect' });
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  getIsConnected(): boolean {
    return this.isConnected;
  }

  subscribe(event: string, callback: (data: unknown) => void): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  private notifyListeners(event: string, data: unknown): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[Socket] Error executing listener for ${event}:`, err);
        }
      });
    }
  }
}

export const socketService = new SocketService();
