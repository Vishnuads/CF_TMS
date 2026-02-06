// controllers/userController.js
const Role = require("../models/Role");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    let updateData = {};
    if (role) {
      // ✅ Admin can update all fields
      updateData = { ...req.body };
      if (req.body.password) {
        updateData.password = await bcrypt.hash(req.body.password, 10);
      }
    } 
 

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select("-password");

    res.json({
      message: "Profile updated successfully",
      user: updatedUser
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Profile update failed" });
  }
};

// controllers/userController.js
exports.getMyProfile = async (req, res) => {
  const user = await User.findById(req.user.id).select("-password").populate("role", "_id name");
  res.json(user);

  // const user = await User.findById(req.user.id)
  //   .populate("role");

  // res.json({
  //   id: user._id,
  //   name: user.name,
  //   email: user.email,
  //   role: user.role.name,
  //   permissions: user.role.permissions, 
  // });
};

exports.getRolePermissions = async (req, res) => {
  const role = await Role.findById(req.params.roleId);
  res.json(role.permissions);
};


// ✅ GET ALL USERS (ARRAY ONLY)
exports.getAllUsers = async (req, res) => {
  try {
    // const users = await User.find().select("-password");
    const users = await User.find().select("name email isOnline role isActive").populate("role", "name");
  // .populate("role", "name"); 
   
    
  
    res.json(users); 
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
};


// ✅ UPDATE USER
exports.updateUser = async (req, res) => {
  const { id } = req.params;
  const updatedUser = await User.findByIdAndUpdate(id, req.body, { new: true });
  res.json(updatedUser);
};


// ✅ DELETE USER
exports.deleteUser = async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: "User deleted" });
};


// ADMIN → Users by Role
exports.getUsersByRole = async (req, res) => {
  const { roleId } = req.params;

  const users = await User.find({ role: roleId })
    .select("name email isOnline")
    .populate("role", "name");

  res.json(users);
};