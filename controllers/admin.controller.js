const Session = require("../models/Session");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

exports.forceLogout = async (req, res) => {
  await Session.updateMany(
    { userId: req.params.userId },
    { isValid: false }
  );
  res.json({ message: "User force logged out" });
};

exports.resetPassword = async (req, res) => {
  const hashed = await bcrypt.hash(req.body.password, 10);
  await User.findByIdAndUpdate(req.params.userId, { password: hashed });
  res.json({ message: "Password reset successfully" });
};
