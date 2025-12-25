// server/socket.js
import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import cookie from "cookie";


const userSocketMap = new Map(); // userId -> Set(socketId)
let io = null;

export function getReceiverSocketIds(userId) {
  const s = userSocketMap.get(String(userId));
  return s ? Array.from(s) : [];
}

export function getOnlineUsers() {
  return Array.from(userSocketMap.keys());
}

export function addUserSocket(userId, socketId) {
  if (!userId) return;
  const uid = String(userId);
  if (!userSocketMap.has(uid)) userSocketMap.set(uid, new Set());
  userSocketMap.get(uid).add(socketId);
}

export function removeUserSocket(userId, socketId) {
  if (!userId) return;
  const uid = String(userId);
  if (!userSocketMap.has(uid)) return;
  const set = userSocketMap.get(uid);
  set.delete(socketId);
  if (set.size === 0) userSocketMap.delete(uid);
}

export function initSocket(server, opts = {}) {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
    },
  });

  // small auth example: JWT in handshake.auth.token
  // server/sockets/socket.js
io.use((socket, next) => {
  try {
    const rawCookie = socket.request.headers.cookie;
    if (!rawCookie) return next(); // allow unauthenticated sockets if you want

    const cookies = cookie.parse(rawCookie);

    // ⚠️ MUST match cookie name used in auth login
    const token = cookies.token;

    if (!token) return next();

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    socket.data.userId = String(payload.id);
    socket.data.username = payload.username;

    return next();
  } catch (err) {
    console.error("Socket auth error:", err.message);
    return next(); // or next(new Error("Authentication error"))
  }
});


  return io;
}

export function emitToUser(userId, event, payload) {
  const ids = getReceiverSocketIds(String(userId));
  if (!io) return;
  ids.forEach((sid) => io.to(sid).emit(event, payload));
}

export function emitToRoom(roomId, event, payload) {
  if (!io) return;
  io.to(roomId).emit(event, payload);
}

export function getIO() {
  return io;
}
