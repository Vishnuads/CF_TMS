// models/DailyReport.js
const mongoose = require("mongoose");

const DailyReportSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  projectName: {
    type: String,
    required: true
  },

  description: {
    type: String,
    required: true
  },

  status: {
    type: String,
    enum: ["DONE", "WORKING", "INCOMPLETE"],
    required: true
  },

  reportDate: {
    type: Date,
    default: Date.now
  }

}, { timestamps: true });

module.exports = mongoose.model("DailyReport", DailyReportSchema);
