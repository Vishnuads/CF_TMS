const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.join(__dirname, "config", ".env") });

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("./models/User");
const Role = require("./models/Role");

// 🔍 DEBUG
console.log("DATABASE =", process.env.DATABASE);

mongoose.connect(process.env.DATABASE)
  .then(() => console.log("MongoDB connected"))
  .catch(err => {
    console.error("Mongo error:", err.message);
    process.exit(1);
  });

const createAdmin = async () => {
  const adminRole = await Role.findOne({ name: "ADMIN" });
  if (!adminRole) {
    throw new Error("ADMIN role not found. Run seedRoles.js first");
  }

  // ✅ CORRECT CHECK
  const exists = await User.findOne({ email: "anand@gmail.com" });
  if (exists) {
    console.log("Admin already exists");
    process.exit(0);
  }

  const password = await bcrypt.hash("admin123", 10);

  await User.create({
    name: "Super Admin",
    email: "anand@gmail.com",
    password,
    role: adminRole._id, // ✅ ObjectId
    isActive: true
  });

  console.log("Admin created successfully");
  process.exit(0);
};

createAdmin().catch(err => {
  console.error(err.message);
  process.exit(1);
});
