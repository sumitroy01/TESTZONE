import { Server } from "socket.io";
import jwt from "jsonwebtoken";

const userSocketMap = new Map(); // userId -> Set(socketId)
const activeChatMap = new Map(); // userId -> chatId
let io = null;

/* ================= SOCKET MAP ================= */

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

export function getReceiverSocketIds(userId) {
  const s = userSocketMap.get(String(userId));
  return s ? Array.from(s) : [];
}

export function getOnlineUsers() {
  return Array.from(userSocketMap.keys());
}

/* ================= ACTIVE CHAT ================= */

export function setActiveChat(userId, chatId) {
  if (!userId || !chatId) return;
  activeChatMap.set(String(userId), String(chatId));
}

export function clearActiveChat(userId, chatId) {
  if (!userId) return;
  const uid = String(userId);
  if (activeChatMap.get(uid) === String(chatId)) {
    activeChatMap.delete(uid);
  }
}

export function getActiveChat(userId) {
  return activeChatMap.get(String(userId)) || null;
}

/* ================= SOCKET INIT ================= */

export function initSocket(server) {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next();
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.data.userId = String(payload.id);
      socket.data.username = payload.username;
      next();
    } catch {
      next();
    }
  });

  return io;
}

/* ================= EMITTERS ================= */

export function emitToUser(userId, event, payload) {
  if (!io) return;
  const ids = getReceiverSocketIds(String(userId));
  ids.forEach((sid) => io.to(sid).emit(event, payload));
}

export function emitToRoom(roomId, event, payload) {
  if (!io) return;
  io.to(roomId).emit(event, payload);
}

export function getIO() {
  return io;
}
