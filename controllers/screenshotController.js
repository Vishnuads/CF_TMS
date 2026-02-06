const Screenshot = require("../models/Screenshot");
const fs = require("fs");
const path = require("path");




exports.uploadScreenshot = async (req, res) => {
  try {
    const { image } = req.body;

    if (!image) {
      return res.status(400).json({ message: "No image provided" });
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const fileName = `ss_${Date.now()}.jpg`;
    const filePath = path.join(__dirname, "../uploads", fileName);

    fs.writeFileSync(filePath, base64Data, "base64");

    await Screenshot.create({
      user: req.user._id,
      imageUrl: `/uploads/${fileName}`,
      capturedAt: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Screenshot failed" });
  }
};



exports.getScreenshots = async (req, res) => {
  const shots = await Screenshot.find()
    .populate("user", "name")
    .sort({ createdAt: -1 });

  res.json(shots);
};


exports.getUserScreenshot =async (req,res) => {
  const shots = await Screenshot.find({ user: req.user.id });
  res.json(shots);

}



// controllers/screenshotController.js
exports.getScreenshotsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const shots = await Screenshot.find({ user: userId })
      .populate("user", "name")
      .sort({ createdAt: -1 });

    res.json(shots);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch screenshots" });
  }
};



exports.deleteScreenshots = async (req, res) => {
  try {
    // Accept either single ID or array of IDs
    const { ids } = req.body;
    if (!ids || !ids.length) {
      return res.status(400).json({ message: "No screenshots selected" });
    }

    // Fetch screenshots to delete
    const screenshots = await Screenshot.find({ _id: { $in: ids } });

    // Delete files from server
    screenshots.forEach(s => {
      const filePath = path.join(__dirname, "../uploads", path.basename(s.imageUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    });

    // Delete from database
    await Screenshot.deleteMany({ _id: { $in: ids } });

    res.json({ success: true, deletedCount: screenshots.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to delete screenshots" });
  }
};