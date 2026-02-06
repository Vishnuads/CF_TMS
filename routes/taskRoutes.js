const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const controller = require("../controllers/taskController");
const { auth, adminOnly } = require("../middleware/auth.middleware");
const permission = require("../middleware/permission") 
const authTask = require("../middleware/chatAuth"); // JWT middleware


// router.post(
//   "/task",
//   upload.array("attachments", 10), 
//   controller.createTask
// );

router.post("/task", auth, permission("tasks", "create"), (req, res, next) => {
  upload.array("attachments", 10)(req, res, function (err) {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "File size exceeds 50MB limit",
        });
      }

      return res.status(400).json({
        message: err.message,
      });
    }

    next();
  });
}, controller.createTask);

router.get("/task/unread",authTask, controller.getUnreadTasks);
router.post("/task/task-read",authTask, controller.markTaskRead);

router.get("/task",controller.getTask)
router.get("/task/:projectId", controller.getTasksByProject);
router.put(
  "/task/:taskId",
  upload.array("attachments", 10), auth, permission("tasks", "create"),
  controller.updateTask
);


// 🔥 SINGLE TASK (ADD THIS ABOVE project route)
router.get("/single/:taskId", controller.getSingleTask);


router.patch("/task/:taskId/status", controller.updateTaskStatus);
router.delete("/task", auth, permission("tasks", "create"), controller.deleteMultipleTasks);



module.exports = router;
