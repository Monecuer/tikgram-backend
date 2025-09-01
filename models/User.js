// tikgram-backend/models/User.js
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    email:    { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },

    // Phase 3 fields
    avatarUrl: { type: String, default: "" },
    bio:       { type: String, default: "" },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    likedPublic: { type: Boolean, default: false }, // future: show liked tab
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
