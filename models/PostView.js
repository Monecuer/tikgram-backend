// models/PostView.js
import mongoose from "mongoose";

const postViewSchema = new mongoose.Schema(
  {
    postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post", index: true },
    key: { type: String, index: true }, // "u:<userId>" or "ip:<ip>"
    day: { type: String, index: true }, // YYYYMMDD
  },
  { timestamps: true }
);

// unique per postId + key + day
postViewSchema.index({ postId: 1, key: 1, day: 1 }, { unique: true });

export default mongoose.model("PostView", postViewSchema);
