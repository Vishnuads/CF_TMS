// models/Project.js
const mongoose = require("mongoose");

const ProjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: String,
    status: {
      type: String,
      enum: ["PLANNING", "ACTIVE", "COMPLETED", "ON_HOLD", "CANCELLED"],
      default: "PLANNING",
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
    },
    start_date: Date,
    end_date: Date,
    team_lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    team_members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // ✅ Progress added
    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Project", ProjectSchema);
