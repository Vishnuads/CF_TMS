// const mongoose = require("mongoose");

// const SessionSchema = new mongoose.Schema(
//   {
//     loginTime: { type: Date, required: true },
//     logoutTime: { type: Date, default: null },
//     duration: { type: Number, default: 0 }, // seconds

    

//     autoClosed: { type: Boolean, default: false },
//     closeReason: {
//       type: String,
//       enum: ["manual", "tab-closed", "disconnect", "daily-sweep"],
//       default: "manual",
//     },


//   },
//   { _id: true }
// );

// const AttendanceSchema = new mongoose.Schema(
//   {
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },

//     date: {
//       type: Date,
//       required: true,
//     },

//     loginTime: {
//       type: Date,
//       required: true,
//     },
//     logoutTime: {
//       type: Date,
//       default: null,
//     },
//     totalDuration: {
//       type: Number,
//       default: 0,
//     },
//     sessions: {
//       type: [SessionSchema],
//       default: [],
//     },

//     status: {
//       type: String,
//       enum: ["PRESENT", "HALF_DAY", "ABSENT"],
//       default: "PRESENT",
//     },
//   },
//   { timestamps: true }
// );

// AttendanceSchema.index({ user: 1, date: 1 }, { unique: true });

// module.exports = mongoose.model("Attendance", AttendanceSchema);
























const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema(
  {
    loginTime: { type: Date, required: true },
    logoutTime: { type: Date, default: null },
    duration: { type: Number, default: 0 }, // seconds

    // ============================================================
    // THE FIX — HEARTBEAT TIMESTAMP
    // ============================================================
    // Without this, an "open" session (logoutTime: null) looks
    // identical whether the person genuinely reconnected 5 seconds
    // ago OR whether the server crashed/restarted hours ago and
    // nothing ever got the chance to close it. `lastSeenAt` is
    // updated on every heartbeat (presence-ping, join-user) while a
    // connection is genuinely alive. When someone reopens a tab,
    // the server can now tell the difference:
    //   - lastSeenAt is recent  -> this really is a continuous
    //     session (brief network blip, page navigation, etc.) —
    //     just keep it open, no new session needed.
    //   - lastSeenAt is stale   -> nobody has actually been present
    //     for a while (crash, server restart, dead battery) — close
    //     THIS session out as stale, then open a fresh one.
    // ============================================================
    lastSeenAt: { type: Date, default: null },

    autoClosed: { type: Boolean, default: false },
    closeReason: {
      type: String,
      enum: ["manual", "tab-closed", "disconnect", "daily-sweep", "stale-timeout"],
      default: "manual",
    },
  },
  { _id: true }
);

const AttendanceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    loginTime: {
      type: Date,
      required: true,
    },
    logoutTime: {
      type: Date,
      default: null,
    },
    totalDuration: {
      type: Number,
      default: 0,
    },
    sessions: {
      type: [SessionSchema],
      default: [],
    },

    status: {
      type: String,
      enum: ["PRESENT", "HALF_DAY", "ABSENT"],
      default: "PRESENT",
    },
  },
  { timestamps: true }
);

AttendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);