const mongoose = require("mongoose");

const UserActivitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    browser: String,
    os: String,
    device: String,
    ip: String,
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserActivity", UserActivitySchema);
