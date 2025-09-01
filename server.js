// server.js
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
// before routes:
app.set("trust proxy", 1);
app.use(cors({
  origin: [process.env.CORS_ORIGIN, "http://localhost:5173"].filter(Boolean),
  credentials: true
}));

// Routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import postRoutes from "./routes/post.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

// Basic middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true }));

// Static uploads (no cache in dev helps with MOV/MP4 reloads)
app.use(
  "/uploads",
  express.static("uploads", {
    etag: false,
    lastModified: false,
    maxAge: 0,
    setHeaders: (res) => res.setHeader("Cache-Control", "no-store"),
  })
);
app.use("/uploads/avatars", express.static("uploads/avatars"));

// Health
app.get("/", (_req, res) => res.send("🚀 TikGram API Running…"));

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes); // <<<<<< REQUIRED

// Connect DB + start
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    app.listen(PORT, () =>
      console.log(`✅ Backend running on http://localhost:${PORT}`)
    );
  })
  .catch((err) => {
    console.error("❌ DB connection error:", err);
    process.exit(1);
  });
