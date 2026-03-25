// const mongoose = require("mongoose");

// const ScreenshotSchema = new mongoose.Schema({
//   filename: { type: String, required: true },
//   path: { type: String, required: true },
//   createdAt: { type: Date, default: Date.now },
// });

// module.exports = mongoose.model("Screenshotelectron", ScreenshotSchema);




















// models/ScreenshotElectron.js

const mongoose = require("mongoose");

const ScreenshotSchema = new mongoose.Schema(
  {
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,          // fast per-user queries
    },
    filename: {
      type:     String,
      required: true,
    },
    // Relative URL served by Express: /uploads/screenshots/<filename>
    // Stored relative so the app works across environments (dev / prod / Docker)
    imageUrl: {
      type:     String,
      required: true,
    },
    // Absolute path on the machine that captured the screenshot (Electron host)
    localPath: {
      type: String,
    },
    capturedAt: {
      type:    Date,
      default: Date.now,
      index:   true,
    },
  },
  { timestamps: true }
);

// Compound index: look up "all screenshots for user X, newest first"
ScreenshotSchema.index({ user: 1, capturedAt: -1 });

// Prevent duplicate uploads of the same file for the same user
ScreenshotSchema.index({ user: 1, filename: 1 }, { unique: true });

module.exports = mongoose.model("Screenshotelectron", ScreenshotSchema);
