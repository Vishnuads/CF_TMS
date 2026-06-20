// const express = require("express");
// const router  = express.Router();
// const User    = require("../models/User");
// const Task    = require("../models/Task");

// // ─── Helpers ──────────────────────────────────────────────────────────────────

// /**
//  * Build a { from, to } date window from query params.
//  * Priority: from+to  >  period preset  >  null (all time)
//  */
// function buildDateWindow(query) {
//   const { from, to, period } = query;

//   // 1. Explicit custom range
//   if (from && to) {
//     const start = new Date(from);
//     start.setHours(0, 0, 0, 0);
//     const end = new Date(to);
//     end.setHours(23, 59, 59, 999);
//     if (!isNaN(start) && !isNaN(end) && start <= end) {
//       return { start, end };
//     }
//   }

//   // 2. Preset period
//   if (period && period !== "all") {
//     const now   = new Date();
//     const start = new Date();
//     start.setHours(0, 0, 0, 0);

//     switch (period) {
//       case "week": {
//         const day = start.getDay();
//         const diffToMon = day === 0 ? -6 : 1 - day;
//         start.setDate(start.getDate() + diffToMon);
//         break;
//       }
//       case "month":
//         start.setDate(1);
//         break;
//       case "quarter": {
//         const q = Math.floor(now.getMonth() / 3);
//         start.setMonth(q * 3, 1);
//         break;
//       }
//       case "year":
//         start.setMonth(0, 1);
//         break;
//       default:
//         return null;
//     }

//     const end = new Date();
//     end.setHours(23, 59, 59, 999);
//     return { start, end };
//   }

//   // 3. All time
//   return null;
// }

// /**
//  * Filter an array of tasks to those whose createdAt falls within the window.
//  * If window is null, returns the full array unchanged.
//  */
// function filterByWindow(tasks, window) {
//   if (!window) return tasks;
//   return tasks.filter((t) => {
//     const d = new Date(t.start_date);
//     return d >= window.start && d <= window.end;
//   });
// }

// // ─── GET /api/analytics/employees ────────────────────────────────────────────
// router.get("/employees", async (req, res) => {
//   try {
//     const employees = await User.find({ isActive: true })
//       .populate("role", "name")
//       .select("name email role isOnline isActive")
//       .lean();

//     res.json({ success: true, data: employees });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // ─── GET /api/analytics/employee/:id ─────────────────────────────────────────
// router.get("/employee/:id", async (req, res) => {
//   try {
//     const { id } = req.params;

//     // ── Employee ──────────────────────────────────────────────────────────────
//     const employee = await User.findById(id)
//       .populate("role", "name")
//       .select("name email role isOnline isActive")
//       .lean();

//     if (!employee) {
//       return res.status(404).json({ success: false, message: "Employee not found" });
//     }

//     // ── Date window from query params ─────────────────────────────────────────
//     const window = buildDateWindow(req.query);

//     // ── All tasks for this employee ───────────────────────────────────────────
//     // Build the DB query. For assigned_to (array field) use $elemMatch or $in.
//     const dbQuery = { assigned_to: id };

//     // Optionally push the date filter to the DB query itself for efficiency
//     if (window) {
//       dbQuery.start_date = { $gte: window.start, $lte: window.end };
//     }

//     const allTasks = await Task.find(dbQuery)
//       .populate("project", "name")
//       .lean();

//     // allTasks is already filtered by window via the DB query above.
//     // The filterByWindow helper below is kept for in-memory chart slicing.
//     const now = new Date();

//     // ─── Summary ──────────────────────────────────────────────────────────────
//     const total       = allTasks.length;
//     const completed   = allTasks.filter((t) => t.status === "DONE").length;
//     const inProgress  = allTasks.filter((t) => t.status === "IN_PROGRESS").length;
//     const pending     = allTasks.filter((t) => t.status === "TODO").length;
//     const overdue     = allTasks.filter(
//       (t) => t.due_date && new Date(t.due_date) < now && t.status !== "DONE"
//     ).length;
//     const highPriority  = allTasks.filter((t) => t.priority === "HIGH").length;
//     const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

//     // ─── Status & Priority breakdown ─────────────────────────────────────────
//     const status = { todo: pending, inProgress, done: completed };
//     const priority = {
//       HIGH:   allTasks.filter((t) => t.priority === "HIGH").length,
//       MEDIUM: allTasks.filter((t) => t.priority === "MEDIUM").length,
//       LOW:    allTasks.filter((t) => t.priority === "LOW").length,
//     };

//     // ─── Weekly chart (Mon–Sun of current week) ───────────────────────────────
//     const weekStart = new Date(now);
//     const dayOfWeek = weekStart.getDay();
//     weekStart.setDate(weekStart.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));
//     weekStart.setHours(0, 0, 0, 0);

//     const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
//     const weeklyChart = DAYS.map((dayName, i) => {
//       const dayStart = new Date(weekStart);
//       dayStart.setDate(dayStart.getDate() + i);
//       dayStart.setHours(0, 0, 0, 0);
//       const dayEnd = new Date(dayStart);
//       dayEnd.setHours(23, 59, 59, 999);

//       // Use allTasks (already window-filtered) but cross with this specific day
//       return {
//         day: dayName,
//         assigned: allTasks.filter(
//           (t) => new Date(t.start_date) >= dayStart && new Date(t.start_date) <= dayEnd
//         ).length,
//         completed: allTasks.filter(
//           (t) =>
//             t.status === "DONE" &&
//             new Date(t.start_date) >= dayStart &&
//             new Date(t.start_date) <= dayEnd
//         ).length,
//       };
//     });

//     const weeklyAssigned  = weeklyChart.reduce((s, d) => s + d.assigned, 0);
//     const weeklyCompleted = weeklyChart.reduce((s, d) => s + d.completed, 0);

//     // ─── Monthly chart (Jan–Dec of current year) ──────────────────────────────
//     const currentYear = now.getFullYear();
//     const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

//     const monthlyChart = MONTHS.map((monthName, i) => {
//       const mStart = new Date(currentYear, i, 1, 0, 0, 0, 0);
//       const mEnd   = new Date(currentYear, i + 1, 0, 23, 59, 59, 999);

//       return {
//         month: monthName,
//         assigned: allTasks.filter(
//           (t) => new Date(t.start_date) >= mStart && new Date(t.start_date) <= mEnd
//         ).length,

//         // completed: allTasks.filter(
//         //   (t) =>
//         //     t.status === "DONE" &&
//         //     new Date(t.updatedAt) >= mStart &&
//         //     new Date(t.updatedAt) <= mEnd
//         // ).length,

//         completed: allTasks.filter(
//   (t) =>
//     t.status === "DONE" &&
//     new Date(t.start_date) >= mStart &&
//     new Date(t.start_date) <= mEnd
// ).length,

//       };
//     });

//     const currentMonthIdx   = now.getMonth();
//     const monthlyAssigned   = monthlyChart[currentMonthIdx].assigned;
//     const monthlyCompleted  = monthlyChart[currentMonthIdx].completed;
//     const monthlyRate       =
//       monthlyAssigned > 0 ? Math.round((monthlyCompleted / monthlyAssigned) * 100) : 0;

//     // ─── Yearly chart ─────────────────────────────────────────────────────────
//     // Always build from ALL tasks (not window-filtered) so the chart shows history
//     const allTasksForYearly = window
//       ? await Task.find({ assigned_to: id }).populate("project", "name").lean()
//       : allTasks;

//     const years = [
//       ...new Set(allTasksForYearly.map((t) => new Date(t.start_date).getFullYear())),
//     ].sort();

//     const yearlyChart = years.map((yr) => {
//       const yStart = new Date(yr, 0, 1, 0, 0, 0, 0);
//       const yEnd   = new Date(yr, 11, 31, 23, 59, 59, 999);
//       return {
//         year: String(yr),
//         assigned: allTasksForYearly.filter(
//           (t) => new Date(t.start_date) >= yStart && new Date(t.start_date) <= yEnd
//         ).length,
//         completed: allTasksForYearly.filter(
//           (t) =>
//             t.status === "DONE" &&
//             new Date(t.start_date) >= yStart &&
//             new Date(t.start_date) <= yEnd
//         ).length,
//       };
//     });

//     const yearStart      = new Date(currentYear, 0, 1, 0, 0, 0, 0);
//     const yearEnd        = new Date(currentYear, 11, 31, 23, 59, 59, 999);
//     const yearlyAssigned = allTasksForYearly.filter(
//       (t) => new Date(t.start_date) >= yearStart && new Date(t.start_date) <= yearEnd
//     ).length;
//     const yearlyCompleted = allTasksForYearly.filter(
//       (t) =>
//         t.status === "DONE" &&
//         new Date(t.completedAt) >= yearStart &&
//         new Date(t.completedAt) <= yearEnd
//     ).length;
//     const yearlyRate =
//       yearlyAssigned > 0 ? Math.round((yearlyCompleted / yearlyAssigned) * 100) : 0;

//     // ─── Productivity metrics ─────────────────────────────────────────────────
//     let avgTasksPerWeek   = 0;
//     let avgTasksPerMonth  = 0;
//     let avgCompletionTime = 0;

//     if (total > 0) {
//       const sorted         = [...allTasks].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
//       const firstDate      = new Date(sorted[0].createdAt);
//       const effectiveStart = window ? window.start : firstDate;
//       const effectiveEnd   = window ? window.end   : now;

//       const msPerWeek      = 7 * 24 * 60 * 60 * 1000;
//       const weeksElapsed   = Math.max(1, (effectiveEnd - effectiveStart) / msPerWeek);
//       const monthsElapsed  = Math.max(1, weeksElapsed / 4.33);

//       avgTasksPerWeek  = Math.round((total / weeksElapsed)  * 10) / 10;
//       avgTasksPerMonth = Math.round((total / monthsElapsed) * 10) / 10;

//       // const doneTasks = allTasks.filter((t) => t.status === "DONE" && t.start_date);
//       // if (doneTasks.length > 0) {
//       //   const totalDays = doneTasks.reduce((sum, t) => {
//       //     const start = new Date(t.start_date);
//       //     const end   = new Date(t.updatedAt);
//       //     return sum + Math.max(0, (end - start) / (1000 * 60 * 60 * 24));
//       //   }, 0);
//       //   avgCompletionTime = Math.round((totalDays / doneTasks.length) * 10) / 10;
//       // }

//       const doneTasks = allTasks.filter(
//   (t) =>
//     t.status === "DONE" &&
//     t.start_date &&
//     t.completedAt
// );

// if (doneTasks.length > 0) {
//   const totalDays = doneTasks.reduce((sum, t) => {
//     const start = new Date(t.start_date);
//     const end = new Date(t.completedAt); // ✅ use completedAt

//     const days =
//       (end - start) / (1000 * 60 * 60 * 24);

//     return sum + Math.max(0, days);
//   }, 0);

//   avgCompletionTime =
//     Math.round((totalDays / doneTasks.length) * 10) / 10;
// }

//     }

//     const overduePercentage = total > 0 ? Math.round((overdue / total) * 100) : 0;

//     // ─── Performance score & rating ───────────────────────────────────────────
//     let score = 0;
//     if (total > 0) {
//       const highPriorityDone = allTasks.filter(
//         (t) => t.priority === "HIGH" && t.status === "DONE"
//       ).length;

//       const completionScore    = (completionRate / 100) * 50;
//       const overdueScore       = ((100 - overduePercentage) / 100) * 30;
//       const highPriorityScore  =
//         highPriority > 0 ? (highPriorityDone / highPriority) * 20 : 20;

//       score = Math.round(completionScore + overdueScore + highPriorityScore);
//     }

//     const rating =
//       score >= 90 ? "Excellent" :
//       score >= 75 ? "Good" :
//       score >= 60 ? "Average" :
//       "Needs Improvement";

//     // ─── Recent tasks (last 10 within the window) ─────────────────────────────
//     // const recentTasks = [...allTasks]
//     //   .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
//     //   .slice(0, 10);

//     const recentTasks = [...allTasks]
//   .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
//   .slice(0, 10)
//   .map((task) => {
//     let completionDays = null;

//     if (
//       task.status === "DONE" &&
//       task.start_date &&
//       task.completedAt
//     ) {
//       const diffMs =
//         new Date(task.completedAt) -
//         new Date(task.start_date);

//       completionDays = Number(
//         (diffMs / (1000 * 60 * 60 * 24)).toFixed(1)
//       );
//     }

//     return {
//       ...task,
//       completionDays,
//     };
//   });

//     // ─── Response ─────────────────────────────────────────────────────────────
//     res.json({
//       success: true,
//       data: {
//         employee,
//         // echo back the active filter so the frontend can display it
//         activeFilter: window
//           ? { from: window.start.toISOString(), to: window.end.toISOString() }
//           : null,
//         summary: { total, completed, pending, inProgress, overdue, highPriority, completionRate },
//         status,
//         priority,
//         weekly: {
//           assigned: weeklyAssigned,
//           completed: weeklyCompleted,
//           completionPercentage:
//             weeklyAssigned > 0 ? Math.round((weeklyCompleted / weeklyAssigned) * 100) : 0,
//           chart: weeklyChart,
//         },
//         monthly: {
//           assigned: monthlyAssigned,
//           completed: monthlyCompleted,
//           completionPercentage: monthlyRate,
//           chart: monthlyChart,
//         },
//         yearly: {
//           assigned: yearlyAssigned,
//           completed: yearlyCompleted,
//           completionPercentage: yearlyRate,
//           chart: yearlyChart,
//         },
//         productivity: { avgTasksPerWeek, avgTasksPerMonth, avgCompletionTime, overduePercentage },
//         performance: { score, rating },
//         recentTasks,
//       },
//     });
//   } catch (err) {
//     console.error("Analytics error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// module.exports = router;




















const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Task = require("../models/Task");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a { start, end } date window from query params.
 * Priority: from+to  >  period preset  >  null (all time)
 */
function buildDateWindow(query) {
  const { from, to, period } = query;

  // 1. Explicit custom range
  if (from && to) {
    const start = new Date(from);
    start.setHours(0, 0, 0, 0);
    const end = new Date(to);
    end.setHours(23, 59, 59, 999);
    if (!isNaN(start) && !isNaN(end) && start <= end) {
      return { start, end };
    }
  }

  // 2. Preset period
  if (period && period !== "all") {
    const now = new Date();
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    switch (period) {
      case "week": {
        const day = start.getDay();
        const diffToMon = day === 0 ? -6 : 1 - day;
        start.setDate(start.getDate() + diffToMon);
        break;
      }
      case "month":
        start.setDate(1);
        break;
      case "quarter": {
        const q = Math.floor(now.getMonth() / 3);
        start.setMonth(q * 3, 1);
        break;
      }
      case "year":
        start.setMonth(0, 1);
        break;
      default:
        return null;
    }

    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  // 3. All time
  return null;
}

// ─── GET /api/analytics/employees ────────────────────────────────────────────
router.get("/employees", async (req, res) => {
  try {
    const employees = await User.find({ isActive: true })
      .populate("role", "name")
      .select("name email role isOnline isActive")
      .lean();

    res.json({ success: true, data: employees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/analytics/employee/:id ─────────────────────────────────────────
router.get("/employee/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // ── Employee ──────────────────────────────────────────────────────────────
    const employee = await User.findById(id)
      .populate("role", "name")
      .select("name email role isOnline isActive")
      .lean();

    if (!employee) {
      return res
        .status(404)
        .json({ success: false, message: "Employee not found" });
    }

    // ── Date window from query params ─────────────────────────────────────────
    // ALL filtering is based on start_date
    const window = buildDateWindow(req.query);

    const now = new Date();

    // ── Tasks filtered by window (start_date) ─────────────────────────────────
    const dbQuery = { assigned_to: id };
    if (window) {
      dbQuery.start_date = { $gte: window.start, $lte: window.end };
    }

    const allTasks = await Task.find(dbQuery)
      .populate("project", "name")
      .lean();

    // ─── Summary ──────────────────────────────────────────────────────────────
    const total = allTasks.length;
    const completed = allTasks.filter((t) => t.status === "DONE").length;
    const inProgress = allTasks.filter(
      (t) => t.status === "IN_PROGRESS",
    ).length;
    const pending = allTasks.filter((t) => t.status === "TODO").length;
    const overdue = allTasks.filter(
      (t) => t.due_date && new Date(t.due_date) < now && t.status !== "DONE",
    ).length;
    const highPriority = allTasks.filter((t) => t.priority === "HIGH").length;
    const completionRate =
      total > 0 ? Math.round((completed / total) * 100) : 0;

    // ─── Status & Priority breakdown ──────────────────────────────────────────
    const status = { todo: pending, inProgress, done: completed };
    const priority = {
      HIGH: allTasks.filter((t) => t.priority === "HIGH").length,
      MEDIUM: allTasks.filter((t) => t.priority === "MEDIUM").length,
      LOW: allTasks.filter((t) => t.priority === "LOW").length,
    };

    // ─── Weekly chart (Mon–Sun of current week, bucketed by start_date) ───────
    const weekStart = new Date(now);
    const dayOfWeek = weekStart.getDay();
    weekStart.setDate(
      weekStart.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek),
    );
    weekStart.setHours(0, 0, 0, 0);

    const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    const weeklyChart = DAYS.map((dayName, i) => {
      const dayStart = new Date(weekStart);
      dayStart.setDate(dayStart.getDate() + i);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart);
      dayEnd.setHours(23, 59, 59, 999);

      // Both assigned & completed bucketed by start_date
      const dayTasks = allTasks.filter(
        (t) =>
          new Date(t.start_date) >= dayStart &&
          new Date(t.start_date) <= dayEnd,
      );

      return {
        day: dayName,
        assigned: dayTasks.length,
        completed: dayTasks.filter((t) => t.status === "DONE").length,
      };
    });

    const weeklyAssigned = weeklyChart.reduce((s, d) => s + d.assigned, 0);
    const weeklyCompleted = weeklyChart.reduce((s, d) => s + d.completed, 0);

    // ─── Monthly chart (Jan–Dec of current year, bucketed by start_date) ──────
    const currentYear = now.getFullYear();
    const MONTHS = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const monthlyChart = MONTHS.map((monthName, i) => {
      const mStart = new Date(currentYear, i, 1, 0, 0, 0, 0);
      const mEnd = new Date(currentYear, i + 1, 0, 23, 59, 59, 999);

      // Both assigned & completed bucketed by start_date
      const monthTasks = allTasks.filter(
        (t) =>
          new Date(t.start_date) >= mStart && new Date(t.start_date) <= mEnd,
      );

      return {
        month: monthName,
        assigned: monthTasks.length,
        completed: monthTasks.filter((t) => t.status === "DONE").length,
      };
    });

    const currentMonthIdx = now.getMonth();
    const monthlyAssigned = monthlyChart[currentMonthIdx].assigned;
    const monthlyCompleted = monthlyChart[currentMonthIdx].completed;
    const monthlyRate =
      monthlyAssigned > 0
        ? Math.round((monthlyCompleted / monthlyAssigned) * 100)
        : 0;

    // ─── Yearly chart (all tasks ever, bucketed by start_date) ────────────────
    // Always fetch ALL tasks (ignore window) so history is always visible
    const allTasksForYearly = window
      ? await Task.find({ assigned_to: id }).populate("project", "name").lean()
      : allTasks;

    const years = [
      ...new Set(
        allTasksForYearly.map((t) => new Date(t.start_date).getFullYear()),
      ),
    ].sort();

    const yearlyChart = years.map((yr) => {
      const yStart = new Date(yr, 0, 1, 0, 0, 0, 0);
      const yEnd = new Date(yr, 11, 31, 23, 59, 59, 999);

      const yearTasks = allTasksForYearly.filter(
        (t) =>
          new Date(t.start_date) >= yStart && new Date(t.start_date) <= yEnd,
      );

      return {
        year: String(yr),
        assigned: yearTasks.length,
        // completed = DONE tasks whose start_date falls in this year
        completed: yearTasks.filter((t) => t.status === "DONE").length,
      };
    });

    // Current-year summary (start_date based)
    const yearStart = new Date(currentYear, 0, 1, 0, 0, 0, 0);
    const yearEnd = new Date(currentYear, 11, 31, 23, 59, 59, 999);

    const yearlyCurrentTasks = allTasksForYearly.filter(
      (t) =>
        new Date(t.start_date) >= yearStart &&
        new Date(t.start_date) <= yearEnd,
    );

    console.log(
  allTasksForYearly.map(t => ({
    title: t.title,
    start: t.start_date
  }))
);

    const yearlyAssigned = yearlyCurrentTasks.length;
    const yearlyCompleted = yearlyCurrentTasks.filter(
      (t) => t.status === "DONE",
    ).length;
    const yearlyRate =
      yearlyAssigned > 0
        ? Math.round((yearlyCompleted / yearlyAssigned) * 100)
        : 0;

    // ─── Productivity metrics ─────────────────────────────────────────────────
    let avgTasksPerWeek = 0;
    let avgTasksPerMonth = 0;
    let avgCompletionTime = 0;

    if (total > 0) {
      // Span is derived from earliest start_date in the filtered set
      const sorted = [...allTasks].sort(
        (a, b) => new Date(a.start_date) - new Date(b.start_date),
      );
      const firstDate = new Date(sorted[0].start_date);
      const effectiveStart = window ? window.start : firstDate;
      const effectiveEnd = window ? window.end : now;

      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const weeksElapsed = Math.max(
        1,
        (effectiveEnd - effectiveStart) / msPerWeek,
      );
      const monthsElapsed = Math.max(1, weeksElapsed / 4.33);

      avgTasksPerWeek = Math.round((total / weeksElapsed) * 10) / 10;
      avgTasksPerMonth = Math.round((total / monthsElapsed) * 10) / 10;

      // Avg completion time: from start_date → completedAt (for DONE tasks only)
      const doneTasks = allTasks.filter(
        (t) => t.status === "DONE" && t.start_date && t.completedAt,
      );
      if (doneTasks.length > 0) {
        const totalDays = doneTasks.reduce((sum, t) => {
          const days =
            (new Date(t.completedAt) - new Date(t.start_date)) /
            (1000 * 60 * 60 * 24);
          return sum + Math.max(0, days);
        }, 0);
        avgCompletionTime =
          Math.round((totalDays / doneTasks.length) * 10) / 10;
      }
    }

    const overduePercentage =
      total > 0 ? Math.round((overdue / total) * 100) : 0;

    // ─── Performance score & rating ───────────────────────────────────────────
    let score = 0;
    if (total > 0) {
      const highPriorityDone = allTasks.filter(
        (t) => t.priority === "HIGH" && t.status === "DONE",
      ).length;

      const completionScore = (completionRate / 100) * 50;
      const overdueScore = ((100 - overduePercentage) / 100) * 30;
      const highPriorityScore =
        highPriority > 0 ? (highPriorityDone / highPriority) * 20 : 20;

      score = Math.round(completionScore + overdueScore + highPriorityScore);
    }

    const rating =
      score >= 90
        ? "Excellent"
        : score >= 75
          ? "Good"
          : score >= 60
            ? "Average"
            : "Needs Improvement";

    // ─── Recent tasks (last 10, enriched with completionDays) ────────────────
    const recentTasks = [...allTasks]
      .sort((a, b) => new Date(b.start_date) - new Date(a.start_date)) // newest start_date first
      .slice(0, 10)
      .map((task) => {
        let completionDays = null;
        if (task.status === "DONE" && task.start_date && task.completedAt) {
          const diffMs = new Date(task.completedAt) - new Date(task.start_date);
          completionDays = Number((diffMs / (1000 * 60 * 60 * 24)).toFixed(1));
        }
        return { ...task, completionDays };
      });

    // ─── Response ─────────────────────────────────────────────────────────────
    res.json({
      success: true,
      data: {
        employee,
        activeFilter: window
          ? { from: window.start.toISOString(), to: window.end.toISOString() }
          : null,
        summary: {
          total,
          completed,
          pending,
          inProgress,
          overdue,
          highPriority,
          completionRate,
        },
        status,
        priority,
        weekly: {
          assigned: weeklyAssigned,
          completed: weeklyCompleted,
          completionPercentage:
            weeklyAssigned > 0
              ? Math.round((weeklyCompleted / weeklyAssigned) * 100)
              : 0,
          chart: weeklyChart,
        },
        monthly: {
          assigned: monthlyAssigned,
          completed: monthlyCompleted,
          completionPercentage: monthlyRate,
          chart: monthlyChart,
        },
        yearly: {
          assigned: yearlyAssigned,
          completed: yearlyCompleted,
          completionPercentage: yearlyRate,
          chart: yearlyChart,
        },
        productivity: {
          avgTasksPerWeek,
          avgTasksPerMonth,
          avgCompletionTime,
          overduePercentage,
        },
        performance: { score, rating },
        recentTasks,
      },
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
