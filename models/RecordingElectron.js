// // models/RecordingElectron.js
// const mongoose = require("mongoose");

// const RecordingSchema = new mongoose.Schema({
//   type:      { type: String, enum: ["audio", "video"], required: true },
//   filename:  { type: String, required: true },
//   path:      { type: String, required: true },
//   createdAt: { type: Date,   default: Date.now },
// });

// module.exports = mongoose.model("RecordingElectron", RecordingSchema);










// models/RecordingElectron.js

const mongoose = require("mongoose");

const RecordingSchema = new mongoose.Schema(
  {
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      index:    true,
    },
    type: {
      type:     String,
      enum:     ["audio", "video"],
      required: true,
    },
    filename: {
      type:     String,
      required: true,
    },
    // Relative URL: /uploads/recordings/<filename>
    fileUrl: {
      type:     String,
      required: true,
    },
    // Absolute path on the Electron host machine
    localPath: {
      type: String,
    },
    recordedAt: {
      type:    Date,
      default: Date.now,
      index:   true,
    },
  },
  { timestamps: true }
);

RecordingSchema.index({ user: 1, recordedAt: -1 });

module.exports = mongoose.model("RecordingElectron", RecordingSchema);

