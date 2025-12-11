// src/lib/socket.js
import { io } from "socket.io-client";

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (typeof window !== "undefined" ? window.location.origin : "");

let socket = null;

/**
 * Initialize the socket (call once on client start).
 * Returns the socket instance.
 */
export function initSocket() {
  if (socket) return socket;

  // create the socket client with helpful defaults
  socket = io(SOCKET_URL, {
    autoConnect: true,
    withCredentials: true, // send cookies during handshake
    // recommended reconnection behavior
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    transports: ["websocket", "polling"],
  });

  // expose for debugging or legacy code
  if (typeof window !== "undefined") {
    window.__socket = socket;
  }

  return socket;
}

/**
 * Return the current socket instance (or null).
 * Does NOT create a socket automatically.
 */
export function getSocket() {
  if (socket) return socket;
  if (typeof window !== "undefined" && window.__socket) return window.__socket;
  return null;
}

/**
 * Disconnect and clear the instance (useful on logout).
 */
export function disconnectSocket() {
  if (socket) {
    try {
      socket.disconnect();
    } catch (e) {
      // ignore
    }
    socket = null;
  }
  if (typeof window !== "undefined") {
    window.__socket = null;
  }
}

export default getSocket;
