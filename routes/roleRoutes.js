// routes/roleRoutes.js
const router = require("express").Router();
const { getRoles } = require("../controllers/roleController");
const {auth, adminOnly} = require("../middleware/auth.middleware");
// const adminOnly = require("../middleware/adminOnly");

router.get("/getroles",  getRoles);

module.exports = router;
