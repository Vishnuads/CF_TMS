const router = require("express").Router();
const { login, logout, register } = require("../controllers/auth.controller");
const { auth, adminOnly } = require("../middleware/auth.middleware");
const permission = require("../middleware/permission");
const User = require("../models/User");



router.post("/login", login);
router.post("/logout", auth, logout);
// Register (Admin creates users)
router.post("/register",auth, permission("users", "create"), register);


// router.get("/users", auth, async (req, res) => {
//   const users = await User.find()
//     .select("name email isOnline role")
//     .populate("role", "name");

//   res.json(users);
// });

module.exports = router;
