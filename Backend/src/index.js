// index.js (replace your current file with this)
import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import jwt from "jsonwebtoken";

import conDb from "./lib/db-lib.js";

import authRoutes from "./routes/auth-routes.js";
import chatRoutes from "./routes/chat-routes.js";
import messageRoutes from "./routes/message-routes.js";
import userRoutes from "./routes/user-routes.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

console.log("FRONTEND_URL:", process.env.FRONTEND_URL);

app.use("/api/auth/", authRoutes);
app.use("/api/message/", messageRoutes);
app.use("/api/user/", userRoutes);
app.use("/api/chat/", chatRoutes);

// create http server and attach socket.io
import { Server as IoServer } from "socket.io";
const httpServer = http.createServer(app);

const io = new IoServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
  },
});

// expose io to controllers via app.set('io')
app.set("io", io);
io.use((socket, next) => {
  try {
    // helper: read cookie value by name from cookie header
    const getCookieValue = (cookieHeader = "", name) => {
      if (!cookieHeader) return null;
      const parts = cookieHeader.split(";").map((s) => s.trim());
      const found = parts.find((p) => p.startsWith(`${name}=`));
      if (!found) return null;
      return decodeURIComponent(found.split("=").slice(1).join("="));
    };

    // 1) try handshake.auth.token (preferred if client set it)
    let token = socket.handshake.auth?.token || null;

    // 2) fallback to Authorization header
    if (!token && socket.handshake.headers?.authorization) {
      token = socket.handshake.headers.authorization;
    }

    // 3) fallback to cookie header (cookie name 'jwt' — change if different)
    if (!token && socket.handshake.headers?.cookie) {
      const cookieToken = getCookieValue(socket.handshake.headers.cookie, "jwt");
      if (cookieToken) token = cookieToken;
    }

    if (!token) {
      // no token — continue anonymously. If you want to reject, use:
      // return next(new Error("Authentication required"));
      return next();
    }

    // strip "Bearer " if present
    const raw = String(token).startsWith("Bearer ") ? String(token).split(" ")[1] : token;

    const payload = jwt.verify(raw, process.env.JWT_SECRET);
    socket.userId = payload.userId || payload.id || payload._id;

    return next();
  } catch (err) {
    console.warn("socket auth failed:", err?.message || err);
    // continue without userId (or reject with next(new Error("auth failed")))
    return next();
  }
});


// On connection, join room for userId (if present)
io.on("connection", (socket) => {
  if (socket.userId) {
    try {
      socket.join(String(socket.userId));
      console.log(`socket ${socket.id} joined room user:${socket.userId}`);
    } catch (e) {
      console.warn("join room failed:", e?.message || e);
    }
  } else {
    console.log(`socket ${socket.id} connected (no userId)`);
  }

  socket.on("disconnect", (reason) => {
    console.log("socket disconnected:", socket.id, reason);
  });

  // optional debug handler
  socket.on("pingServer", (cb) => cb && cb({ ok: true, time: Date.now() }));
});

// start DB then httpServer (so controllers can use io)
const startServer = async () => {
  try {
    await conDb();
    httpServer.listen(PORT, () => {
      console.log(`app listening on port ${PORT}`);
    });
  } catch (error) {
    console.log("failed to start server", error?.message ?? error);
  }
};

startServer();
