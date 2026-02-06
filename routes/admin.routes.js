const router = require("express").Router();
const { forceLogout, resetPassword } = require("../controllers/admin.controller");
const { auth, adminOnly } = require("../middleware/auth.middleware");
const Role = require("../models/Role");
const permission = require("../middleware/permission");
const socket = require("../socket");

router.post("/force-logout/:userId", auth, adminOnly, forceLogout);
router.post("/reset-password/:userId", auth, adminOnly, resetPassword);




/* Create Role */
// router.post("/roles", auth,
// async (req, res) => {
//   const role = await Role.create({ name: req.body.name?.toUpperCase().trim() });
//   res.json(role);
// });

router.post("/roles", auth, async (req, res) => {
  try {
    const name = req.body.name?.trim().toUpperCase();

    if (!name) {
      return res.status(400).json({
        message: "Role name is required",
      });
    }

    const role = await Role.create({ name });

    res.status(201).json(role);

  } catch (err) {
    // 🔴 Duplicate role (unique index)
    if (err.code === 11000) {
      return res.status(409).json({
        message: "Role already exists",
      });
    }

    console.error("Create role error:", err);

    res.status(500).json({
      message: "Failed to create role",
    });
  }
});


/* Get All Roles */
router.get("/roles", async (req, res) => {
  const roles = await Role.find();
  res.json(roles);
});

/* Update Permission */
router.put("/roles/permission", auth,  async (req, res) => {
  const { roleId, page, action, value } = req.body;
  const role = await Role.findById(roleId);
  let permission = role.permissions.find(p => p.page === page);

  if (!permission) {
    permission = {
      page,
      actions: { view: false, create: false, edit: false, delete: false }
    };
    role.permissions.push(permission);
  }
  permission.actions[action] = value;
  await role.save();
     // 🔥 REAL-TIME EMIT
   socket.getIO().emit("permissions-updated", roleId);
  res.json({ message: "Permission updated" });
});


/* Delete Role */
router.delete("/roles/:id", auth,  async (req, res) => {
  try {
    const roleId = req.params.id;

    // ❌ Prevent deleting ADMIN role
    const role = await Role.findById(roleId);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    if (role.name === "ADMIN") {
      return res.status(400).json({ message: "ADMIN role cannot be deleted" });
    }

    await Role.findByIdAndDelete(roleId);

    res.json({ message: "Role deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete role" });
  }
});


module.exports = router;
