const jwt = require("jsonwebtoken");
// const Session = require("../models/Session");
const Session = require("../models/Session");
const User = require("../models/User");







exports.auth = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    const session = await Session.findOne({ token, isValid: true });
    if (!session) return res.status(401).json({ message: "Session expired" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ LOAD USER + ROLE + PERMISSIONS
    const user = await User.findById(decoded.id)
      .populate("role"); // role contains permissions

    if (!user || !user.isActive)
      return res.status(401).json({ message: "User not active" });

    req.user = {
      id: user._id,
      role: user.role.name,
      permissions: user.role.permissions
    };

    session.lastActive = new Date();
    await session.save();

    next();
  } catch (err) {
    console.error("Auth error:", err.message);
    res.status(401).json({ message: "Invalid token" });
  }
};



exports.adminOnly = (req, res, next) => {
  if (req.user.role !== "ADMIN")
    return res.status(403).json({ message: "Admin only" });
  next();
};
