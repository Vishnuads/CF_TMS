const router = require("express").Router();
const { uploadScreenshot, getScreenshots, getUserScreenshot, getScreenshotsByUser, deleteScreenshots } = require("../controllers/screenshotController");
const { auth, adminOnly } = require("../middleware/auth.middleware");
const userAuth = require("../middleware/chatAuth")

router.post("/screenshots", userAuth, uploadScreenshot);
router.get("/screenshots", auth, getScreenshots);
router.get("/screenshots/me", userAuth, getUserScreenshot);


// routes/screenshot.routes.js
router.get(
  "/screenshots/user/:userId",
  auth,
  getScreenshotsByUser
);

router.delete("/screenshots", auth, deleteScreenshots);


module.exports = router;
