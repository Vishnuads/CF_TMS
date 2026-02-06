
  // controllers/reportController.js
const DailyReport = require("../models/DailyReport");
const { getIO } = require("../socket"); // adjust path if needed


// USER → Add Report
exports.addReport = async (req, res) => {
  const { projectName, description, status } = req.body;

  const report = await DailyReport.create({
    user: req.user._id,
    projectName,
    description,
    status
  });


    // 🔔 Emit to admin dashboard
  const io = getIO();
  io.emit("report-added", {
    _id: report._id,
    // reportId: report._id,
    user: req.user._id,
    projectName,
    description,
    status,
    createdAt: report.createdAt,
  });

  res.status(201).json(report);
};

// USER → Own Reports
exports.getMyReports = async (req, res) => {
  const reports = await DailyReport.find({ user: req.user._id })
    .sort({ createdAt: -1 });

  res.json(reports);
};

// ADMIN → Reports by Selected User
exports.getReportsByUser = async (req, res) => {
  const { userId } = req.params;

  const reports = await DailyReport.find({ user: userId })
    .populate("user", "name email")
    .sort({ createdAt: -1 });

  res.json(reports);
};

/* UPDATE */
exports.updateReport = async (req, res) => {
  const { id } = req.params;

  const report = await DailyReport.findOneAndUpdate(
    { _id: id, user: req.user._id },
    req.body,
    { new: true }
  );


   // 🔔 Emit update event to ADMIN
  const io = getIO();
  io.emit("report-updated", {
    report,
  });


  res.json(report);
};




exports.deleteReport = async (req, res) => {
  const { id } = req.params;

  const report = await DailyReport.findByIdAndDelete(id);

  if (!report) {
    return res.status(404).json({ message: "Report not found" });
  }
    

  const io = getIO();

  // ✅ emit ONLY to admin dashboard
  io.to("admin").emit("report-deleted", {
    reportId: report._id.toString(),
    userId: report.user.toString(),
  });

  res.json({ success: true });
};


exports.deleteReportByAdmin = async (req, res) => {
  const { id } = req.params;

  const report = await DailyReport.findByIdAndDelete(id);

  if (!report) {
    return res.status(404).json({ message: "Report not found" });
  }

  const io = getIO();

  io.to("admin").emit("report-deleted", {
    reportId: report._id.toString(),
    userId: report.user.toString(),
  });

  res.json({ success: true });
};



exports.deleteMultipleReports = async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: "No report IDs provided" });
  }

  await DailyReport.deleteMany({ _id: { $in: ids } });

  const io = getIO();
  ids.forEach((id) => {
    io.to("admin").emit("report-deleted", { reportId: id });
  });

  res.json({ success: true });
};
