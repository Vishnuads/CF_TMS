const mongoose = require("mongoose");

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
//   { _id: true },
// );

const SessionSchema = new mongoose.Schema(
  {
    loginTime: { type: Date, required: true },
    logoutTime: {
       type: Date,
        default: null },
    duration: { type: Number, default: 0 },

    autoClosed: { type: Boolean, default: false },
    closeReason: {
      type: String,
      enum: [
        "manual",
        "tab-closed",
        "disconnect",
        "daily-sweep",
        "admin-approved",
      ],
      default: "manual",
    },

    // NEW — who/what actually closed this session
    logoutType: {
      type: String,
      enum: ["MANUAL", "AUTO", "ADMIN_APPROVED", "TAB_CLOSED", "DISCONNECT"],
      default: "MANUAL",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: { type: Date, default: null },
  },
  { _id: true },
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

    //new
    needsApproval: {
      type: Boolean,
      default: false,
    },

    status: {
      type: String,
      enum: ["PRESENT", "HALF_DAY", "ABSENT"],
      default: "PRESENT",
    },
  },
  { timestamps: true },
);

AttendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", AttendanceSchema);
