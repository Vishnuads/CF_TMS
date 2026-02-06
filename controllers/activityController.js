const UserActivity = require("../models/UserActivity");

exports.saveActivity = async (req, res) => {
  try {
    const { browser, os, device } = req.body;

    await UserActivity.findOneAndUpdate(
      { user: req.user._id },
      {
        browser,
        os,
        device,
        ip: req.ip,
        lastSeen: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: "Activity save failed" });
  }
};

exports.getAllActivities = async (req, res) => {
  const data = await UserActivity.find().populate("user", "name email");
  res.json(data);
};
