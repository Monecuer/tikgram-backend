// models/Post.js
import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    text: String,
  },
  { _id: true, timestamps: true }
);

const reactionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: { type: String, enum: ["❤️", "🔥", "😂", "😮", "😍", "💯"] },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    caption: { type: String, default: "" },
    mediaUrl: String,
    mediaType: { type: String, enum: ["image", "video"] },

    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    comments: [commentSchema],
    reactions: [reactionSchema],

    // real counters
    viewsCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    reactionsSummary: {
      type: Map,
      of: Number,
      default: { "❤️": 0, "🔥": 0, "😂": 0, "😮": 0, "😍": 0, "💯": 0 },
    },

    remixOf: { type: mongoose.Schema.Types.ObjectId, ref: "Post", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Post", postSchema);
