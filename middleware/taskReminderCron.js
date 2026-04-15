
const cron   = require("node-cron");
const Task   = require("../models/Task");     
const socket = require("../socket");          
const TOLERANCE_MINUTES = 2;

const window = (targetDate) => ({
  $gte: new Date(targetDate.getTime() - TOLERANCE_MINUTES * 60 * 1000),
  $lte: new Date(targetDate.getTime() + TOLERANCE_MINUTES * 60 * 1000),
});

cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();
    const oneDayAhead   = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const threeHrsAhead = new Date(now.getTime() +  3 * 60 * 60 * 1000);
    const tasks = await Task.find({
      status: { $ne: "DONE" },
      due_date: {
        $in: [
        ],
      },
    }).lean(); 

    const dueTasks = await Task.find({
      status: { $ne: "DONE" },
      $or: [
        { due_date: window(oneDayAhead)   },
        { due_date: window(threeHrsAhead) },
      ],
    })
      .populate("assigned_to", "name email")
      .lean();

    if (!dueTasks.length) return;

    const io = socket.getIO();

    dueTasks.forEach((task) => {
      const dueMs      = new Date(task.due_date).getTime();
      const diffMs     = dueMs - now.getTime();
      const diffHours  = diffMs / (1000 * 60 * 60);

      const is1Day    = diffHours >= 23 && diffHours <= 25;
      const is3Hours  = diffHours >=  2 && diffHours <=  4;

      if (!is1Day && !is3Hours) return;

      const label   = is1Day ? "1 day" : "3 hours";
      const type    = is1Day ? "reminder_1day" : "reminder_3hours";

      const payload = {
        taskId    : task._id,
        projectId : task.project,
        title     : task.title,
        due_date  : task.due_date,
        message   : `⏰ Task "${task.title}" is due in ${label}!`,
        type,                        
      };

      (task.assigned_to || []).forEach((user) => {
        io.to(`user:${user._id}`).emit("task-due-reminder", payload);
      });

      if (task.project) {
        io.to(`project:${task.project}`).emit("task-due-reminder", payload);
      }

      console.log(
        `[ReminderCron] Sent "${label}" reminder for task "${task.title}" ` +
        `(due: ${new Date(task.due_date).toISOString()})`
      );
    });
  } catch (err) {
    console.error("[ReminderCron] Error:", err.message);
  }
});

console.log("[ReminderCron] Task due-date reminder cron started ✅");













// const cron = require("node-cron");
// const Task = require("../models/Task");
// const socket = require("../socket");
   
// cron.schedule("*/20 * * * * *", async () => {
//   try {
//     const io = socket.getIO();

//     console.log("⏰ Cron running at:", new Date().toLocaleTimeString());

//     // ✅ get all tasks (no filter) 
//     const tasks = await Task.find({})
//       .populate("assigned_to", "name email")
//       .lean();

//     if (!tasks.length) {
//       console.log("❌ No tasks found");
//       return;
//     }
  
//     tasks.forEach((task) => {
//       const payload = {
//         taskId: task._id,
//         title: task.title,
//         message: `🔥 TEST: Cron working for "${task.title}"`,
//       };

//       // ✅ send to all assigned users
//       (task.assigned_to || []).forEach((user) => {
//         io.to(`user:${user._id}`).emit("task-due-reminder", payload);
//       });

//       // ✅ also send to project room
//       if (task.project) {
//         io.to(`project:${task.project}`).emit("task-due-reminder", payload);
//       }

//       console.log("✅ Sent test message for:", task.title);
//     });
//   } catch (err) {
//     console.error("❌ Cron Error:", err.message);
//   }
// });

// console.log("🚀 Test cron started (every 10 seconds)");