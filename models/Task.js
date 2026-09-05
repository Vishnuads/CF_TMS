

const mongoose = require("mongoose");

const TimeSessionSchema = new mongoose.Schema(
  {
    startedAt: {
      type: Date,
      required: true,
    },

    stoppedAt: {
      type: Date,
      default: null,
    },

    duration: {
      type: Number,
      default: 0,
      // Duration in seconds
    },
  },
  { _id: true },
);

const TaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },

    description: String,

    type: {
      type: String,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    assigned_to: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // status: {
    //   type: String,
    //   enum: ["TODO", "IN_PROGRESS", "DONE"],
    //   default: "TODO",
    // },

    status: {
      type: String,
      enum: ["TODO", "IN_PROGRESS", "ON_HOLD", "DONE"],
      default: "TODO",
    },

    assignedTime: {
  type: Number,
  default: 0,
},

    completedAt: {
      type: Date,
      default: null,
    },

    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
    },

    start_date: {
      type: Date,
    },

    due_date: {
      type: Date,
    },

    attachments: [
      {
        originalName: String,
        fileName: String,
        fileType: String,
        fileSize: Number,
        fileUrl: String,
      },
    ],

    isRead: {
      type: Boolean,
      default: false,
    },

    // =====================================================
    // TASK TIMER
    // =====================================================

    timerRunning: {
      type: Boolean,
      default: false,
    },

    timerStartedAt: {
      type: Date,
      default: null,
    },

    // Total accumulated time in seconds
    totalTimeSpent: {
      type: Number,
      default: 0,
    },

    // Start / Stop history
    timeSessions: {
      type: [TimeSessionSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Task", TaskSchema);
