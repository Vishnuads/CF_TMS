const Task = require("../models/Task");
const socket = require("../socket");

// ============================================================
// AUTO-HOLD ON IDLE
//
// Called by the Electron app when it detects 180s of no keyboard/
// mouse activity while the user has a task IN_PROGRESS. Reuses the
// same "stop timer, bank the session" logic as the manual auto-hold
// path in taskController.js, but tags the hold as AUTO_IDLE and does
// NOT allow it to auto-resume — the employee must click Resume.
// ============================================================

exports.autoHoldOnIdle = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const now = new Date();

    const inProgressTasks = await Task.find({
      assigned_to: userId,
      status: "IN_PROGRESS",
    });

    if (inProgressTasks.length === 0) {
      return res.status(200).json({ message: "No in-progress task to hold", held: [] });
    }

    const io = socket.getIO();
    const held = [];

    for (const task of inProgressTasks) {
      if (task.timerRunning && task.timerStartedAt) {
        const sessionDuration = Math.max(
          0,
          Math.floor((now.getTime() - task.timerStartedAt.getTime()) / 1000)
        );

        task.totalTimeSpent += sessionDuration;
        task.timeSessions.push({
          startedAt: task.timerStartedAt,
          stoppedAt: now,
          duration: sessionDuration,
        });

        task.timerRunning = false;
        task.timerStartedAt = null;
      }

      task.status = "ON_HOLD";
      task.holdReason = "AUTO_IDLE";
      task.holdAt = now;
      task.completedAt = null;

      await task.save();
      await task.populate("assigned_to", "name email");
      await task.populate("project");

      if (task.project?._id) {
        io.to(`project:${task.project._id}`).emit("task-status-updated", task);
        io.to(`project:${task.project._id}`).emit("task-timer-stopped", task);
        io.to(`project:${task.project._id}`).emit("task-auto-held-idle", task);
      }

      if (Array.isArray(task.assigned_to)) {
        task.assigned_to.forEach((user) => {
          io.to(`user:${user._id}`).emit("task-status-updated", task);
          io.to(`user:${user._id}`).emit("task-timer-stopped", task);
          io.to(`user:${user._id}`).emit("task-auto-held-idle", task);
        });
      }

      io.emit("task-status-updated", task);
      held.push({ _id: task._id, title: task.title });
    }

    res.json({ message: "Task(s) auto-held due to idle", held });
  } catch (err) {
    console.error("autoHoldOnIdle error:", err);
    res.status(500).json({ message: err.message });
  }
};