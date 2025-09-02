import express from "express";
import auth from "../middleware/authMiddleware.js";
import Notification from "../models/Notification.js";

const router = express.Router();

// Get notifications for the logged-in user
router.get("/", auth, async (req, res) => {
  try {
    const list = await Notification.find({ recipient: req.user.id })
      .populate("actor", "username avatarUrl")
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Mark notifications as read
router.post("/read", auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { $set: { read: true } }
    );
    res.json({ msg: "All marked as read" });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
