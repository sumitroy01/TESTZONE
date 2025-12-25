// src/socket.js

import { io } from "socket.io-client";

let socket = null;
const pendingRooms = new Set();

export const initSocket = (backendUrl, token) => {
  if (socket) return socket;

  socket = io(backendUrl, {
    path: "/socket.io",
    transports: ["websocket", "polling"],
    withCredentials: true,
    autoConnect: true,
    auth: { token }, // server reads socket.handshake.auth.token
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
    pendingRooms.forEach((roomId) =>
      socket.emit("join_room", roomId)
    );
  });

  socket.on("reconnect", () => {
    pendingRooms.forEach((roomId) =>
      socket.emit("join_room", roomId)
    );
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
  });

  socket.on("connect_error", (err) => {
    console.error("socket connect_error", err);
  });

  return socket;
};

export const getSocket = () => socket;

export const markJoinedRoom = (roomId) => {
  if (roomId) pendingRooms.add(roomId);
};

export const markLeftRoom = (roomId) => {
  if (roomId) pendingRooms.delete(roomId);
};
