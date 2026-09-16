// const mongoose = require("mongoose");

// const UserSchema = new mongoose.Schema({
//   name: String,
//   email: { type: String, unique: true },
//   password: String,
//   role: {
//   type: mongoose.Schema.Types.ObjectId,
//   ref: "Role"
// },
//   isActive: { type: Boolean, default: true }, 

//    // ✅ ONLINE STATUS
//     isOnline: { type: Boolean, default: false },
  
// }, { timestamps: true });    

// module.exports = mongoose.model("User", UserSchema);
























const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: mongoose.Schema.Types.ObjectId, ref: "Role" },
  isActive: { type: Boolean, default: true },

  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: null },

  // NEW — three-state presence, distinct from isOnline (connectivity)
  presenceStatus: {
    type: String,
    enum: ["ONLINE", "IDLE", "OFFLINE"],
    default: "OFFLINE",
  },
  idleSeconds: { type: Number, default: 0 },
  lastActivityAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);