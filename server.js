// server.js (ESM)
// Run-time env: NODE_ENV, PORT, MONGO_URI, JWT_SECRET, (optional) MONGO_DB

import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// ---- Load env ---------------------------------------------------------------
dotenv.config();

// ---- ESM __dirname helper ---------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- App --------------------------------------------------------------------
const app = express();
app.set("trust proxy", 1); // required on Render/Proxies

// ---- CORS (open while you validate prod; tighten later) ---------------------
const corsOptions = {
  origin: true, // reflect request origin
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight handler

// ---- Body parsers -----------------------------------------------------------
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// ---- Static: uploads (note: Render disk is ephemeral) -----------------------
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    etag: true,
    maxAge: "1d",
  })
);

// ---- Routes -----------------------------------------------------------------
import authRoutes from "./routes/auth.js";
import postRoutes from "./routes/post.js";
import userRoutes from "./routes/user.js";
import notificationRoutes from "./routes/notification.js";

app.use("/api/auth", authRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);

// ---- Health/info ------------------------------------------------------------
app.get("/", (_req, res) => {
  res.type("text").send("🚀 TikGram API is live");
});
app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ---- 404 (JSON) -------------------------------------------------------------
app.use((req, res) => {
  res.status(404).json({ msg: "Not found", path: req.originalUrl });
});

// ---- Error handler (keeps CORS headers intact) ------------------------------
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return;
  res.status(err.status || 500).json({ error: err.message || "Server error" });
});

// ---- DB + Start -------------------------------------------------------------
const PORT = process.env.PORT || 5001;

async function start() {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      dbName: process.env.MONGO_DB || undefined,
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10,
    });
    console.log("✅ Mongo connected:", conn.connection.name);

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Backend running on http://localhost:${PORT}`);
    });
  } catch (e) {
    console.error("❌ DB connection error:", e);
    process.exit(1);
  }
}

start();

export default app;
