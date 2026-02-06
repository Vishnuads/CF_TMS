// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const { auth, adminOnly } = require("../middleware/auth.middleware");
const {
  updateProfile,
  getMyProfile,
  getAllUsers,
  updateUser,
  deleteUser,
  getUsersByRole,
  getRolePermissions
} = require("../controllers/userController");
const { route } = require("./auth.routes");
const permission = require("../middleware/permission");

router.put("/update-profile", auth, updateProfile);

// routes/userRoutes.js
// router.get("/users", getAllUsers);
router.get("/users", auth, permission("users", "view"), getAllUsers);
router.get("/employee/me", auth, getMyProfile);
router.get("/roles/:roleId/permissions", auth, getRolePermissions);
router.put("/admin/users/:id", auth, permission("users", "edit"), updateUser);
router.delete("/admin/users/:id", auth, permission("users", "delete"), deleteUser);



router.get("/users/role/:roleId", auth,  getUsersByRole);


module.exports = router;
