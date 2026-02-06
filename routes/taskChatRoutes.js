

const router = require("express").Router();
const TaskMessage = require("../models/TaskMessage");
const auth = require("../middleware/chatAuth"); // JWT middleware
const Task = require("../models/Task"); // ✅ ADD THIS
const User = require("../models/User");
const Project = require("../models/Project")
const Role = require("../models/Role");
const socket = require("../socket");



router.get("/task-chat/unread", auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // 1️⃣ Find projects user belongs to
    const projects = await Project.find({
      $or: [
        { team_lead: userId },
        { team_members: userId },
      ],
    }).select("_id");

    const projectIds = projects.map(p => p._id);

    // 2️⃣ Find tasks user is related to
    const tasks = await Task.find({
      $or: [
        { assigned_to: userId },
        { project: { $in: projectIds } },
      ],
    }).select("_id project");

    const taskIds = tasks.map(t => t._id);

    // 3️⃣ Find unread messages
    const unread = await TaskMessage.find({
      task: { $in: taskIds },
      sender: { $ne: userId },
      readBy: { $nin: [userId] },
    })
      .populate("sender", "name")
      // .populate("project", "_id")
      .sort({ createdAt: -1 });

    res.json(unread);
  } catch (err) {
    console.error("Unread error:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// router.get("/task-chat/unread", auth, async (req, res) => {
//   try {
//     const userId = req.user._id;

//     // 🔒 find tasks assigned to this user
//     const tasks = await Task.find({ assigned_to: userId }).select("_id");

//     const taskIds = tasks.map(t => t._id);

//     const unreadMessages = await TaskMessage.find({
//       task: { $in: taskIds },
//       sender: { $ne: userId },
//       readBy: { $nin: [userId] },
//     })
//       .populate("sender", "name")
//       .sort({ createdAt: -1 });

//     res.json(unreadMessages);
//   } catch (err) {
//     console.error("Unread error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });


// GET messages for a task




router.get("/task-chat/:taskId", auth, async (req, res) => {
  try {
    const messages = await TaskMessage.find({ task: req.params.taskId })
      .populate("sender", "_id name")
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    console.error("Get task messages error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// POST message
// router.post("/task-chat", auth, async (req, res) => {
//   try {
//     const { taskId, message } = req.body;

//     if (!taskId || !message) {
//       return res.status(400).json({ message: "Missing fields" });
//     }

//     // 🔍 Get task to find projectId
//     const task = await Task.findById(taskId).select("project");
//     if (!task) {
//       return res.status(404).json({ message: "Task not found" });
//     }

//     // Save message in DB
//     const chat = await TaskMessage.create({
//       task: taskId,
//       sender: req.user._id,
//       project: task.project, // ✅ STORE projectId
//       message,
//       readBy: [req.user._id], // ✅ sender already read
//     });

//     const populatedChat = await chat.populate("sender", "name");

//     // 🔥 Emit to socket room
//     const io = req.app.get("io"); // ✅ now io is defined

// //    io.to(taskId).emit("receive-message", {
// //   _id: populatedChat._id,
// //   message: populatedChat.message,
// //   sender: populatedChat.sender,
// //   taskId,
// //   projectId: task.project,
// //   createdAt: populatedChat.createdAt,
// // });

// io.to(`task:${taskId}`).emit("task-message", {
//   _id: populatedChat._id,
//   message: populatedChat.message,
//   sender: populatedChat.sender,
//   taskId,
//   projectId: task.project,
//   createdAt: populatedChat.createdAt,
// });
  

// // emit notification to assigned users
// const assignedUser = task.assigned_to;
// if (assignedUser !== req.user._id) {
//   io.to(`user:${assignedUser}`).emit("notify-message", {
//     taskId,
//     projectId: task.project,
//     sender: populatedChat.sender,
//     message: populatedChat.message,
//   });
// }


//     res.status(201).json(populatedChat);
//   } catch (err) {
//     console.error("Task chat error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });


// router.post("/task-chat", auth, async (req, res) => {
//   try {
//     const { taskId, message } = req.body;
//     if (!taskId || !message) {
//       return res.status(400).json({ message: "Missing fields" });
//     }

//     const task = await Task.findById(taskId)
//       .select("project assigned_to");

//     if (!task) {
//       return res.status(404).json({ message: "Task not found" });
//     }

//     const chat = await TaskMessage.create({
//       task: taskId,
//       sender: req.user._id,
//       project: task.project,
//       message,
//       readBy: [req.user._id],
//     });

//     const populatedChat = await chat.populate("sender", "name");

//     const io = req.app.get("io");

//     // ✅ task chat
//     io.to(`task:${taskId}`).emit("task-message", {
//       _id: populatedChat._id,
//       message: populatedChat.message,
//       sender: populatedChat.sender,
//       taskId,
//       projectId: task.project,
//       createdAt: populatedChat.createdAt,
//     });

//     // ✅ notifications
//     const assignees = Array.isArray(task.assigned_to)
//       ? task.assigned_to
//       : [task.assigned_to];

//     assignees.forEach((uid) => {
//       if (uid && !uid.equals(req.user._id)) {
//         io.to(`user:${uid}`).emit("notify-message", {
//           taskId,
//           projectId: task.project,
//           sender: populatedChat.sender,
//           message: populatedChat.message,
//         });
//       }
//     });

//     res.status(201).json(populatedChat);
//   } catch (err) {
//     console.error("Task chat error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });


// router.post("/task-chat", auth, async (req, res) => {
//   try {
//     const { taskId, message } = req.body;

//     if (!taskId || !message) {
//       return res.status(400).json({ message: "Missing fields" });
//     }

//     const task = await Task.findById(taskId)
//       .select("project assigned_to");

//     if (!task) {
//       return res.status(404).json({ message: "Task not found" });
//     }

//     // ✅ Save message
//     const chat = await TaskMessage.create({
//       task: taskId,
//       sender: req.user._id,
//       project: task.project,
//       message,
//       readBy: [req.user._id],
//     });

//     const populatedChat = await chat.populate("sender", "_id name");

//     const io = req.app.get("io");

//     // ✅ REALTIME TASK CHAT
//     io.to(`task:${taskId}`).emit("task-message", {
//       _id: populatedChat._id,
//       message: populatedChat.message,
//       sender: populatedChat.sender,
//       taskId,
//       projectId: task.project,
//       createdAt: populatedChat.createdAt,
//     });

//     // ✅ NOTIFICATION (ONLY ASSIGNED USER, EXCEPT SENDER)
//     const assignedUserId = task.assigned_to;

//     if (
//       assignedUserId &&
//       assignedUserId.toString() !== req.user._id.toString()
//     ) {
//       io.to(`user:${assignedUserId}`).emit("notify-message", {
//         type: "TASK_CHAT",
//         taskId,
//         projectId: task.project,
//         senderId: populatedChat.sender._id,
//         senderName: populatedChat.sender.name,
//         message: populatedChat.message,
//       });
//     }

//     res.status(201).json(populatedChat);
//   } catch (err) {
//     console.error("Task chat error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });










// const isUserInProject = (project, userId) => {
//   if (project.team_lead?.toString() === userId.toString()) {
//     return true;
//   }

//   return project.team_members.some(
//     (u) => u.toString() === userId.toString()
//   );
// };


// router.post("/task-chat", auth, async (req, res) => {
//   try {
//     const { taskId, message } = req.body;

//     if (!taskId || !message) {
//       return res.status(400).json({ message: "Missing fields" });
//     }

//     // ===============================
//     // 1️⃣ Load task
//     // ===============================
//     const task = await Task.findById(taskId)
//       .select("project assigned_to");

//     if (!task) {
//       return res.status(404).json({ message: "Task not found" });
//     }

//     // ===============================
//     // 2️⃣ Load project
//     // ===============================
//     const project = await Project.findById(task.project)
//       .select("team_lead team_members");

//     if (!project) {
//       return res.status(404).json({ message: "Project not found" });
//     }

//     // ===============================
//     // 3️⃣ Validate sender is part of project
//     // ===============================
//     const allowed = isUserInProject(project, req.user._id);
//     if (!allowed) {
//       return res.status(403).json({
//         message: "You are not part of this project",
//       });
//     }

//     // ===============================
//     // 4️⃣ Save chat message
//     // ===============================
//     const chat = await TaskMessage.create({
//       task: taskId,
//       sender: req.user._id,
//       project: task.project,
//       message,
//       readBy: [req.user._id],
//     });

//     const populatedChat = await chat.populate(
//       "sender",
//       "_id name"
//     );

//     const io = req.app.get("io");

//     // ===============================
//     // 5️⃣ REALTIME TASK CHAT (room)
//     // ===============================
//     io.to(`task:${taskId}`).emit("task-message", {
//       _id: populatedChat._id,
//       message: populatedChat.message,
//       sender: populatedChat.sender,
//       taskId,
//       projectId: task.project,
//       createdAt: populatedChat.createdAt,
//     });

//     // ===============================
//     // 6️⃣ NOTIFICATIONS (ALL PROJECT USERS)
//     // ===============================
//     const recipients = new Set();

//     // Task assigned user
//     if (task.assigned_to) {
//       recipients.add(task.assigned_to.toString());
//     }

//     // Project team lead
//     if (project.team_lead) {
//       recipients.add(project.team_lead.toString());
//     }

//     // Project team members
//     if (project.team_members?.length) {
//       project.team_members.forEach((u) =>
//         recipients.add(u.toString())
//       );
//     }

//     // Remove sender
//     recipients.delete(req.user._id.toString());

//     // Emit notification
//     recipients.forEach((uid) => {
//       io.to(`user:${uid}`).emit("notify-message", {
//         type: "TASK_CHAT",
//         taskId,
//         projectId: task.project,
//         sender: {
//           _id: populatedChat.sender._id,
//           name: populatedChat.sender.name,
//         },
//         message: populatedChat.message,
//         createdAt: populatedChat.createdAt,
//       });
//     });

//     res.status(201).json(populatedChat);
//   } catch (err) {
//     console.error("Task chat error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// });







const isUserInProject = (project, userId) => {
  if (project.team_lead?.toString() === userId.toString()) {
    return true;
  }

  return project.team_members.some(
    (u) => u.toString() === userId.toString()
  );
};


router.post("/task-chat", auth, async (req, res) => {
  try {
    const { taskId, message } = req.body;

    if (!taskId || !message) {
      return res.status(400).json({ message: "Missing fields" });
    }

    // ===============================
    // 1️⃣ Load task
    // ===============================
    const task = await Task.findById(taskId)
      .select("project assigned_to");

    if (!task) {
      return res.status(404).json({ message: "Task not found" });
    }

    // ===============================
    // 2️⃣ Load project
    // ===============================
    const project = await Project.findById(task.project)
      .select("team_lead team_members");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    // ===============================
    // 3️⃣ Validate sender is part of project
    // ===============================
    const allowed = isUserInProject(project, req.user._id);
    if (!allowed) {
      return res.status(403).json({
        message: "You are not part of this project",
      });
    }

    // ===============================
    // 4️⃣ Save chat message
    // ===============================
    const chat = await TaskMessage.create({
      task: taskId,
      sender: req.user._id,
      project: task.project,
      message,
      readBy: [req.user._id],
    });

    const populatedChat = await chat.populate(
      "sender",
      "_id name"
    );

    // const io = req.app.get("io");
    const io = socket.getIO();

    // ===============================
    // 5️⃣ REALTIME TASK CHAT (room)
    // ===============================
    io.to(`task:${taskId}`).emit("task-message", {
      _id: populatedChat._id,
      message: populatedChat.message,
      sender: populatedChat.sender,
      taskId,
      projectId: task.project,
      createdAt: populatedChat.createdAt,
    });

    // ===============================
    // 6️⃣ NOTIFICATIONS (ALL PROJECT USERS)
    // ===============================
    const recipients = new Set();

    // Task assigned user
    if (task.assigned_to) {
      recipients.add(task.assigned_to.toString());
    }

    // Project team lead
    if (project.team_lead) {
      recipients.add(project.team_lead.toString());
    }

    // Project team members
    if (project.team_members?.length) {
      project.team_members.forEach((u) =>
        recipients.add(u.toString())
      );
    }

    // Remove sender
    recipients.delete(req.user._id.toString());

    // Emit notification
    recipients.forEach((uid) => {
      io.to(`user:${uid}`).emit("notify-message", {
        type: "TASK_CHAT",
        taskId,
        projectId: task.project,
        sender: {
          _id: populatedChat.sender._id,
          name: populatedChat.sender.name,
        },
        message: populatedChat.message,
        createdAt: populatedChat.createdAt,
      });
    });

    res.status(201).json(populatedChat);
  } catch (err) {
    console.error("Task chat error:", err);
    res.status(500).json({ message: "Server error" });
  }
});






router.post("/task-chat/mark-read-task", auth, async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ message: "Task ID required" });
    }

    await TaskMessage.updateMany(
      {
        task: taskId,
        sender: { $ne: req.user._id },
        readBy: { $nin: [req.user._id] }
      },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Mark read by task error:", err);
    res.status(500).json({ message: "Server error" });
  }
});





module.exports = router;
