const mongoose = require("mongoose");

const ScreenshotSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  path: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Screenshotelectron", ScreenshotSchema);