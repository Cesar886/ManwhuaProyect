import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';

const MAX_USERS = 30;
const MAX_CONNECTIONS_PER_IP = 10;

export function createPresenceServer({ port = Number(process.env.PORT || 4001), secret = process.env.PRESENCE_SECRET } = {}) {
  if (!secret) throw new Error('PRESENCE_SECRET es obligatorio');

  const rooms = new Map();
  const connectionsByIp = new Map();
  const wss = new WebSocketServer({ port });

  const broadcast = (room) => {
    const clients = rooms.get(room);
    if (!clients) return;

    const usersById = new Map();
    const anonymousIds = new Set();
    for (const client of clients) {
      if (client.user) usersById.set(String(client.user.id), client.user);
      else if (client.anonId) anonymousIds.add(client.anonId);
    }

    const message = JSON.stringify({
      type: 'presence',
      users: [...usersById.values()].slice(0, MAX_USERS),
      anonymous: anonymousIds.size,
      total: usersById.size + anonymousIds.size,
    });

    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) client.send(message);
    }
  };

  const leave = (socket) => {
    if (!socket.room) return;
    const oldRoom = socket.room;
    const clients = rooms.get(oldRoom);
    clients?.delete(socket);
    if (clients?.size === 0) rooms.delete(oldRoom);
    socket.room = null;
    broadcast(oldRoom);
  };

  wss.on('connection', (socket, request) => {
    const forwardedIp = String(request.headers['x-forwarded-for'] || '').split(',')[0].trim();
    const ip = forwardedIp || request.socket.remoteAddress || 'unknown';
    const ipConnections = connectionsByIp.get(ip) || 0;
    if (ipConnections >= MAX_CONNECTIONS_PER_IP) {
      socket.close(1013, 'Demasiadas conexiones');
      return;
    }
    connectionsByIp.set(ip, ipConnections + 1);
    socket.connectionIp = ip;

    const token = new URL(request.url || '/', 'http://presence.local').searchParams.get('token');
    try {
      const payload = jwt.verify(token, secret);
      const id = String(payload.id || '').slice(0, 128);
      const username = String(payload.username || '').slice(0, 50);
      socket.user = id && username
        ? { id, username, avatar: typeof payload.avatar === 'string' ? payload.avatar.slice(0, 2048) : null }
        : null;
    } catch {
      socket.user = null;
    }

    socket.isAlive = true;
    socket.room = null;
    socket.anonId = null;
    socket.on('pong', () => { socket.isAlive = true; });

    socket.on('message', (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (!message || message.type !== 'join' || typeof message.manhwa !== 'string') return;
      if (typeof message.chapter !== 'string' && typeof message.chapter !== 'number') return;
      const manhwa = message.manhwa.trim().slice(0, 120);
      const chapter = String(message.chapter ?? '').trim().slice(0, 20);
      if (!manhwa || !chapter) return;

      if (!socket.user) {
        if (typeof message.anonId !== 'string') return;
        const anonId = message.anonId.trim().slice(0, 64);
        if (!anonId || !/^[a-zA-Z0-9_-]+$/.test(anonId)) return;
        socket.anonId = anonId;
      }

      leave(socket);
      socket.room = `${manhwa}:${chapter}`;
      if (!rooms.has(socket.room)) rooms.set(socket.room, new Set());
      rooms.get(socket.room).add(socket);
      broadcast(socket.room);
    });

    socket.on('close', () => {
      leave(socket);
      if (socket.connectionIp) {
        const remaining = (connectionsByIp.get(socket.connectionIp) || 1) - 1;
        if (remaining > 0) connectionsByIp.set(socket.connectionIp, remaining);
        else connectionsByIp.delete(socket.connectionIp);
        socket.connectionIp = null;
      }
    });
    socket.on('error', () => leave(socket));
  });

  const heartbeat = setInterval(() => {
    for (const socket of wss.clients) {
      if (!socket.isAlive) {
        socket.terminate();
        continue;
      }
      socket.isAlive = false;
      socket.ping();
    }
  }, 30_000);
  heartbeat.unref();

  wss.on('close', () => clearInterval(heartbeat));
  return { wss, rooms, connectionsByIp };
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule || process.env.pm_id !== undefined) {
  const { wss } = createPresenceServer();
  wss.on('listening', () => {
    const address = wss.address();
    console.log(`[presence] escuchando en el puerto ${address.port}`);
  });
}
