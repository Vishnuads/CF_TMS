const express = require("express");
const router = express.Router();
const auth = require("../middleware/chatAuth");
const Project = require("../models/Project");
const Task = require("../models/Task");

router.get("/dashboard/stats", auth, async (req, res) => {
  try {
    const user = req.user;
    const roleName = user.role?.name;

    // ================== ADMIN ==================
    if (roleName === "ADMIN") {
      const totalProjects = await Project.countDocuments();

      const completedProjects = await Project.countDocuments({
        status: "COMPLETED",
      });

      const totalTasks = await Task.countDocuments();

      const overdueIssues = await Task.countDocuments({
        due_date: { $lt: new Date() },
        status: { $ne: "DONE" },
      });

      return res.json({
        totalProjects,
        completedProjects,
        myTasks: totalTasks,
        overdueIssues,
      });
    }

    // ================== NON-ADMIN ==================
    const myTasks = await Task.countDocuments({
      assigned_to: user._id,
    });

    const overdueIssues = await Task.countDocuments({
      assigned_to: user._id,
      due_date: { $lt: new Date() },
      status: { $ne: "DONE" },
    });

    const totalProjects = await Project.countDocuments({
      $or: [
        { team_lead: user._id },
        { team_members: user._id },
      ],
    });

    const completedProjects = await Project.countDocuments({
      status: "COMPLETED",
      $or: [
        { team_lead: user._id },
        { team_members: user._id },
      ],
    });

    res.json({
      totalProjects,
      completedProjects,
      myTasks,
      overdueIssues,
    });

  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
