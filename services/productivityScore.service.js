// const Attendance = require("../models/Attendance");
// const Task = require("../models/Task");

// // ============================================================
// // CONFIG
// // ============================================================

// // Office hours:
// // 9:30 AM – 6:30 PM = 9 hours standard workday
// const STANDARD_WORKDAY_HOURS = 9;

// // Before 10:00 AM IST = on time
// // 10:00 AM IST or later = late
// const SCHEDULE_CUTOFF_HOUR = 10;

// // One late login per period is forgiven.
// const LATE_LOGIN_GRACE_DAYS_PER_MONTH = 1;

// // Safety cap for a genuinely active session.
// // Prevents a broken session from accumulating forever.
// const MAX_LIVE_SESSION_SECONDS = 16 * 3600;

// // ============================================================
// // WEIGHTS
// // ============================================================

// const WEIGHTS = {
//   completion: 0.2,
//   priorityOnTime: 0.15,
//   onTime: 0.1,
//   loginHours: 0.15,
//   scheduleAdherence: 0.1,
//   productivity: 0.3,
// };

// // Combined weight for HIGH + LOW/MEDIUM on-time metrics.
// const ON_TIME_POOL_WEIGHT =
//   WEIGHTS.priorityOnTime + WEIGHTS.onTime;

// // ============================================================
// // IST TIMEZONE HELPERS
// // ============================================================

// const IST_OFFSET_MINUTES = 5 * 60 + 30;
// const IST_OFFSET_MS =
//   IST_OFFSET_MINUTES * 60 * 1000;

// /**
//  * Get IST hour/minute from an absolute date.
//  *
//  * This does NOT depend on the Node.js server timezone.
//  */
// function getISTHourMinute(date) {
//   if (!date) {
//     return {
//       hours: 0,
//       minutes: 0,
//     };
//   }

//   const d = new Date(date);

//   if (Number.isNaN(d.getTime())) {
//     return {
//       hours: 0,
//       minutes: 0,
//     };
//   }

//   const istShifted = new Date(
//     d.getTime() + IST_OFFSET_MS
//   );

//   return {
//     hours: istShifted.getUTCHours(),
//     minutes: istShifted.getUTCMinutes(),
//   };
// }

// /**
//  * Returns true when login happened before 10:00 AM IST.
//  */
// function isOnTimeLogin(loginTime) {
//   if (!loginTime) return false;

//   const { hours } = getISTHourMinute(loginTime);

//   return hours < SCHEDULE_CUTOFF_HOUR;
// }

// // ============================================================
// // IST DATE HELPERS
// // ============================================================

// /**
//  * Get IST calendar parts.
//  *
//  * Example:
//  * 2026-09-07T04:30:00.000Z
//  *
//  * becomes:
//  * 2026-09-07 10:00 IST
//  */
// function getISTDateParts(date) {
//   const d = new Date(date);

//   if (Number.isNaN(d.getTime())) {
//     return null;
//   }

//   const shifted = new Date(
//     d.getTime() + IST_OFFSET_MS
//   );

//   return {
//     year: shifted.getUTCFullYear(),
//     month: shifted.getUTCMonth(),
//     day: shifted.getUTCDate(),
//   };
// }

// /**
//  * Compare two dates using IST calendar date.
//  *
//  * This avoids depending on the server timezone.
//  */
// function isSameLocalDay(a, b) {
//   if (!a || !b) return false;

//   const da = getISTDateParts(a);
//   const db = getISTDateParts(b);

//   if (!da || !db) return false;

//   return (
//     da.year === db.year &&
//     da.month === db.month &&
//     da.day === db.day
//   );
// }

// /**
//  * Start of current/server local day.
//  *
//  * Kept for compatibility with existing callers.
//  *
//  * For attendance comparisons, isSameLocalDay()
//  * is preferred because it is IST-safe.
//  */
// function startOfDay(date = new Date()) {
//   const d = new Date(date);

//   if (Number.isNaN(d.getTime())) {
//     return new Date();
//   }

//   d.setHours(0, 0, 0, 0);

//   return d;
// }

// // ============================================================
// // MONTH RANGE
// // ============================================================

// function monthRange(month, year) {
//   const numericMonth = Number(month);
//   const numericYear = Number(year);

//   const start = new Date(
//     numericYear,
//     numericMonth - 1,
//     1,
//     0,
//     0,
//     0,
//     0
//   );

//   const end = new Date(
//     numericYear,
//     numericMonth,
//     0,
//     23,
//     59,
//     59,
//     999
//   );

//   return {
//     start,
//     end,
//   };
// }

// // ============================================================
// // WORKING DAYS
// // ============================================================

// function countWorkingDays(start, end) {
//   if (!start || !end) return 0;

//   const startDate = new Date(start);
//   const endDate = new Date(end);

//   if (
//     Number.isNaN(startDate.getTime()) ||
//     Number.isNaN(endDate.getTime())
//   ) {
//     return 0;
//   }

//   const today = startOfDay();

//   // Never count future working days.
//   const cappedEnd =
//     endDate > today ? today : endDate;

//   if (cappedEnd < startDate) {
//     return 0;
//   }

//   let count = 0;

//   const cursor = new Date(startDate);

//   while (cursor <= cappedEnd) {
//     const day = cursor.getDay();

//     // Monday -> Saturday
//     // Sunday = 0
//     if (day !== 0) {
//       count++;
//     }

//     cursor.setDate(cursor.getDate() + 1);
//   }

//   return count;
// }

// // ============================================================
// // ATTENDANCE DURATION
// // ============================================================
// //
// // IMPORTANT BUSINESS RULE
// //
// // Attendance is calculated as a DAY SPAN:
// //
// //     FIRST CHECK-IN
// //            ↓
// //     LATEST CHECK-OUT
// //
// // Example:
// //
// // Session 1:
// // 09:20 AM → 02:00 PM
// //
// // Session 2:
// // 02:30 PM → 07:00 PM
// //
// // Attendance:
// //
// // 09:20 AM → 07:00 PM
// //
// // = 9h 40m
// //
// // We DO NOT add:
// //
// // 4h 40m + 4h 30m = 9h 10m
// //
// // The gap between sessions is included in attendance span.
// //
// // ------------------------------------------------------------
// //
// // ACTIVE SESSION RULE
// //
// // If the latest session is currently open:
// //
// // Session 1:
// // 09:34 → 10:07
// //
// // Session 2:
// // 10:07 → ACTIVE
// //
// // Then:
// //
// // 09:34 → NOW
// //
// // Older open sessions are ignored as live sessions.
// //
// // Only the MOST RECENT session can be considered active.
// //
// // ------------------------------------------------------------

// function attendanceSeconds(record, { live = true } = {}) {
//   const sessions = Array.isArray(record?.sessions)
//     ? [...record.sessions]
//     : [];

//   if (sessions.length === 0) {
//     return 0;
//   }

//   // Sort sessions by login time
//   sessions.sort((a, b) => {
//     const aTime = new Date(a?.loginTime).getTime();
//     const bTime = new Date(b?.loginTime).getTime();

//     return aTime - bTime;
//   });

//   // First login of the day
//   const firstCheckIn = sessions.find(
//     (session) => session?.loginTime
//   )?.loginTime;

//   if (!firstCheckIn) {
//     return 0;
//   }

//   const firstCheckInMs = new Date(firstCheckIn).getTime();

//   if (!Number.isFinite(firstCheckInMs)) {
//     return 0;
//   }

//   // Latest session
//   const latestSession = sessions[sessions.length - 1];

//   const latestSessionIsOpen =
//     latestSession &&
//     !latestSession.logoutTime;

//   // Check whether attendance record belongs to today
//   const recordDate = record?.date || firstCheckIn;

//   const recordIsToday = isSameLocalDay(
//     recordDate,
//     new Date()
//   );

//   // ==========================================================
//   // LIVE SESSION
//   // ==========================================================

//   if (
//     live &&
//     recordIsToday &&
//     latestSessionIsOpen
//   ) {
//     const elapsedSeconds = Math.max(
//       0,
//       Math.floor(
//         (Date.now() - firstCheckInMs) / 1000
//       )
//     );

//     return Math.min(
//       elapsedSeconds,
//       MAX_LIVE_SESSION_SECONDS
//     );
//   }

//   // ==========================================================
//   // CLOSED SESSIONS
//   // ==========================================================

//   const closedSessions = sessions.filter(
//     (session) => {
//       if (!session?.logoutTime) {
//         return false;
//       }

//       const logoutMs = new Date(
//         session.logoutTime
//       ).getTime();

//       return Number.isFinite(logoutMs);
//     }
//   );

//   if (closedSessions.length === 0) {
//     return 0;
//   }

//   // Get latest logout
//   const latestLogout = closedSessions.reduce(
//     (latest, current) => {
//       const latestMs = new Date(
//         latest.logoutTime
//       ).getTime();

//       const currentMs = new Date(
//         current.logoutTime
//       ).getTime();

//       return currentMs > latestMs
//         ? current
//         : latest;
//     }
//   );

//   const lastCheckOutMs = new Date(
//     latestLogout.logoutTime
//   ).getTime();

//   if (!Number.isFinite(lastCheckOutMs)) {
//     return 0;
//   }

//   if (lastCheckOutMs < firstCheckInMs) {
//     return 0;
//   }

//   return Math.floor(
//     (lastCheckOutMs - firstCheckInMs) / 1000
//   );
// }

// // ============================================================
// // BACKWARD COMPATIBILITY ALIAS
// // ============================================================

// const closedSessionSeconds = attendanceSeconds;

// // ============================================================
// // SCORE BANDS
// // ============================================================

// const STANDARD_BANDS = [
//   {
//     min: 90,
//     points: 5,
//   },
//   {
//     min: 85,
//     points: 4,
//   },
//   {
//     min: 80,
//     points: 3,
//   },
//   {
//     min: 75,
//     points: 2,
//   },
//   {
//     min: -Infinity,
//     points: 1,
//   },
// ];

// const HOURS_BANDS = [
//   {
//     min: 95,
//     points: 5,
//   },
//   {
//     min: 90,
//     points: 4,
//   },
//   {
//     min: 85,
//     points: 3,
//   },
//   {
//     min: 80,
//     points: 2,
//   },
//   {
//     min: -Infinity,
//     points: 1,
//   },
// ];

// const PRODUCTIVITY_BANDS = [
//   {
//     min: 85,
//     points: 5,
//   },
//   {
//     min: 80,
//     points: 4,
//   },
//   {
//     min: 75,
//     points: 3,
//   },
//   {
//     min: 70,
//     points: 2,
//   },
//   {
//     min: -Infinity,
//     points: 1,
//   },
// ];

// // ============================================================
// // GENERIC HELPERS
// // ============================================================

// function scoreBand(
//   value,
//   bands,
//   { strict = false } = {}
// ) {
//   for (let i = 0; i < bands.length; i++) {
//     const {
//       min,
//       points,
//     } = bands[i];

//     const isTopBand = i === 0;

//     const passes =
//       isTopBand && strict
//         ? value > min
//         : value >= min;

//     if (passes) {
//       return points;
//     }
//   }

//   return bands[bands.length - 1].points;
// }

// function pct(
//   numerator,
//   denominator
// ) {
//   if (
//     !denominator ||
//     denominator <= 0
//   ) {
//     return 0;
//   }

//   return (
//     (numerator / denominator) *
//     100
//   );
// }

// function round1(value) {
//   return (
//     Math.round(value * 10) / 10
//   );
// }

// function clamp(
//   value,
//   min = 0,
//   max = 100
// ) {
//   return Math.min(
//     max,
//     Math.max(min, value)
//   );
// }

// // ============================================================
// // EMPTY METRIC HANDLER
// // ============================================================

// function calculateMetric({
//   key,
//   label,
//   weight,
//   value,
//   bands,
//   detail,
//   strict = false,
//   hasData = true,
// }) {
//   const safeValue = round1(
//     clamp(value)
//   );

//   const points = !hasData
//     ? 0
//     : scoreBand(
//         safeValue,
//         bands,
//         { strict }
//       );

//   const contribution =
//     points === 0
//       ? 0
//       : round1(
//           (weight * points * 100) /
//             5
//         );

//   return {
//     key,
//     label,
//     weight,
//     weightPercent:
//       Math.round(weight * 100),
//     value: safeValue,
//     points,
//     maxPoints: 5,
//     contribution,
//     detail,
//     hasData,
//   };
// }

// // ============================================================
// // ON-TIME TASK
// // ============================================================

// function isOnTime(task) {
//   if (
//     task.status !== "DONE" ||
//     !task.completedAt
//   ) {
//     return false;
//   }

//   // No due date means automatically on time.
//   if (!task.due_date) {
//     return true;
//   }

//   return (
//     new Date(task.completedAt) <=
//     new Date(task.due_date)
//   );
// }

// // ============================================================
// // MAIN PRODUCTIVITY CALCULATION
// // ============================================================

// async function computeProductivityScore(
//   userId,
//   period = {}
// ) {
//   const now = new Date();

//   let start;
//   let end;

//   let month = period.month;
//   let year = period.year;

//   // ==========================================================
//   // PERIOD
//   // ==========================================================

//   if (
//     period.start &&
//     period.end
//   ) {
//     start = new Date(
//       period.start
//     );

//     end = new Date(
//       period.end
//     );
//   } else {
//     month =
//       Number(period.month) ||
//       now.getMonth() + 1;

//     year =
//       Number(period.year) ||
//       now.getFullYear();

//     ({
//       start,
//       end,
//     } = monthRange(
//       month,
//       year
//     ));
//   }

//   // ==========================================================
//   // FETCH DATA
//   // ==========================================================

//   const [
//     attendance,
//     tasks,
//   ] = await Promise.all([
//     Attendance.find({
//       user: userId,
//       date: {
//         $gte: start,
//         $lte: end,
//       },
//     })
//       .sort({
//         date: 1,
//       })
//       .lean(),

//     Task.find({
//       assigned_to: userId,

//       $or: [
//         {
//           start_date: {
//             $gte: start,
//             $lte: end,
//           },
//         },
//         {
//           completedAt: {
//             $gte: start,
//             $lte: end,
//           },
//         },
//         {
//           due_date: {
//             $gte: start,
//             $lte: end,
//           },
//         },
//       ],
//     })
//       .populate(
//         "project",
//         "name"
//       )
//       .lean(),
//   ]);

//   // ==========================================================
//   // 1. COMPLETION %
//   // ==========================================================

//   const totalTasks =
//     tasks.length;

//   const completedTasks =
//     tasks.filter(
//       (task) =>
//         task.status === "DONE"
//     );

//   const completedCount =
//     completedTasks.length;

//   const completionPct =
//     pct(
//       completedCount,
//       totalTasks
//     );

//   // ==========================================================
//   // 2 & 3. ON-TIME TASKS
//   // ==========================================================

//   // HIGH
//   const highTasks =
//     tasks.filter(
//       (task) =>
//         task.priority === "HIGH"
//     );

//   const highOnTime =
//     highTasks.filter(
//       (task) =>
//         isOnTime(task)
//     );

//   const priorityOnTimePct =
//     pct(
//       highOnTime.length,
//       highTasks.length
//     );

//   // LOW + MEDIUM
//   const lowMedTasks =
//     tasks.filter(
//       (task) =>
//         task.priority === "LOW" ||
//         task.priority === "MEDIUM"
//     );

//   const lowMedOnTime =
//     lowMedTasks.filter(
//       (task) =>
//         isOnTime(task)
//     );

//   const onTimePct =
//     pct(
//       lowMedOnTime.length,
//       lowMedTasks.length
//     );

//   const hasHighTasks =
//     highTasks.length > 0;

//   const hasLowMedTasks =
//     lowMedTasks.length > 0;

//   let priorityOnTimeWeight =
//     WEIGHTS.priorityOnTime;

//   let onTimeWeight =
//     WEIGHTS.onTime;

//   let priorityOnTimeNote = "";

//   let onTimeNote = "";

//   // Only HIGH tasks
//   if (
//     hasHighTasks &&
//     !hasLowMedTasks
//   ) {
//     priorityOnTimeWeight =
//       ON_TIME_POOL_WEIGHT;

//     onTimeWeight = 0;

//     priorityOnTimeNote =
//       ` (full ${Math.round(
//         ON_TIME_POOL_WEIGHT * 100
//       )}% — no low/medium priority tasks this period)`;
//   }

//   // Only LOW/MEDIUM tasks
//   else if (
//     !hasHighTasks &&
//     hasLowMedTasks
//   ) {
//     onTimeWeight =
//       ON_TIME_POOL_WEIGHT;

//     priorityOnTimeWeight = 0;

//     onTimeNote =
//       ` (full ${Math.round(
//         ON_TIME_POOL_WEIGHT * 100
//       )}% — no high priority tasks this period)`;
//   }

//   // ==========================================================
//   // 4. LOGIN HOURS
//   // ==========================================================

//  const totalLoggedSeconds = attendance.reduce(
//   (sum, record) => {
//     const seconds = attendanceSeconds(record, { live: true });
//     return sum + seconds;
//   },
//   0
// );

//   const workingDays =
//     countWorkingDays(
//       start,
//       end
//     );

//   const expectedSeconds =
//     workingDays *
//     STANDARD_WORKDAY_HOURS *
//     3600;

//   const loginHoursPct =
//     expectedSeconds > 0
//       ? clamp(
//           pct(
//             totalLoggedSeconds,
//             expectedSeconds
//           )
//         )
//       : 0;

//   // ==========================================================
//   // 5. SCHEDULE ADHERENCE
//   // ==========================================================

//   const presentDays =
//     attendance.filter(
//       (record) =>
//         Array.isArray(
//           record.sessions
//         ) &&
//         record.sessions.length > 0
//     );

//   const onTimeLoginDays =
//     presentDays.filter(
//       (record) => {
//         const sortedSessions =
//           [
//             ...record.sessions,
//           ].sort(
//             (a, b) =>
//               new Date(
//                 a.loginTime
//               ).getTime() -
//               new Date(
//                 b.loginTime
//               ).getTime()
//           );

//         const firstSession =
//           sortedSessions[0];

//         if (
//           !firstSession?.loginTime
//         ) {
//           return false;
//         }

//         return isOnTimeLogin(
//           firstSession.loginTime
//         );
//       }
//     );

//   const lateLoginDaysCount =
//     Math.max(
//       0,
//       presentDays.length -
//         onTimeLoginDays.length
//     );

//   const gracedLateDays =
//     Math.min(
//       lateLoginDaysCount,
//       LATE_LOGIN_GRACE_DAYS_PER_MONTH
//     );

//   const effectiveAdherentCount =
//     Math.min(
//       presentDays.length,
//       onTimeLoginDays.length +
//         gracedLateDays
//     );

//   const scheduleAdherencePct =
//     pct(
//       effectiveAdherentCount,
//       presentDays.length
//     );

//   // ==========================================================
//   // 6. PRODUCTIVITY
//   // ==========================================================

//   let inProgressSeconds = 0;

//   for (
//     const task of tasks
//   ) {
//     const sessions =
//       Array.isArray(
//         task.timeSessions
//       )
//         ? task.timeSessions
//         : [];

//     for (
//       const session of sessions
//     ) {
//       if (!session.startedAt) {
//         continue;
//       }

//       const startedAt =
//         new Date(
//           session.startedAt
//         );

//       if (
//         startedAt >= start &&
//         startedAt <= end
//       ) {
//         inProgressSeconds +=
//           Number(
//             session.duration || 0
//           );
//       }
//     }
//   }

//   // Attendance span includes gaps between sessions.
//   // Those gaps therefore become idle/unproductive time.
//   const idleSeconds =
//     Math.max(
//       0,
//       totalLoggedSeconds -
//         inProgressSeconds
//     );

//   const trackedSeconds =
//     inProgressSeconds +
//     idleSeconds;

//   const productivityPct =
//     trackedSeconds > 0
//       ? clamp(
//           pct(
//             inProgressSeconds,
//             trackedSeconds
//           )
//         )
//       : 0;

//   const idlePct =
//     trackedSeconds > 0
//       ? round1(
//           100 -
//             productivityPct
//         )
//       : 0;

//   // ==========================================================
//   // METRICS
//   // ==========================================================

//   const metrics = [
//     // --------------------------------------------------------
//     // COMPLETION
//     // --------------------------------------------------------

//     calculateMetric({
//       key: "completion",

//       label: "Completion %",

//       weight:
//         WEIGHTS.completion,

//       value:
//         completionPct,

//       bands:
//         STANDARD_BANDS,

//       hasData:
//         totalTasks > 0,

//       detail:
//         totalTasks > 0
//           ? `${completedCount}/${totalTasks} tasks completed`
//           : "0/0 tasks completed",
//     }),

//     // --------------------------------------------------------
//     // HIGH PRIORITY ON-TIME
//     // --------------------------------------------------------

//     calculateMetric({
//       key:
//         "priorityOnTime",

//       label:
//         "High Priority On-time %",

//       weight:
//         priorityOnTimeWeight,

//       value:
//         priorityOnTimePct,

//       bands:
//         STANDARD_BANDS,

//       hasData:
//         hasHighTasks,

//       detail:
//         (
//           hasHighTasks
//             ? `${highOnTime.length}/${highTasks.length} high-priority tasks on time`
//             : "No high-priority tasks"
//         ) +
//         priorityOnTimeNote,
//     }),

//     // --------------------------------------------------------
//     // LOW/MEDIUM ON-TIME
//     // --------------------------------------------------------

//     calculateMetric({
//       key: "onTime",

//       label:
//         "Low/Medium On-time %",

//       weight:
//         onTimeWeight,

//       value:
//         onTimePct,

//       bands:
//         STANDARD_BANDS,

//       hasData:
//         hasLowMedTasks,

//       detail:
//         (
//           hasLowMedTasks
//             ? `${lowMedOnTime.length}/${lowMedTasks.length} low/medium-priority tasks on time`
//             : "No low/medium-priority tasks"
//         ) +
//         onTimeNote,
//     }),

//     // --------------------------------------------------------
//     // LOGIN HOURS
//     // --------------------------------------------------------

//     calculateMetric({
//       key: "loginHours",

//       label:
//         "Login Hours",

//       weight:
//         WEIGHTS.loginHours,

//       value:
//         loginHoursPct,

//       bands:
//         HOURS_BANDS,

//       hasData:
//         totalLoggedSeconds > 0 &&
//         expectedSeconds > 0,

//       detail:
//         expectedSeconds > 0
//           ? `${(
//               totalLoggedSeconds /
//               3600
//             ).toFixed(
//               1
//             )}h logged of ${(
//               expectedSeconds /
//               3600
//             ).toFixed(
//               1
//             )}h expected (9h standard)`
//           : "No login hours recorded",
//     }),

//     // --------------------------------------------------------
//     // SCHEDULE ADHERENCE
//     // --------------------------------------------------------

//     calculateMetric({
//       key:
//         "scheduleAdherence",

//       label:
//         "Schedule Adherence %",

//       weight:
//         WEIGHTS.scheduleAdherence,

//       value:
//         scheduleAdherencePct,

//       bands:
//         HOURS_BANDS,

//       hasData:
//         presentDays.length > 0,

//       detail:
//         presentDays.length > 0
//           ? `${effectiveAdherentCount}/${presentDays.length} days before 10:00 AM` +
//             (
//               gracedLateDays > 0
//                 ? ` (${gracedLateDays} late-login grace day applied — ${lateLoginDaysCount} actual late day${
//                     lateLoginDaysCount !==
//                     1
//                       ? "s"
//                       : ""
//                   })`
//                 : ""
//             )
//           : "No attendance recorded",
//     }),

//     // --------------------------------------------------------
//     // PRODUCTIVITY
//     // --------------------------------------------------------

//     calculateMetric({
//       key:
//         "productivity",

//       label:
//         "Productivity %",

//       weight:
//         WEIGHTS.productivity,

//       value:
//         productivityPct,

//       bands:
//         PRODUCTIVITY_BANDS,

//       strict: true,

//       hasData:
//         trackedSeconds > 0,

//       detail:
//         trackedSeconds > 0
//           ? `${Math.round(
//               inProgressSeconds /
//                 60
//             )}m active (${round1(
//               productivityPct
//             )}%) vs ${Math.round(
//               idleSeconds / 60
//             )}m idle (${idlePct}%)`
//           : "No productive time recorded",
//     }),
//   ];

//   // ==========================================================
//   // FINAL SCORE
//   // ==========================================================

//   const finalScore =
//     Math.round(
//       metrics.reduce(
//         (
//           sum,
//           metric
//         ) =>
//           sum +
//           Number(
//             metric.contribution ||
//               0
//           ),
//         0
//       )
//     );

//   // ==========================================================
//   // RATING
//   // ==========================================================

//   let rating;

//   if (finalScore >= 90) {
//     rating = "Excellent";
//   } else if (finalScore >= 75) {
//     rating = "Good";
//   } else if (finalScore >= 60) {
//     rating = "Average";
//   } else {
//     rating =
//       "Needs Improvement";
//   }

//   // ==========================================================
//   // RETURN
//   // ==========================================================

//   return {
//     period: {
//       month:
//         month ?? null,

//       year:
//         year ?? null,

//       start,

//       end,
//     },

//     score:
//       finalScore,

//     rating,

//     metrics,

//     // ========================================================
//     // TOTALS
//     // ========================================================

//     totals: {
//       totalTasks,

//       completedTasks:
//         completedCount,

//       highTasks:
//         highTasks.length,

//       highOnTime:
//         highOnTime.length,

//       lowMedTasks:
//         lowMedTasks.length,

//       lowMedOnTime:
//         lowMedOnTime.length,

//       priorityOnTimeWeightPercent:
//         Math.round(
//           priorityOnTimeWeight *
//             100
//         ),

//       onTimeWeightPercent:
//         Math.round(
//           onTimeWeight * 100
//         ),

//       totalLoggedSeconds,

//       inProgressSeconds,

//       idleSeconds,

//       productivityPercent:
//         round1(
//           productivityPct
//         ),

//       idlePercent:
//         idlePct,

//       workingDays,

//       expectedSeconds,

//       standardWorkdayHours:
//         STANDARD_WORKDAY_HOURS,

//       presentDays:
//         presentDays.length,

//       onTimeLoginDays:
//         onTimeLoginDays.length,

//       lateLoginDays:
//         lateLoginDaysCount,

//       gracedLateDays,

//       effectiveAdherentDays:
//         effectiveAdherentCount,
//     },

//     // ========================================================
//     // RAW DATA
//     // ========================================================

//     raw: {
//       attendance,

//       tasks,

//       totalLoggedSeconds,

//       inProgressSeconds,

//       idleSeconds,

//       productivityPercent:
//         round1(
//           productivityPct
//         ),

//       idlePercent:
//         idlePct,

//       workingDays,

//       expectedSeconds,
//     },
//   };
// }

// // ============================================================
// // EXPORT
// // ============================================================

// module.exports = {
//   computeProductivityScore,

//   attendanceSeconds,

//   closedSessionSeconds,

//   monthRange,

//   countWorkingDays,

//   isSameLocalDay,

//   isOnTimeLogin,

//   getISTHourMinute,

//   WEIGHTS,

//   ON_TIME_POOL_WEIGHT,

//   STANDARD_WORKDAY_HOURS,

//   LATE_LOGIN_GRACE_DAYS_PER_MONTH,

//   MAX_LIVE_SESSION_SECONDS,

//   STANDARD_BANDS,

//   HOURS_BANDS,

//   PRODUCTIVITY_BANDS,
// };

































const Attendance = require("../models/Attendance");
const Task = require("../models/Task");

// ============================================================
// CONFIG
// ============================================================

const STANDARD_WORKDAY_HOURS = 9;
const SCHEDULE_CUTOFF_HOUR = 10;
const LATE_LOGIN_GRACE_DAYS_PER_MONTH = 1;
const MAX_LIVE_SESSION_SECONDS = 16 * 3600;

// Safety cap for a currently-running TASK timer, mirroring
// MAX_LIVE_SESSION_SECONDS used for attendance.
const MAX_LIVE_TASK_SESSION_SECONDS = 16 * 3600;

// ============================================================
// WEIGHTS
// ============================================================

const WEIGHTS = {
  completion: 0.2,
  priorityOnTime: 0.15,
  onTime: 0.1,
  loginHours: 0.15,
  scheduleAdherence: 0.1,
  productivity: 0.3,
};

const ON_TIME_POOL_WEIGHT = WEIGHTS.priorityOnTime + WEIGHTS.onTime;

// ============================================================
// IST TIMEZONE HELPERS
// ============================================================

const IST_OFFSET_MINUTES = 5 * 60 + 30;
const IST_OFFSET_MS = IST_OFFSET_MINUTES * 60 * 1000;

function getISTHourMinute(date) {
  if (!date) return { hours: 0, minutes: 0 };
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return { hours: 0, minutes: 0 };
  const istShifted = new Date(d.getTime() + IST_OFFSET_MS);
  return { hours: istShifted.getUTCHours(), minutes: istShifted.getUTCMinutes() };
}

function isOnTimeLogin(loginTime) {
  if (!loginTime) return false;
  const { hours } = getISTHourMinute(loginTime);
  return hours < SCHEDULE_CUTOFF_HOUR;
}

// ============================================================
// IST DATE HELPERS
// ============================================================

function getISTDateParts(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;
  const shifted = new Date(d.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

function isSameLocalDay(a, b) {
  if (!a || !b) return false;
  const da = getISTDateParts(a);
  const db = getISTDateParts(b);
  if (!da || !db) return false;
  return da.year === db.year && da.month === db.month && da.day === db.day;
}

function startOfDay(date = new Date()) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// ============================================================
// MONTH RANGE
// ============================================================

function monthRange(month, year) {
  const numericMonth = Number(month);
  const numericYear = Number(year);
  const start = new Date(numericYear, numericMonth - 1, 1, 0, 0, 0, 0);
  const end = new Date(numericYear, numericMonth, 0, 23, 59, 59, 999);
  return { start, end };
}

// ============================================================
// WORKING DAYS
// ============================================================

function countWorkingDays(start, end) {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;

  const today = startOfDay();
  const cappedEnd = endDate > today ? today : endDate;
  if (cappedEnd < startDate) return 0;

  let count = 0;
  const cursor = new Date(startDate);
  while (cursor <= cappedEnd) {
    const day = cursor.getDay();
    if (day !== 0) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

// ============================================================
// ATTENDANCE DURATION (unchanged)
// ============================================================

function attendanceSeconds(record, { live = true } = {}) {
  const sessions = Array.isArray(record?.sessions) ? [...record.sessions] : [];
  if (sessions.length === 0) return 0;

  sessions.sort((a, b) => new Date(a?.loginTime).getTime() - new Date(b?.loginTime).getTime());

  const firstCheckIn = sessions.find((session) => session?.loginTime)?.loginTime;
  if (!firstCheckIn) return 0;

  const firstCheckInMs = new Date(firstCheckIn).getTime();
  if (!Number.isFinite(firstCheckInMs)) return 0;

  const latestSession = sessions[sessions.length - 1];
  const latestSessionIsOpen = latestSession && !latestSession.logoutTime;

  const recordDate = record?.date || firstCheckIn;
  const recordIsToday = isSameLocalDay(recordDate, new Date());

  if (live && recordIsToday && latestSessionIsOpen) {
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - firstCheckInMs) / 1000));
    return Math.min(elapsedSeconds, MAX_LIVE_SESSION_SECONDS);
  }

  const closedSessions = sessions.filter((session) => {
    if (!session?.logoutTime) return false;
    const logoutMs = new Date(session.logoutTime).getTime();
    return Number.isFinite(logoutMs);
  });

  if (closedSessions.length === 0) return 0;

  const latestLogout = closedSessions.reduce((latest, current) => {
    const latestMs = new Date(latest.logoutTime).getTime();
    const currentMs = new Date(current.logoutTime).getTime();
    return currentMs > latestMs ? current : latest;
  });

  const lastCheckOutMs = new Date(latestLogout.logoutTime).getTime();
  if (!Number.isFinite(lastCheckOutMs)) return 0;
  if (lastCheckOutMs < firstCheckInMs) return 0;

  return Math.floor((lastCheckOutMs - firstCheckInMs) / 1000);
}

const closedSessionSeconds = attendanceSeconds;

// ============================================================
// SCORE BANDS
// ============================================================

const STANDARD_BANDS = [
  { min: 90, points: 5 },
  { min: 85, points: 4 },
  { min: 80, points: 3 },
  { min: 75, points: 2 },
  { min: -Infinity, points: 1 },
];

const HOURS_BANDS = [
  { min: 95, points: 5 },
  { min: 90, points: 4 },
  { min: 85, points: 3 },
  { min: 80, points: 2 },
  { min: -Infinity, points: 1 },
];

const PRODUCTIVITY_BANDS = [
  { min: 85, points: 5 },
  { min: 80, points: 4 },
  { min: 75, points: 3 },
  { min: 70, points: 2 },
  { min: -Infinity, points: 1 },
];

// ============================================================
// GENERIC HELPERS
// ============================================================

function scoreBand(value, bands, { strict = false } = {}) {
  for (let i = 0; i < bands.length; i++) {
    const { min, points } = bands[i];
    const isTopBand = i === 0;
    const passes = isTopBand && strict ? value > min : value >= min;
    if (passes) return points;
  }
  return bands[bands.length - 1].points;
}

function pct(numerator, denominator) {
  if (!denominator || denominator <= 0) return 0;
  return (numerator / denominator) * 100;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function calculateMetric({ key, label, weight, value, bands, detail, strict = false, hasData = true }) {
  const safeValue = round1(clamp(value));
  const points = !hasData ? 0 : scoreBand(safeValue, bands, { strict });
  const contribution = points === 0 ? 0 : round1((weight * points * 100) / 5);

  return {
    key,
    label,
    weight,
    weightPercent: Math.round(weight * 100),
    value: safeValue,
    points,
    maxPoints: 5,
    contribution,
    detail,
    hasData,
  };
}

// ============================================================
// ON-TIME TASK
// ============================================================

function isOnTime(task) {
  if (task.status !== "DONE" || !task.completedAt) return false;
  if (!task.due_date) return true;
  return new Date(task.completedAt) <= new Date(task.due_date);
}

// ============================================================
// TASK ACTIVE TIME  ←  THE FIX
// ============================================================
//
// BUG THAT WAS HERE BEFORE:
// Active minutes were summed only from tasks returned by the
// completion-metric query, which requires start_date, completedAt,
// or due_date to fall INSIDE the selected period. An ongoing task
// (assigned 09-Sep, due 30-Sep) has none of those dates inside
// "today" (11-Sep), so the task never appeared in that list and its
// timeSessions were never summed — even though the employee had
// genuinely worked on it today.
//
// FIX:
// Active time is now computed from a completely separate query that
// is keyed ONLY on actual timer activity — stopped sessions whose
// `startedAt` falls in [start, end], and/or a currently-running
// timer whose `timerStartedAt` is on/before `end`. It does not care
// what the task's start_date/due_date/assignedTime are.
//
// This also fixes a second bug: a timer that is running RIGHT NOW
// (not yet stopped) previously contributed 0 seconds until the user
// clicked "Stop", because only closed `timeSessions` entries were
// summed. We now add the live elapsed segment too, capped by
// MAX_LIVE_TASK_SESSION_SECONDS as a safety net.
// ============================================================

function taskActiveSecondsInRange(task, start, end, now = new Date()) {
  let seconds = 0;

  const sessions = Array.isArray(task?.timeSessions) ? task.timeSessions : [];

  for (const session of sessions) {
    if (!session?.startedAt) continue;

    const startedAt = new Date(session.startedAt);
    if (Number.isNaN(startedAt.getTime())) continue;

    // Closed session counts if it started inside the period.
    if (startedAt >= start && startedAt <= end) {
      seconds += Number(session.duration || 0);
    }
  }

  // Currently-running timer: count the portion of the live segment
  // that overlaps [start, end].
  if (task?.timerRunning && task?.timerStartedAt) {
    const timerStartedAt = new Date(task.timerStartedAt);

    if (!Number.isNaN(timerStartedAt.getTime()) && timerStartedAt <= end) {
      const segmentStart = timerStartedAt > start ? timerStartedAt : start;
      const segmentEndCandidate = now < end ? now : end;

      if (segmentEndCandidate > segmentStart) {
        const liveSeconds = Math.floor(
          (segmentEndCandidate.getTime() - segmentStart.getTime()) / 1000
        );

        seconds += Math.min(liveSeconds, MAX_LIVE_TASK_SESSION_SECONDS);
      }
    }
  }

  return seconds;
}

/**
 * Finds every task assigned to the user with ANY timer activity
 * overlapping [start, end] — independent of start_date/due_date —
 * and returns total active seconds plus a per-task breakdown
 * (used for the "working today" list in the dashboard/controller).
 */
async function computeTaskActiveTime(userId, start, end, { now = new Date() } = {}) {
  const productivityTasks = await Task.find({
    assigned_to: userId,
    $or: [
      { "timeSessions.startedAt": { $gte: start, $lte: end } },
      { timerRunning: true, timerStartedAt: { $lte: end } },
    ],
  })
    .select(
      "title status priority project timerRunning timerStartedAt timeSessions due_date start_date"
    )
    .populate("project", "name")
    .lean();

  let inProgressSeconds = 0;

  const activeTasks = productivityTasks
    .map((task) => {
      const activeSeconds = taskActiveSecondsInRange(task, start, end, now);
      inProgressSeconds += activeSeconds;

      return {
        _id: task._id,
        title: task.title,
        project: task.project?.name || null,
        priority: task.priority || "LOW",
        status: task.status,
        dueDate: task.due_date || null,
        isLive: Boolean(task.timerRunning),
        activeSeconds,
      };
    })
    // A timer that just started at exactly `end` etc. can round to 0.
    .filter((task) => task.activeSeconds > 0)
    .sort((a, b) => b.activeSeconds - a.activeSeconds);

  return { inProgressSeconds, activeTasks };
}

// ============================================================
// MAIN PRODUCTIVITY CALCULATION
// ============================================================

async function computeProductivityScore(userId, period = {}) {
  const now = new Date();

  let start;
  let end;
  let month = period.month;
  let year = period.year;

  if (period.start && period.end) {
    start = new Date(period.start);
    end = new Date(period.end);
  } else {
    month = Number(period.month) || now.getMonth() + 1;
    year = Number(period.year) || now.getFullYear();
    ({ start, end } = monthRange(month, year));
  }

  // ==========================================================
  // FETCH DATA
  // ==========================================================
  //
  // `tasks` (completion/priority/on-time metrics) is UNCHANGED —
  // still keyed on start_date/completedAt/due_date falling in the
  // period, per requirement #5.
  //
  // `computeTaskActiveTime` is the NEW, independent path used only
  // for the Productivity metric.
  // ==========================================================

  const [attendance, tasks, taskActivity] = await Promise.all([
    Attendance.find({ user: userId, date: { $gte: start, $lte: end } })
      .sort({ date: 1 })
      .lean(),

    Task.find({
      assigned_to: userId,
      $or: [
        { start_date: { $gte: start, $lte: end } },
        { completedAt: { $gte: start, $lte: end } },
        { due_date: { $gte: start, $lte: end } },
      ],
    })
      .populate("project", "name")
      .lean(),

    computeTaskActiveTime(userId, start, end, { now }),
  ]);

  // ==========================================================
  // 1. COMPLETION %
  // ==========================================================

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "DONE");
  const completedCount = completedTasks.length;
  const completionPct = pct(completedCount, totalTasks);

  // ==========================================================
  // 2 & 3. ON-TIME TASKS
  // ==========================================================

  const highTasks = tasks.filter((task) => task.priority === "HIGH");
  const highOnTime = highTasks.filter((task) => isOnTime(task));
  const priorityOnTimePct = pct(highOnTime.length, highTasks.length);

  const lowMedTasks = tasks.filter(
    (task) => task.priority === "LOW" || task.priority === "MEDIUM"
  );
  const lowMedOnTime = lowMedTasks.filter((task) => isOnTime(task));
  const onTimePct = pct(lowMedOnTime.length, lowMedTasks.length);

  const hasHighTasks = highTasks.length > 0;
  const hasLowMedTasks = lowMedTasks.length > 0;

  let priorityOnTimeWeight = WEIGHTS.priorityOnTime;
  let onTimeWeight = WEIGHTS.onTime;
  let priorityOnTimeNote = "";
  let onTimeNote = "";

  if (hasHighTasks && !hasLowMedTasks) {
    priorityOnTimeWeight = ON_TIME_POOL_WEIGHT;
    onTimeWeight = 0;
    priorityOnTimeNote = ` (full ${Math.round(
      ON_TIME_POOL_WEIGHT * 100
    )}% — no low/medium priority tasks this period)`;
  } else if (!hasHighTasks && hasLowMedTasks) {
    onTimeWeight = ON_TIME_POOL_WEIGHT;
    priorityOnTimeWeight = 0;
    onTimeNote = ` (full ${Math.round(
      ON_TIME_POOL_WEIGHT * 100
    )}% — no high priority tasks this period)`;
  }

  // ==========================================================
  // 4. LOGIN HOURS
  // ==========================================================

  const totalLoggedSeconds = attendance.reduce(
    (sum, record) => sum + attendanceSeconds(record, { live: true }),
    0
  );

  const workingDays = countWorkingDays(start, end);
  const expectedSeconds = workingDays * STANDARD_WORKDAY_HOURS * 3600;

  const loginHoursPct =
    expectedSeconds > 0 ? clamp(pct(totalLoggedSeconds, expectedSeconds)) : 0;

  // ==========================================================
  // 5. SCHEDULE ADHERENCE
  // ==========================================================

  const presentDays = attendance.filter(
    (record) => Array.isArray(record.sessions) && record.sessions.length > 0
  );

  const onTimeLoginDays = presentDays.filter((record) => {
    const sortedSessions = [...record.sessions].sort(
      (a, b) => new Date(a.loginTime).getTime() - new Date(b.loginTime).getTime()
    );
    const firstSession = sortedSessions[0];
    if (!firstSession?.loginTime) return false;
    return isOnTimeLogin(firstSession.loginTime);
  });

  const lateLoginDaysCount = Math.max(0, presentDays.length - onTimeLoginDays.length);
  const gracedLateDays = Math.min(lateLoginDaysCount, LATE_LOGIN_GRACE_DAYS_PER_MONTH);

  const effectiveAdherentCount = Math.min(
    presentDays.length,
    onTimeLoginDays.length + gracedLateDays
  );

  const scheduleAdherencePct = pct(effectiveAdherentCount, presentDays.length);

  // ==========================================================
  // 6. PRODUCTIVITY  ←  now uses the independent taskActivity query
  // ==========================================================

  const { inProgressSeconds, activeTasks } = taskActivity;

  // Attendance span includes gaps between sessions.
  // Those gaps therefore become idle/unproductive time.
  const idleSeconds = Math.max(0, totalLoggedSeconds - inProgressSeconds);
  const trackedSeconds = inProgressSeconds + idleSeconds;

  const productivityPct =
    trackedSeconds > 0 ? clamp(pct(inProgressSeconds, trackedSeconds)) : 0;

  const idlePct = trackedSeconds > 0 ? round1(100 - productivityPct) : 0;

  // ==========================================================
  // METRICS
  // ==========================================================

  const metrics = [
    calculateMetric({
      key: "completion",
      label: "Completion %",
      weight: WEIGHTS.completion,
      value: completionPct,
      bands: STANDARD_BANDS,
      hasData: totalTasks > 0,
      detail:
        totalTasks > 0
          ? `${completedCount}/${totalTasks} tasks completed`
          : "0/0 tasks completed",
    }),

    calculateMetric({
      key: "priorityOnTime",
      label: "High Priority On-time %",
      weight: priorityOnTimeWeight,
      value: priorityOnTimePct,
      bands: STANDARD_BANDS,
      hasData: hasHighTasks,
      detail:
        (hasHighTasks
          ? `${highOnTime.length}/${highTasks.length} high-priority tasks on time`
          : "No high-priority tasks") + priorityOnTimeNote,
    }),

    calculateMetric({
      key: "onTime",
      label: "Low/Medium On-time %",
      weight: onTimeWeight,
      value: onTimePct,
      bands: STANDARD_BANDS,
      hasData: hasLowMedTasks,
      detail:
        (hasLowMedTasks
          ? `${lowMedOnTime.length}/${lowMedTasks.length} low/medium-priority tasks on time`
          : "No low/medium-priority tasks") + onTimeNote,
    }),

    calculateMetric({
      key: "loginHours",
      label: "Login Hours",
      weight: WEIGHTS.loginHours,
      value: loginHoursPct,
      bands: HOURS_BANDS,
      hasData: totalLoggedSeconds > 0 && expectedSeconds > 0,
      detail:
        expectedSeconds > 0
          ? `${(totalLoggedSeconds / 3600).toFixed(1)}h logged of ${(
              expectedSeconds / 3600
            ).toFixed(1)}h expected (9h standard)`
          : "No login hours recorded",
    }),

    calculateMetric({
      key: "scheduleAdherence",
      label: "Schedule Adherence %",
      weight: WEIGHTS.scheduleAdherence,
      value: scheduleAdherencePct,
      bands: HOURS_BANDS,
      hasData: presentDays.length > 0,
      detail:
        presentDays.length > 0
          ? `${effectiveAdherentCount}/${presentDays.length} days before 10:00 AM` +
            (gracedLateDays > 0
              ? ` (${gracedLateDays} late-login grace day applied — ${lateLoginDaysCount} actual late day${
                  lateLoginDaysCount !== 1 ? "s" : ""
                })`
              : "")
          : "No attendance recorded",
    }),

    calculateMetric({
      key: "productivity",
      label: "Productivity %",
      weight: WEIGHTS.productivity,
      value: productivityPct,
      bands: PRODUCTIVITY_BANDS,
      strict: true,
      hasData: trackedSeconds > 0,
      detail:
        trackedSeconds > 0
          ? `${Math.round(inProgressSeconds / 60)}m active (${round1(
              productivityPct
            )}%) vs ${Math.round(idleSeconds / 60)}m idle (${idlePct}%)`
          : "No productive time recorded",
    }),
  ];

  // ==========================================================
  // FINAL SCORE
  // ==========================================================

  const finalScore = Math.round(
    metrics.reduce((sum, metric) => sum + Number(metric.contribution || 0), 0)
  );

  let rating;
  if (finalScore >= 90) rating = "Excellent";
  else if (finalScore >= 75) rating = "Good";
  else if (finalScore >= 60) rating = "Average";
  else rating = "Needs Improvement";

  // ==========================================================
  // RETURN
  // ==========================================================

  return {
    period: { month: month ?? null, year: year ?? null, start, end },
    score: finalScore,
    rating,
    metrics,

    totals: {
      totalTasks,
      completedTasks: completedCount,
      highTasks: highTasks.length,
      highOnTime: highOnTime.length,
      lowMedTasks: lowMedTasks.length,
      lowMedOnTime: lowMedOnTime.length,
      priorityOnTimeWeightPercent: Math.round(priorityOnTimeWeight * 100),
      onTimeWeightPercent: Math.round(onTimeWeight * 100),
      totalLoggedSeconds,
      inProgressSeconds,
      idleSeconds,
      productivityPercent: round1(productivityPct),
      idlePercent: idlePct,
      workingDays,
      expectedSeconds,
      standardWorkdayHours: STANDARD_WORKDAY_HOURS,
      presentDays: presentDays.length,
      onTimeLoginDays: onTimeLoginDays.length,
      lateLoginDays: lateLoginDaysCount,
      gracedLateDays,
      effectiveAdherentDays: effectiveAdherentCount,
      // NEW: how many distinct tasks contributed active time this period
      activeTaskCount: activeTasks.length,
    },

    raw: {
      attendance,
      tasks,
      totalLoggedSeconds,
      inProgressSeconds,
      idleSeconds,
      productivityPercent: round1(productivityPct),
      idlePercent: idlePct,
      workingDays,
      expectedSeconds,
      // NEW: per-task active-time breakdown for the period
      activeTasks,
    },
  };
}

// ============================================================
// EXPORT
// ============================================================

module.exports = {
  computeProductivityScore,
  attendanceSeconds,
  closedSessionSeconds,
  monthRange,
  countWorkingDays,
  isSameLocalDay,
  isOnTimeLogin,
  getISTHourMinute,
  WEIGHTS,
  ON_TIME_POOL_WEIGHT,
  STANDARD_WORKDAY_HOURS,
  LATE_LOGIN_GRACE_DAYS_PER_MONTH,
  MAX_LIVE_SESSION_SECONDS,
  STANDARD_BANDS,
  HOURS_BANDS,
  PRODUCTIVITY_BANDS,

  // new exports for the fix
  computeTaskActiveTime,
  taskActiveSecondsInRange,
  MAX_LIVE_TASK_SESSION_SECONDS,
};