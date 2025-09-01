// tikgram-backend/routes/notification.js
import express from "express";
import Notification from "../models/Notification.js";
import auth from "../middleware/authMiddleware.js";

const router = express.Router();

// GET /api/notifications  -> latest 50 for me
router.get("/", auth, async (req, res) => {
  const items = await Notification.find({ recipient: req.user.id })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("actor", "username avatarUrl")
    .populate("post", "_id caption mediaUrl mediaType createdAt");
  res.json(items);
});

// PATCH /api/notifications/:id/read
router.patch("/:id/read", auth, async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, recipient: req.user.id }, { $set: { isRead: true } });
  res.json({ ok: true });
});

// POST /api/notifications/read  (mark all read)
router.post("/read", auth, async (req, res) => {
  await Notification.updateMany({ recipient: req.user.id, isRead: false }, { $set: { isRead: true } });
  res.json({ ok: true });
});

export default router;
