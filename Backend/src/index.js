// src/index.js (replace the top / CORS part of your file with this)
import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cookieParser from "cookie-parser";
import conDb from "./lib/db.js";
import userRoutes from "./routes/user.routes.js";
import profileRouter from "./routes/profile.routes.js";
import donationRouter from "./routes/donations.js";
import cors from "cors";

const app = express();
const FRONTEND = "https://donate-v2-jgkc.onrender.com"; // hardcoded for now

// log incoming requests + origin
app.use((req, res, next) => {
  console.log(`[REQ] ${req.method} ${req.path} Origin: ${req.headers.origin || "-"}`);
  next();
});

// CORS: simple, explicit
const corsOptions = {
  origin: FRONTEND,
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type","Authorization","X-Requested-With","Accept","Origin"],
};

app.use(cors(corsOptions));

// safe preflight handler (regex avoids path-to-regexp '*' bug)
app.options(/.*/, cors(corsOptions));

// parsers
app.use(express.json());
app.use(cookieParser());

// routes (no trailing slash mismatch)
app.use("/api/user", userRoutes);
app.use("/api/profile", profileRouter);
app.use("/api/donations", donationRouter);

// error handler — ensures CORS headers on error responses
app.use((err, req, res, next) => {
  console.error("[ERROR]", err && err.stack ? err.stack : err);
  const origin = req.headers.origin || FRONTEND;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
  res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
});

const PORT = process.env.PORT || 3000;
console.log("MONGO_URI is:", process.env.MONGO_URI);

const startServer = async () => {
  try {
    await conDb();
    app.listen(PORT, () => console.log(`App running on port ${PORT}`));
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
