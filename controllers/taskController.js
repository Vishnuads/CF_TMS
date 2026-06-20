  const Task = require("../models/Task");
  const fs = require("fs");
  const path = require("path");
  const socket = require("../socket");
    
  // exports.createTask = async (req, res) => {
  //   try {
  //     const files = req.files || [];

  //     const attachments = files.map((file) => ({
  //       originalName: file.originalname,
  //       fileName: file.filename,
  //       fileType: file.mimetype,
  //       fileSize: file.size,
  //       fileUrl: `/uploads/tasks/${file.filename}`,
  //     }));

  //     let task = await Task.create({
  //       ...req.body,
  //       isRead: false,
  //       attachments,
  //     });

  //   //socke.io start

  //   task = await Task.findById(task._id)
  //       .populate("assigned_to", "name email")

  //     // ✅ Correct populate syntax
  //    const io = socket.getIO();
  // if (task.assigned_to?._id) {
  //   io.to(`user:${task.assigned_to._id}`).emit("task-created", task);
  // }
  // if (task.project?._id) {
  //   io.to(`project:${task.project._id}`).emit("task-created", task);
  // }

  //   //socket.io end

  //     res.status(201).json(task);
  //   } catch (err) {
  //     res.status(400).json({ message: err.message });
  //   }
  // };

      
    
  exports.createTask = async (req, res) => {
    try {
      const files = req.files || [];

      const attachments = files.map((file) => ({
        originalName: file.originalname,
        fileName: file.filename,
        fileType: file.mimetype,
        fileSize: file.size,
        fileUrl: `/uploads/tasks/${file.filename}`,
      }));

      // Normalise assigned_to → always an array of IDs
      let assignedTo = req.body.assigned_to;
      if (!assignedTo) {
        assignedTo = [];
      } else if (!Array.isArray(assignedTo)) {
        assignedTo = [assignedTo];
      }

      let task = await Task.create({
        title:       req.body.title,
        description: req.body.description,
        type:        req.body.type,
        status:      req.body.status,
        priority:    req.body.priority,
        // ✅ Frontend sends full ISO strings, Mongoose Date accepts them directly
        start_date:  req.body.start_date || null,
        due_date:    req.body.due_date   || null,
        project:     req.body.project,
        assigned_to: assignedTo,
        isRead:      false,
        attachments,
      });

      task = await Task.findById(task._id).populate("assigned_to", "name email");

      // ─── Socket.io ───────────────────────────────────────────────────────────
      const io = socket.getIO();

      task.assigned_to.forEach((user) => {
        io.to(`user:${user._id}`).emit("task-created", task);
      });

      if (task.project) {
        io.to(`project:${task.project}`).emit("task-created", task);
      }
      // ─────────────────────────────────────────────────────────────────────────

      res.status(201).json(task);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  };




  exports.getTask = async (req, res) => {
    try {
      const tasks = await Task.find().sort({ createdAt: -1 });
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };

  exports.getSingleTask = async (req, res) => {
    try {
      const task = await Task.findById(req.params.taskId)
        .populate("assigned_to", "name email")
        .populate("project");

      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      res.json(task);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };

  exports.getTasksByProject = async (req, res) => {
    try {
      const tasks = await Task.find({ project: req.params.projectId })
        .sort({ createdAt: -1 })
        .populate("assigned_to", "name email");
      res.json(tasks);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  };

  exports.getUnreadTasks = async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const tasks = await Task.find({
        assigned_to: req.user._id,
        isRead: false,
      })
        .populate("project", "name")
        .sort({ createdAt: -1 });

      res.json(tasks);
    } catch (err) {
      console.error("getUnreadTasks error:", err);
      res.status(500).json({ message: "Server error" });
    }
  };

  exports.markTaskRead = async (req, res) => {
    const { taskId } = req.body;

    await Task.findByIdAndUpdate(taskId, { isRead: true });

    res.json({ success: true });
  };

  // exports.updateTask = async (req, res) => {
  //   try {
  //     const task = await Task.findById(req.params.taskId);
  //     if (!task) {
  //       return res.status(404).json({ message: "Task not found" });
  //     }

  //     /* -------------------- NEW FILES -------------------- */
  //     const files = req.files || [];
  //     const newAttachments = files.map((file) => ({
  //       originalName: file.originalname,
  //       fileName: file.filename,
  //       fileType: file.mimetype,
  //       fileSize: file.size,
  //       fileUrl: `/uploads/tasks/${file.filename}`,
  //     }));

  //     /* -------------------- EXISTING FILES -------------------- */
  //     const keepIds = JSON.parse(req.body.existingAttachments || "[]");

  //     // files to delete
  //     const removedAttachments = task.attachments.filter(
  //       (a) => !keepIds.includes(a._id.toString())
  //     );

  //     // delete from disk
  //     removedAttachments.forEach((file) => {
  //       const filePath = path.join(
  //         __dirname,
  //         "..",
  //         file.fileUrl
  //       );

  //       if (fs.existsSync(filePath)) {
  //         fs.unlinkSync(filePath);
  //       }
  //     });

  //     /* -------------------- UPDATE FIELDS -------------------- */
  //     task.title = req.body.title;
  //     task.description = req.body.description;
  //     task.type = req.body.type;
  //     task.status = req.body.status;
  //     task.priority = req.body.priority;
  //     task.due_date = req.body.due_date || null;
  //     task.assigned_to = req.body.assigned_to || null;

  //     /* -------------------- FINAL ATTACHMENTS -------------------- */
  //     task.attachments = [
  //       ...task.attachments.filter((a) =>
  //         keepIds.includes(a._id.toString())
  //       ),
  //       ...newAttachments,
  //     ];

  //     await task.save();

  //     await task.populate("assigned_to", "name email");

  //     //socket.io start

  //        await task.populate("project");

  //          const io = socket.getIO();

  //     io.to(`project:${task.project._id}`).emit("task-updated", task);

  //     if (task.assigned_to) {
  //       io.to(`user:${task.assigned_to._id}`).emit("task-updated", task);
  //     }

  //     //socket.io end

  //     res.json(task);
  //   } catch (err) {
  //     console.error(err);
  //     res.status(400).json({ message: err.message });
  //   }
  // };




  exports.updateTask = async (req, res) => {
    try {
      const task = await Task.findById(req.params.taskId);
      if (!task) {
        return res.status(404).json({ message: "Task not found" });
      }

      /* ── New files ──────────────────────────────────────────────────────── */
      const files = req.files || [];
      const newAttachments = files.map((file) => ({
        originalName: file.originalname,
        fileName: file.filename,
        fileType: file.mimetype,
        fileSize: file.size,
        fileUrl: `/uploads/tasks/${file.filename}`,
      }));

      /* ── Existing files: remove deleted ones from disk ──────────────────── */
      const keepIds = JSON.parse(req.body.existingAttachments || "[]");

      const removedAttachments = task.attachments.filter(
        (a) => !keepIds.includes(a._id.toString())
      );

      removedAttachments.forEach((file) => {
        const filePath = path.join(__dirname, "..", file.fileUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });

      /* ── Scalar fields ──────────────────────────────────────────────────── */
      task.title       = req.body.title;
      task.description = req.body.description;
      task.type        = req.body.type;
      task.status      = req.body.status;
      task.priority    = req.body.priority;

      // ✅ Full ISO datetime strings from frontend → Mongoose Date
      task.start_date  = req.body.start_date || null;
      task.due_date    = req.body.due_date   || null;

      /* ── Multi-assignee ─────────────────────────────────────────────────── */
      let assignedTo = req.body.assigned_to;
      if (!assignedTo) {
        assignedTo = [];
      } else if (!Array.isArray(assignedTo)) {
        assignedTo = [assignedTo];
      }
      task.assigned_to = assignedTo;

      /* ── Final attachments ──────────────────────────────────────────────── */
      task.attachments = [
        ...task.attachments.filter((a) => keepIds.includes(a._id.toString())),
        ...newAttachments,
      ];

      await task.save();

      await task.populate("assigned_to", "name email");
      await task.populate("project");

      // ─── Socket.io ───────────────────────────────────────────────────────────
      const io = socket.getIO();

      io.to(`project:${task.project._id}`).emit("task-updated", task);

      task.assigned_to.forEach((user) => {
        io.to(`user:${user._id}`).emit("task-updated", task);
      });
      // ─────────────────────────────────────────────────────────────────────────

      res.json(task);
    } catch (err) {
      console.error(err);
      res.status(400).json({ message: err.message });
    }
  };



  exports.updateTaskStatus = async (req, res) => {
    try {


          const updateData = {
        status: req.body.status,
      };

      // When task becomes DONE
      if (req.body.status === "DONE") {
        updateData.completedAt = new Date();
      }

      // If reopened, clear completedAt
      if (req.body.status !== "DONE") {
        updateData.completedAt = null;
      }



      const task = await Task.findByIdAndUpdate(
        req.params.taskId,
        // { status: req.body.status },
        updateData,
        { new: true },
      ).populate("assigned_to", "name email");

      //socket.io start

      // 2️⃣ Emit socket event
      const io = socket.getIO();

      // 🔥 Project room
      if (task.project?._id) {
        io.to(`project:${task.project._id}`).emit("task-status-updated", task);
      }

      // 🔔 Assigned user
      if (task.assigned_to?._id) {
        io.to(`user:${task.assigned_to._id}`).emit("task-status-updated", task);
      }

      // (Optional) global
      io.emit("task-status-updated", task);

      //socket.io end

      res.json(task);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  };

  exports.deleteMultipleTasks = async (req, res) => {
    try {
      const { taskIds } = req.body;

      const tasks = await Task.find({ _id: { $in: taskIds } });

      await Task.deleteMany({ _id: { $in: taskIds } });

      const io = socket.getIO();

      tasks.forEach((task) => {
        io.to(`project:${task.project}`).emit("task-deleted", task._id);
        // if (task.assigned_to) {
        //   io.to(`user:${task.assigned_to}`).emit("task-deleted", task._id);
        // }

        // ✅ multiple assignees
        if (Array.isArray(task.assigned_to)) {
          task.assigned_to.forEach((userId) => {
            io.to(`user:${userId}`).emit("task-deleted", task._id);
          });
        }
        
      });

      res.json({ message: "Tasks deleted" });
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  };
