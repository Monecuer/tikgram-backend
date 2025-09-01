// tikgram-backend/models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true }, // who receives it
    actor:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },              // who did the action
    type:      { type: String, enum: ["like","comment","follow","reaction"], required: true },
    post:      { type: mongoose.Schema.Types.ObjectId, ref: "Post" },              // optional
    meta:      { type: Object, default: {} },                                       // e.g. {text:"Nice!" , reaction:"❤️"}
    isRead:    { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
