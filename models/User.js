const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Role"
},
  isActive: { type: Boolean, default: true },

   // ✅ ONLINE STATUS
    isOnline: { type: Boolean, default: false },
  
}, { timestamps: true });    

module.exports = mongoose.model("User", UserSchema);
