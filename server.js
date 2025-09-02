// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";

// routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import postRoutes from "./routes/post.js";
import notificationRoutes from "./routes/notification.js";

dotenv.config();

/* 1) CREATE APP FIRST */
const app = express();
const PORT = process.env.PORT || 5001;

/* 2) THEN CONFIGURE APP */
app.set("trust proxy", 1);
app.use(cors({
  origin: [process.env.CORS_ORIGIN, "http://localhost:5173"].filter(Boolean),
  credentials: true,
}));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

// static uploads (no cache)
app.use("/uploads", express.static("uploads", {
  etag: false, lastModified: false, maxAge: 0,
  setHeaders: (res) => res.setHeader("Cache-Control", "no-store"),
}));

// health
app.get("/", (_req, res) => res.send("🚀 TikGram API Running…"));
app.get("/healthz", (_req, res) => res.json({ ok: true }));

/* 3) MOUNT ROUTES */
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/notifications", notificationRoutes);

/* 4) DB + START */
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () => console.log(`✅ Backend running on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error("❌ DB connection error:", err);
    process.exit(1);
  });
