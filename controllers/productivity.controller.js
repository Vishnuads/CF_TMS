


// // controllers/productivity.controller.js

// const User = require("../models/User");

// const {
//   computeProductivityScore,
//   closedSessionSeconds,
// } = require("../services/productivityScore.service");

// // ============================================================
// // FORMAT DURATION
// // ============================================================

// function fmtDuration(seconds = 0) {
//   const total = Math.max(0, Math.floor(Number(seconds) || 0));

//   const hours = Math.floor(total / 3600);
//   const minutes = Math.floor((total % 3600) / 60);

//   if (hours === 0) return `${minutes}m`;
//   if (minutes === 0) return `${hours}h`;

//   return `${hours}h ${minutes}m`;
// }

// // ============================================================
// // PERIOD RESOLUTION
// // ============================================================
// //
// // Supports four `period` query values:
// //   daily    → ?period=daily&date=YYYY-MM-DD
// //   weekly   → ?period=weekly&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// //   monthly  → ?period=monthly&month=1-12&year=YYYY   (default when
// //              `period` is omitted, for backward compatibility)
// //   yearly   → ?period=yearly&year=YYYY
// //
// // Dates are parsed as LOCAL calendar dates (not UTC) so a date like
// // "2026-08-03" always means the 3rd of August in server-local time,
// // matching how the attendance `date` field is stored — parsing with
// // `new Date("2026-08-03")` instead would read it as UTC midnight and
// // can silently shift it to the previous day depending on timezone.
// // ============================================================

// const VALID_GRANULARITIES = ["daily", "weekly", "monthly", "yearly"];

// function parseISODateLocal(str) {
//   if (!str || typeof str !== "string") return null;

//   const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
//   if (!match) return null;

//   const [, y, m, d] = match;
//   const date = new Date(Number(y), Number(m) - 1, Number(d));

//   return Number.isNaN(date.getTime()) ? null : date;
// }

// function startOfDay(date) {
//   const d = new Date(date);
//   d.setHours(0, 0, 0, 0);
//   return d;
// }

// function endOfDay(date) {
//   const d = new Date(date);
//   d.setHours(23, 59, 59, 999);
//   return d;
// }

// function startOfWeekMonday(date) {
//   const d = startOfDay(date);
//   const day = d.getDay();
//   const diff = (day === 0 ? -6 : 1) - day;
//   d.setDate(d.getDate() + diff);
//   return d;
// }

// function endOfWeekMonday(date) {
//   const s = startOfWeekMonday(date);
//   const e = new Date(s);
//   e.setDate(s.getDate() + 6);
//   return endOfDay(e);
// }

// function monthRange(month, year) {
//   const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
//   const end = new Date(year, month, 0, 23, 59, 59, 999);
//   return { start, end };
// }

// function yearRange(year) {
//   return {
//     start: new Date(year, 0, 1, 0, 0, 0, 0),
//     end: new Date(year, 11, 31, 23, 59, 59, 999),
//   };
// }

// function resolvePeriod(query) {
//   const now = new Date();

//   const granularity = VALID_GRANULARITIES.includes(query.period)
//     ? query.period
//     : "monthly";

//   if (granularity === "daily") {
//     const date = query.date ? parseISODateLocal(query.date) : now;

//     if (!date) {
//       return { error: "Invalid date. Expected format: YYYY-MM-DD" };
//     }

//     return {
//       granularity,
//       start: startOfDay(date),
//       end: endOfDay(date),
//       month: date.getMonth() + 1,
//       year: date.getFullYear(),
//     };
//   }

//   if (granularity === "weekly") {
//     let start;
//     let end;

//     if (query.startDate || query.endDate) {
//       const s = parseISODateLocal(query.startDate);
//       const e = parseISODateLocal(query.endDate);

//       if (!s || !e) {
//         return {
//           error: "Invalid startDate/endDate. Expected format: YYYY-MM-DD",
//         };
//       }

//       if (e < s) {
//         return { error: "endDate cannot be before startDate" };
//       }

//       start = startOfDay(s);
//       end = endOfDay(e);
//     } else {
//       start = startOfWeekMonday(now);
//       end = endOfWeekMonday(now);
//     }

//     return {
//       granularity,
//       start,
//       end,
//       month: start.getMonth() + 1,
//       year: start.getFullYear(),
//     };
//   }

//   if (granularity === "yearly") {
//     const year = Number.parseInt(query.year, 10) || now.getFullYear();
//     const { start, end } = yearRange(year);

//     return { granularity, start, end, month: null, year };
//   }

//   // monthly (default)
//   const month = Number.parseInt(query.month, 10) || now.getMonth() + 1;
//   const year = Number.parseInt(query.year, 10) || now.getFullYear();

//   if (month < 1 || month > 12) {
//     return { error: "Invalid month" };
//   }

//   const { start, end } = monthRange(month, year);

//   return { granularity, start, end, month, year };
// }

// // ============================================================
// // CONTROLLER
// // ============================================================

// exports.getEmployeeProductivity = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     const resolved = resolvePeriod(req.query);

//     if (resolved.error) {
//       return res.status(400).json({
//         success: false,
//         message: resolved.error,
//       });
//     }

//     const { granularity, start, end, month, year } = resolved;

//     // ========================================================
//     // EMPLOYEE
//     // ========================================================

//     const employee = await User.findById(userId)
//       .select("name email")
//       .populate("role", "name");

//     if (!employee) {
//       return res.status(404).json({
//         success: false,
//         message: "Employee not found",
//       });
//     }

//     // ========================================================
//     // CALCULATE PRODUCTIVITY
//     // ========================================================

//     const result = await computeProductivityScore(userId, {
//       start,
//       end,
//       month,
//       year,
//     });

//     // ========================================================
//     // ATTENDANCE TABLE
//     // ========================================================

//     const attendance = result.raw.attendance.map((record) => {
//       const sessions = Array.isArray(record.sessions)
//         ? [...record.sessions]
//         : [];

//       sessions.sort(
//         (a, b) => new Date(a.loginTime) - new Date(b.loginTime),
//       );

//       const first = sessions[0];
//       const firstCheckIn = first?.loginTime || null;

//       const onTimeArrival = firstCheckIn
//         ? new Date(firstCheckIn).getHours() < 10
//         : false;

//       const totalDuration = closedSessionSeconds(record);

//       return {
//         _id: record._id,
//         date: record.date,
//         firstCheckIn,
//         onTimeArrival,
//         totalDuration,
//         totalDurationLabel: fmtDuration(totalDuration),
//         sessionCount: sessions.length,
//       };
//     });

//     // ========================================================
//     // TASK TABLE
//     // ========================================================

//     const tasks = result.raw.tasks.map((task) => {
//       let onTime = null;

//       if (task.status === "DONE" && task.completedAt) {
//         if (!task.due_date) {
//           onTime = true;
//         } else {
//           onTime = new Date(task.completedAt) <= new Date(task.due_date);
//         }
//       }

//       return {
//         _id: task._id,
//         title: task.title,
//         project: task.project?.name || null,
//         priority: task.priority || "LOW",
//         status: task.status,
//         due_date: task.due_date || null,
//         completedAt: task.completedAt || null,
//         onTime,
//         totalTimeSpent: Number(task.totalTimeSpent || 0),
//         totalTimeSpentLabel: fmtDuration(task.totalTimeSpent || 0),
//       };
//     });

//     // ========================================================
//     // RESPONSE
//     // ========================================================

//     return res.json({
//       success: true,

//       data: {
//         employee,

//         period: {
//           granularity,
//           month,
//           year,
//           start,
//           end,
//         },

//         score: result.score,
//         rating: result.rating,
//         metrics: result.metrics,
//         totals: result.totals,

//         summary: {
//           totalLoggedLabel: fmtDuration(result.raw.totalLoggedSeconds),
//           activeLabel: fmtDuration(result.raw.inProgressSeconds),
//           idleLabel: fmtDuration(result.raw.idleSeconds),

//           totalLoggedSeconds: result.raw.totalLoggedSeconds,
//           activeSeconds: result.raw.inProgressSeconds,
//           idleSeconds: result.raw.idleSeconds,

//           productivityPercentage: result.raw.productivityPercent,
//           idlePercentage: result.raw.idlePercent,

//           workingDays: result.raw.workingDays,
//           expectedSeconds: result.raw.expectedSeconds,
//           standardWorkdayHours: result.totals.standardWorkdayHours,

//           presentDays: result.totals.presentDays,
//           onTimeLoginDays: result.totals.onTimeLoginDays,
//           lateLoginDays: result.totals.lateLoginDays,
//           gracedLateDays: result.totals.gracedLateDays,
//         },

//         attendance,
//         tasks,
//       },
//     });
//   } catch (error) {
//     console.error("getEmployeeProductivity error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error.message || "Failed to calculate productivity",
//     });
//   }
// };








































// // controllers/productivity.controller.js

// const User = require("../models/User");

// const {
//   computeProductivityScore,
//   closedSessionSeconds,
//   isOnTimeLogin, // timezone-safe (IST) on-time/late check — shared with the score service
// } = require("../services/productivityScore.service");

// // ============================================================
// // FORMAT DURATION
// // ============================================================

// function fmtDuration(seconds = 0) {
//   const total = Math.max(0, Math.floor(Number(seconds) || 0));

//   const hours = Math.floor(total / 3600);
//   const minutes = Math.floor((total % 3600) / 60);

//   if (hours === 0) return `${minutes}m`;
//   if (minutes === 0) return `${hours}h`;

//   return `${hours}h ${minutes}m`;
// }

// // ============================================================
// // PERIOD RESOLUTION
// // ============================================================
// //
// // Supports four `period` query values:
// //   daily    → ?period=daily&date=YYYY-MM-DD
// //   weekly   → ?period=weekly&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// //   monthly  → ?period=monthly&month=1-12&year=YYYY   (default when
// //              `period` is omitted, for backward compatibility)
// //   yearly   → ?period=yearly&year=YYYY
// //
// // Dates are parsed as LOCAL calendar dates (not UTC) so a date like
// // "2026-08-03" always means the 3rd of August in server-local time,
// // matching how the attendance `date` field is stored — parsing with
// // `new Date("2026-08-03")` instead would read it as UTC midnight and
// // can silently shift it to the previous day depending on timezone.
// // ============================================================

// const VALID_GRANULARITIES = ["daily", "weekly", "monthly", "yearly"];

// function parseISODateLocal(str) {
//   if (!str || typeof str !== "string") return null;

//   const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
//   if (!match) return null;

//   const [, y, m, d] = match;
//   const date = new Date(Number(y), Number(m) - 1, Number(d));

//   return Number.isNaN(date.getTime()) ? null : date;
// }

// function startOfDay(date) {
//   const d = new Date(date);
//   d.setHours(0, 0, 0, 0);
//   return d;
// }

// function endOfDay(date) {
//   const d = new Date(date);
//   d.setHours(23, 59, 59, 999);
//   return d;
// }

// function startOfWeekMonday(date) {
//   const d = startOfDay(date);
//   const day = d.getDay();
//   const diff = (day === 0 ? -6 : 1) - day;
//   d.setDate(d.getDate() + diff);
//   return d;
// }

// function endOfWeekMonday(date) {
//   const s = startOfWeekMonday(date);
//   const e = new Date(s);
//   e.setDate(s.getDate() + 6);
//   return endOfDay(e);
// }

// function monthRange(month, year) {
//   const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
//   const end = new Date(year, month, 0, 23, 59, 59, 999);
//   return { start, end };
// }

// function yearRange(year) {
//   return {
//     start: new Date(year, 0, 1, 0, 0, 0, 0),
//     end: new Date(year, 11, 31, 23, 59, 59, 999),
//   };
// }

// function resolvePeriod(query) {
//   const now = new Date();

//   const granularity = VALID_GRANULARITIES.includes(query.period)
//     ? query.period
//     : "monthly";

//   if (granularity === "daily") {
//     const date = query.date ? parseISODateLocal(query.date) : now;

//     if (!date) {
//       return { error: "Invalid date. Expected format: YYYY-MM-DD" };
//     }

//     return {
//       granularity,
//       start: startOfDay(date),
//       end: endOfDay(date),
//       month: date.getMonth() + 1,
//       year: date.getFullYear(),
//     };
//   }

//   if (granularity === "weekly") {
//     let start;
//     let end;

//     if (query.startDate || query.endDate) {
//       const s = parseISODateLocal(query.startDate);
//       const e = parseISODateLocal(query.endDate);

//       if (!s || !e) {
//         return {
//           error: "Invalid startDate/endDate. Expected format: YYYY-MM-DD",
//         };
//       }

//       if (e < s) {
//         return { error: "endDate cannot be before startDate" };
//       }

//       start = startOfDay(s);
//       end = endOfDay(e);
//     } else {
//       start = startOfWeekMonday(now);
//       end = endOfWeekMonday(now);
//     }

//     return {
//       granularity,
//       start,
//       end,
//       month: start.getMonth() + 1,
//       year: start.getFullYear(),
//     };
//   }

//   if (granularity === "yearly") {
//     const year = Number.parseInt(query.year, 10) || now.getFullYear();
//     const { start, end } = yearRange(year);

//     return { granularity, start, end, month: null, year };
//   }

//   // monthly (default)
//   const month = Number.parseInt(query.month, 10) || now.getMonth() + 1;
//   const year = Number.parseInt(query.year, 10) || now.getFullYear();

//   if (month < 1 || month > 12) {
//     return { error: "Invalid month" };
//   }

//   const { start, end } = monthRange(month, year);

//   return { granularity, start, end, month, year };
// }

// // ============================================================
// // CONTROLLER
// // ============================================================

// exports.getEmployeeProductivity = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     const resolved = resolvePeriod(req.query);

//     if (resolved.error) {
//       return res.status(400).json({
//         success: false,
//         message: resolved.error,
//       });
//     }

//     const { granularity, start, end, month, year } = resolved;

//     // ========================================================
//     // EMPLOYEE
//     // ========================================================

//     const employee = await User.findById(userId)
//       .select("name email")
//       .populate("role", "name");

//     if (!employee) {
//       return res.status(404).json({
//         success: false,
//         message: "Employee not found",
//       });
//     }

//     // ========================================================
//     // CALCULATE PRODUCTIVITY
//     // ========================================================

//     const result = await computeProductivityScore(userId, {
//       start,
//       end,
//       month,
//       year,
//     });

//     // ========================================================
//     // ATTENDANCE TABLE
//     //
//     // `onTimeArrival` now uses `isOnTimeLogin()`, the SAME
//     // timezone-safe (IST) function the score service uses for
//     // Schedule Adherence. Previously this compared
//     // `new Date(firstCheckIn).getHours() < 10` directly, which reads
//     // the hour in the SERVER's local timezone. On servers running in
//     // UTC, a 10:18 AM IST login (~04:48 UTC) evaluated as hour `4`,
//     // which is `< 10` — incorrectly marked "on time" — even though
//     // it displays correctly as 10:18 AM in the browser (which
//     // formats using the browser's own IST locale). Reusing
//     // `isOnTimeLogin()` here keeps the attendance table and the
//     // Schedule Adherence score permanently in agreement.
//     // ========================================================

//     const attendance = result.raw.attendance.map((record) => {
//       const sessions = Array.isArray(record.sessions)
//         ? [...record.sessions]
//         : [];

//       sessions.sort(
//         (a, b) => new Date(a.loginTime) - new Date(b.loginTime),
//       );

//       const first = sessions[0];
//       const firstCheckIn = first?.loginTime || null;

//       const onTimeArrival = firstCheckIn
//         ? isOnTimeLogin(firstCheckIn)
//         : false;

//       const totalDuration = closedSessionSeconds(record);

//       return {
//         _id: record._id,
//         date: record.date,
//         firstCheckIn,
//         onTimeArrival,
//         totalDuration,
//         totalDurationLabel: fmtDuration(totalDuration),
//         sessionCount: sessions.length,
//       };
//     });

//     // ========================================================
//     // TASK TABLE
//     // ========================================================

//     const tasks = result.raw.tasks.map((task) => {
//       let onTime = null;

//       if (task.status === "DONE" && task.completedAt) {
//         if (!task.due_date) {
//           onTime = true;
//         } else {
//           onTime = new Date(task.completedAt) <= new Date(task.due_date);
//         }
//       }

//       return {
//         _id: task._id,
//         title: task.title,
//         project: task.project?.name || null,
//         priority: task.priority || "LOW",
//         status: task.status,
//         due_date: task.due_date || null,
//         completedAt: task.completedAt || null,
//         onTime,
//         totalTimeSpent: Number(task.totalTimeSpent || 0),
//         totalTimeSpentLabel: fmtDuration(task.totalTimeSpent || 0),
//       };
//     });

//     // ========================================================
//     // RESPONSE
//     // ========================================================

//     return res.json({
//       success: true,

//       data: {
//         employee,

//         period: {
//           granularity,
//           month,
//           year,
//           start,
//           end,
//         },

//         score: result.score,
//         rating: result.rating,
//         metrics: result.metrics,
//         totals: result.totals,

//         summary: {
//           totalLoggedLabel: fmtDuration(result.raw.totalLoggedSeconds),
//           activeLabel: fmtDuration(result.raw.inProgressSeconds),
//           idleLabel: fmtDuration(result.raw.idleSeconds),

//           totalLoggedSeconds: result.raw.totalLoggedSeconds,
//           activeSeconds: result.raw.inProgressSeconds,
//           idleSeconds: result.raw.idleSeconds,

//           productivityPercentage: result.raw.productivityPercent,
//           idlePercentage: result.raw.idlePercent,

//           workingDays: result.raw.workingDays,
//           expectedSeconds: result.raw.expectedSeconds,
//           standardWorkdayHours: result.totals.standardWorkdayHours,

//           presentDays: result.totals.presentDays,
//           onTimeLoginDays: result.totals.onTimeLoginDays,
//           lateLoginDays: result.totals.lateLoginDays,
//           gracedLateDays: result.totals.gracedLateDays,
//         },

//         attendance,
//         tasks,
//       },
//     });
//   } catch (error) {
//     console.error("getEmployeeProductivity error:", error);

//     return res.status(500).json({
//       success: false,
//       message: error.message || "Failed to calculate productivity",
//     });
//   }
// };






























// controllers/productivity.controller.js

const User = require("../models/User");

const {
  computeProductivityScore,
  closedSessionSeconds,
  isOnTimeLogin, // timezone-safe (IST) on-time/late check — shared with the score service
} = require("../services/productivityScore.service");

// ============================================================
// FORMAT DURATION
// ============================================================

function fmtDuration(seconds = 0) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));

  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);

  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;

  return `${hours}h ${minutes}m`;
}

// ============================================================
// PERIOD RESOLUTION
// ============================================================
//
// Supports four `period` query values:
//   daily    → ?period=daily&date=YYYY-MM-DD
//   weekly   → ?period=weekly&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
//   monthly  → ?period=monthly&month=1-12&year=YYYY   (default when
//              `period` is omitted, for backward compatibility)
//   yearly   → ?period=yearly&year=YYYY
//
// Dates are parsed as LOCAL calendar dates (not UTC) so a date like
// "2026-08-03" always means the 3rd of August in server-local time,
// matching how the attendance `date` field is stored.
// ============================================================

const VALID_GRANULARITIES = ["daily", "weekly", "monthly", "yearly"];

function parseISODateLocal(str) {
  if (!str || typeof str !== "string") return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str.trim());
  if (!match) return null;

  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));

  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfWeekMonday(date) {
  const d = startOfDay(date);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function endOfWeekMonday(date) {
  const s = startOfWeekMonday(date);
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  return endOfDay(e);
}

function monthRange(month, year) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

function yearRange(year) {
  return {
    start: new Date(year, 0, 1, 0, 0, 0, 0),
    end: new Date(year, 11, 31, 23, 59, 59, 999),
  };
}

function resolvePeriod(query) {
  const now = new Date();

  const granularity = VALID_GRANULARITIES.includes(query.period)
    ? query.period
    : "monthly";

  if (granularity === "daily") {
    const date = query.date ? parseISODateLocal(query.date) : now;

    if (!date) {
      return { error: "Invalid date. Expected format: YYYY-MM-DD" };
    }

    return {
      granularity,
      start: startOfDay(date),
      end: endOfDay(date),
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  }

  if (granularity === "weekly") {
    let start;
    let end;

    if (query.startDate || query.endDate) {
      const s = parseISODateLocal(query.startDate);
      const e = parseISODateLocal(query.endDate);

      if (!s || !e) {
        return {
          error: "Invalid startDate/endDate. Expected format: YYYY-MM-DD",
        };
      }

      if (e < s) {
        return { error: "endDate cannot be before startDate" };
      }

      start = startOfDay(s);
      end = endOfDay(e);
    } else {
      start = startOfWeekMonday(now);
      end = endOfWeekMonday(now);
    }

    return {
      granularity,
      start,
      end,
      month: start.getMonth() + 1,
      year: start.getFullYear(),
    };
  }

  if (granularity === "yearly") {
    const year = Number.parseInt(query.year, 10) || now.getFullYear();
    const { start, end } = yearRange(year);

    return { granularity, start, end, month: null, year };
  }

  // monthly (default)
  const month = Number.parseInt(query.month, 10) || now.getMonth() + 1;
  const year = Number.parseInt(query.year, 10) || now.getFullYear();

  if (month < 1 || month > 12) {
    return { error: "Invalid month" };
  }

  const { start, end } = monthRange(month, year);

  return { granularity, start, end, month, year };
}

// ============================================================
// CONTROLLER
// ============================================================

exports.getEmployeeProductivity = async (req, res) => {
  try {
    const { userId } = req.params;

    const resolved = resolvePeriod(req.query);

    if (resolved.error) {
      return res.status(400).json({
        success: false,
        message: resolved.error,
      });
    }

    const { granularity, start, end, month, year } = resolved;

    // ========================================================
    // EMPLOYEE
    // ========================================================

    const employee = await User.findById(userId)
      .select("name email")
      .populate("role", "name");

    if (!employee) {
      return res.status(404).json({
        success: false,
        message: "Employee not found",
      });
    }

    // ========================================================
    // CALCULATE PRODUCTIVITY
    // ========================================================

    const result = await computeProductivityScore(userId, {
      start,
      end,
      month,
      year,
    });

    // ========================================================
    // ATTENDANCE TABLE
    //
    // `onTimeArrival` uses `isOnTimeLogin()`, the SAME timezone-safe
    // (IST) function the score service uses for Schedule Adherence,
    // so the attendance table and the score can never disagree.
    // ========================================================

    const attendance = result.raw.attendance.map((record) => {
      const sessions = Array.isArray(record.sessions)
        ? [...record.sessions]
        : [];

      sessions.sort(
        (a, b) => new Date(a.loginTime) - new Date(b.loginTime),
      );

      const first = sessions[0];
      const firstCheckIn = first?.loginTime || null;

      const onTimeArrival = firstCheckIn
        ? isOnTimeLogin(firstCheckIn)
        : false;

      const totalDuration = closedSessionSeconds(record);

      return {
        _id: record._id,
        date: record.date,
        firstCheckIn,
        onTimeArrival,
        totalDuration,
        totalDurationLabel: fmtDuration(totalDuration),
        sessionCount: sessions.length,
      };
    });

    // ========================================================
    // TASK TABLE
    //
    // `result.raw.tasks` already has `completedAt` recovered by the
    // service (falling back to `updatedAt` for DONE tasks that never
    // had `completedAt` populated — see `effectiveCompletedAt()` in
    // the service for the full explanation). We reuse that same
    // recovered value here so the table shows a real completion
    // date instead of a blank "—" for those tasks, and so `onTime`
    // is computed consistently with the score calculation.
    // ========================================================

    const tasks = result.raw.tasks.map((task) => {
      let onTime = null;

      if (task.status === "DONE" && task.completedAt) {
        if (!task.due_date) {
          onTime = true;
        } else {
          onTime = new Date(task.completedAt) <= new Date(task.due_date);
        }
      }

      return {
        _id: task._id,
        title: task.title,
        project: task.project?.name || null,
        priority: task.priority || "LOW",
        status: task.status,
        due_date: task.due_date || null,
        completedAt: task.completedAt || null,
        onTime,
        totalTimeSpent: Number(task.totalTimeSpent || 0),
        totalTimeSpentLabel: fmtDuration(task.totalTimeSpent || 0),
      };
    });

    // ========================================================
    // RESPONSE
    // ========================================================

    return res.json({
      success: true,

      data: {
        employee,

        period: {
          granularity,
          month,
          year,
          start,
          end,
        },

        score: result.score,
        rating: result.rating,
        metrics: result.metrics,
        totals: result.totals,

        summary: {
          totalLoggedLabel: fmtDuration(result.raw.totalLoggedSeconds),
          activeLabel: fmtDuration(result.raw.inProgressSeconds),
          idleLabel: fmtDuration(result.raw.idleSeconds),

          totalLoggedSeconds: result.raw.totalLoggedSeconds,
          activeSeconds: result.raw.inProgressSeconds,
          idleSeconds: result.raw.idleSeconds,

          productivityPercentage: result.raw.productivityPercent,
          idlePercentage: result.raw.idlePercent,

          workingDays: result.raw.workingDays,
          expectedSeconds: result.raw.expectedSeconds,
          standardWorkdayHours: result.totals.standardWorkdayHours,

          presentDays: result.totals.presentDays,
          onTimeLoginDays: result.totals.onTimeLoginDays,
          lateLoginDays: result.totals.lateLoginDays,
          gracedLateDays: result.totals.gracedLateDays,
        },

        attendance,
        tasks,
      },
    });
  } catch (error) {
    console.error("getEmployeeProductivity error:", error);

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to calculate productivity",
    });
  }
};