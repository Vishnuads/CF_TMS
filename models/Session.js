const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  token: String,
  isValid: { type: Boolean, default: true },
  lastActive: Date
});

module.exports = mongoose.model("Session", SessionSchema);
 