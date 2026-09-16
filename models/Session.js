const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  token: String,
  isValid: { type: Boolean, default: true },
      client: { type: String, enum: ["web", "desktop"], default: "web" }, // NEW
  lastActive: Date
},  { timestamps: true });

module.exports = mongoose.model("Session", SessionSchema);
 