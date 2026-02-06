const mongoose = require("mongoose");

const ScreenshotSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  imageUrl: String,
  capturedAt: Date
}, { timestamps: true });

module.exports = mongoose.model("Screenshot", ScreenshotSchema);
 