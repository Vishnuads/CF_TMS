const mongoose = require("mongoose");

const IdleLogSchema = new mongoose.Schema({
  from: Date,
  to: Date,
  reason: String,
});

const WorkSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    startTime: { type: Date, required: true },
    endTime: Date,

    totalWorkMs: { type: Number, default: 0 },
    totalIdleMs: { type: Number, default: 0 },

    idleLogs: [IdleLogSchema],

    status: {
      type: String,
      enum: ["RUNNING", "STOPPED"],
      default: "RUNNING",
    },
        lastSeenAt: { type: Date, default: Date.now }, // 🔥 IMPORTANT

  },
  { timestamps: true }
);

module.exports = mongoose.model("WorkSession", WorkSessionSchema);
