// tikgram-backend/routes/user.js
import express from "express";
import mongoose from "mongoose";
import multer from "multer";
import jwt from "jsonwebtoken";

import User from "../models/User.js";
import Post from "../models/Post.js";
import Notification from "../models/Notification.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();
const { ObjectId } = mongoose.Types;

/* ------------------------- helpers ------------------------- */
function escapeRegex(s = "") {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Optional auth: if token exists and is valid, attach req.user; otherwise continue
function authOptional(req, _res, next) {
  const header = req.header("Authorization");
  if (!header) return next();
  try {
    const token = header.replace("Bearer ", "");
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: decoded.id };
  } catch {
    // ignore invalid/expired token
  }
  next();
}

/* -------------------- avatar upload setup ------------------- */
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/avatars"),
  filename: (_req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    cb(new Error("Only image files are allowed for avatars"));
  },
});

/* ----------------------- GET /users/me ---------------------- */
router.get("/me", auth, async (req, res) => {
  const me = await User.findById(req.user.id).select("-password");
  if (!me) return res.status(404).json({ msg: "User not found" });

  const [likesAgg, remixesCount, postsCount] = await Promise.all([
    Post.aggregate([
      { $match: { userId: new ObjectId(req.user.id) } },
      { $project: { c: { $size: "$likes" } } },
      { $group: { _id: null, total: { $sum: "$c" } } },
    ]),
    Post.countDocuments({ remixOf: { $exists: true, $ne: null }, userId: req.user.id }),
    Post.countDocuments({ userId: req.user.id }),
  ]);

  res.json({
    user: me,
    stats: {
      followers: me.followers.length,
      following: me.following.length,
      totalLikes: likesAgg?.[0]?.total || 0,
      remixes: remixesCount || 0,
      posts: postsCount || 0,
    },
    isMe: true,
  });
});

/* ------------------- PATCH /users/me (edit) ------------------ */
// Accepts multipart/form-data:
//  - "avatar" (file) OR "avatarUrl" (string)
//  - "bio" (string)
router.patch("/me", auth, uploadAvatar.single("avatar"), async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ msg: "User not found" });

    const { bio, avatarUrl } = req.body;
    if (typeof bio === "string") me.bio = bio.slice(0, 220);
    if (req.file) {
      me.avatarUrl = `uploads/avatars/${req.file.filename}`;
    } else if (avatarUrl) {
      me.avatarUrl = avatarUrl; // allow external URL
    }

    await me.save();
    const user = await User.findById(me._id).select("-password");
    res.json({ user });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

/* -------------- GET /users/by-username/:username ------------- */
router.get("/by-username/:username", authOptional, async (req, res) => {
  try {
    const raw = req.params.username;
    const user = await User.findOne({
      username: { $regex: new RegExp(`^${escapeRegex(raw)}$`, "i") },
    }).select("-password");
    if (!user) return res.status(404).json({ msg: "User not found" });

    const [likesAgg, remixesCount, postsCount, isFollowing] = await Promise.all([
      Post.aggregate([
        { $match: { userId: new ObjectId(user._id) } },
        { $project: { c: { $size: "$likes" } } },
        { $group: { _id: null, total: { $sum: "$c" } } },
      ]),
      Post.countDocuments({ remixOf: { $exists: true, $ne: null }, userId: user._id }),
      Post.countDocuments({ userId: user._id }),
      req.user?.id ? User.exists({ _id: req.user.id, following: user._id }) : null,
    ]);

    res.json({
      user,
      stats: {
        followers: user.followers.length,
        following: user.following.length,
        totalLikes: likesAgg?.[0]?.total || 0,
        remixes: remixesCount || 0,
        posts: postsCount || 0,
      },
      isMe: req.user?.id?.toString() === user._id.toString(),
      isFollowing: !!isFollowing,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* --------------------- POST /users/:id/follow ---------------- */
// toggle follow/unfollow + create notification on follow
router.post("/:id/follow", auth, async (req, res) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user.id) return res.status(400).json({ msg: "Cannot follow yourself" });

    const [me, target] = await Promise.all([
      User.findById(req.user.id),
      User.findById(targetId),
    ]);
    if (!target) return res.status(404).json({ msg: "Target not found" });

    const already = me.following.some((u) => u.toString() === targetId);
    if (already) {
      me.following = me.following.filter((u) => u.toString() !== targetId);
      target.followers = target.followers.filter((u) => u.toString() !== me._id.toString());
    } else {
      me.following.push(target._id);
      target.followers.push(me._id);

      // notify the target user (not self)
      if (target._id.toString() !== me._id.toString()) {
        await Notification.create({
          recipient: target._id,
          actor: me._id,
          type: "follow",
        });
      }
    }
    await Promise.all([me.save(), target.save()]);

    res.json({
      following: !already,
      followerCount: target.followers.length,
      followingCount: me.following.length,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* --------------------- GET /users/:id/posts ------------------ */
router.get("/:id/posts", async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.params.id })
      .sort({ createdAt: -1 })
      .select("_id caption mediaUrl mediaType createdAt likes comments");
    res.json(posts);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
