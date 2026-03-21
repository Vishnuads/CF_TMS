const express = require("express");
const router = express.Router();
const Screenshot = require("../models/ScreenshotElectron");

// POST screenshot info
router.post("/screenshot/save", async (req, res) => {
  try {
    const { filename, path } = req.body;
    const screenshot = new Screenshot({ filename, path });
    await screenshot.save();
    res.status(200).json({ message: "Screenshot saved" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;