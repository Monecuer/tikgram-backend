// routes/post.js
import express from "express";
import multer from "multer";
import jwt from "jsonwebtoken";
import Post from "../models/Post.js";
import PostView from "../models/PostView.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

/* ---------------- optional auth (for /view) ---------------- */
function authOptional(req, _res, next) {
  const header = req.header("Authorization");
  if (!header) return next();
  try {
    const token = header.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id };
  } catch { /* ignore invalid token */ }
  next();
}

/* ------------------- uploads (multer) ------------------- */
const storage = multer.diskStorage({
  destination: (_req, file, cb) => cb(null, "uploads/"),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage });

/* -------------------- Create post ----------------------- */
// Supports:
// - multipart/form-data with field "media" (image/* or video/*) + "caption"
// - application/json { caption: "..."} for text-only posts
router.post("/", auth, upload.single("media"), async (req, res) => {
  try {
    const file = req.file || null;
    const mediaUrl = file ? `uploads/${file.filename}` : null;
    const mediaType = file
      ? file.mimetype.startsWith("video")
        ? "video"
        : "image"
      : undefined;

    const post = await Post.create({
      userId: req.user.id,
      caption: req.body.caption || "",
      mediaUrl,
      mediaType,
    });

    res.status(201).json(post);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ---------------------- Feed (newest) ------------------- */
router.get("/", auth, async (_req, res) => {
  try {
    const posts = await Post.find({})
      .populate("userId", "username avatarUrl")
      .populate("comments.userId", "username")
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ----------------------- Like toggle -------------------- */
router.post("/:id/like", auth, async (req, res) => {
  try {
    const p = await Post.findById(req.params.id);
    if (!p) return res.status(404).json({ msg: "Post not found" });

    const i = p.likes.findIndex((u) => u.toString() === req.user.id);
    if (i !== -1) p.likes.splice(i, 1);
    else p.likes.push(req.user.id);

    await p.save();
    res.json({ likes: p.likes.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ----------------------- Comments ----------------------- */
// Add a comment
router.post("/:id/comment", auth, async (req, res) => {
  try {
    const p = await Post.findById(req.params.id);
    if (!p) return res.status(404).json({ msg: "Post not found" });

    const text = (req.body.text || "").toString().slice(0, 2200).trim();
    if (!text) return res.status(400).json({ msg: "Empty comment" });

    p.comments.push({ userId: req.user.id, text });
    p.commentsCount = (p.commentsCount || 0) + 1;
    await p.save();
    await p.populate("comments.userId", "username");

    res.json({ comments: p.comments, commentsCount: p.commentsCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get comments
router.get("/:id/comments", auth, async (req, res) => {
  try {
    const p = await Post.findById(req.params.id).populate(
      "comments.userId",
      "username"
    );
    if (!p) return res.status(404).json({ msg: "Post not found" });

    res.json({
      comments: p.comments,
      commentsCount: p.commentsCount ?? p.comments.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ----------------------- Reactions ---------------------- */
const EMOJIS = ["❤️", "🔥", "😂", "😮", "😍", "💯"];

router.post("/:id/react", auth, async (req, res) => {
  try {
    const { type } = req.body;
    if (!EMOJIS.includes(type))
      return res.status(400).json({ msg: "Invalid reaction" });

    const p = await Post.findById(req.params.id);
    if (!p) return res.status(404).json({ msg: "Post not found" });

    const mine = p.reactions.find((r) => r.userId.toString() === req.user.id);

    if (!mine) {
      p.reactions.push({ userId: req.user.id, type });
    } else if (mine.type === type) {
      // toggle off
      p.reactions = p.reactions.filter(
        (r) => r.userId.toString() !== req.user.id
      );
    } else {
      mine.type = type;
    }

    // rebuild summary map
    const summary = new Map(EMOJIS.map((e) => [e, 0]));
    for (const r of p.reactions) {
      summary.set(r.type, (summary.get(r.type) || 0) + 1);
    }
    p.reactionsSummary = summary;

    await p.save();
    res.json({
      reactions: p.reactions,
      reactionsSummary: Object.fromEntries(summary),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ------------------------- Views ------------------------ */
// one view per day per user (or per IP if not logged in)
router.post("/:id/view", authOptional, async (req, res) => {
  try {
    const postId = req.params.id;
    const p = await Post.findById(postId);
    if (!p) return res.status(404).json({ msg: "Post not found" });

    const ip =
      (req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? "") ||
      req.socket?.remoteAddress ||
      req.ip ||
      "0.0.0.0";
    const key = req.user?.id ? `u:${req.user.id}` : `ip:${ip}`;
    const day = new Date().toISOString().slice(0, 10).replace(/-/g, ""); // YYYYMMDD

    // upsert daily unique view; only inc if first time
    try {
      await PostView.create({ postId, key, day });
      await Post.updateOne({ _id: postId }, { $inc: { viewsCount: 1 } });
    } catch {
      // duplicate -> already counted today
    }

    const updated = await Post.findById(postId).select(
      "viewsCount commentsCount reactionsSummary likes"
    );
    res.json({
      viewsCount: updated?.viewsCount || 0,
      commentsCount: updated?.commentsCount || 0,
      reactionsSummary: Object.fromEntries(updated?.reactionsSummary || []),
      likes: updated?.likes?.length || 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
