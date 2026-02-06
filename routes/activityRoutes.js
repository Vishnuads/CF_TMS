const router = require("express").Router();
const { saveActivity, getAllActivities } = require("../controllers/activityController");
const { auth, adminOnly } = require("../middleware/auth.middleware");

router.post("/activity", auth, saveActivity);
router.get("/activity", auth, adminOnly, getAllActivities);

module.exports = router;
