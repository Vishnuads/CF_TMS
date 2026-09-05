





// // const Attendance = require("../models/Attendance");
// // const Task = require("../models/Task");

// // // ============================================================
// // // CONFIG
// // // ============================================================

// // // Office hours: 9:30 AM – 6:30 PM = 9 hours standard workday
// // const STANDARD_WORKDAY_HOURS = 9;

// // // Before 10:00 AM = on time
// // // 10:00 AM or later = late
// // const SCHEDULE_CUTOFF_HOUR = 10;

// // // One late login per month is forgiven — it does not count against
// // // Schedule Adherence. A second (or later) late day in the same month
// // // does count.
// // const LATE_LOGIN_GRACE_DAYS_PER_MONTH = 1;

// // const WEIGHTS = {
// //   completion: 0.2,
// //   priorityOnTime: 0.15, // HIGH priority on-time % (default share)
// //   onTime: 0.1, // LOW + MEDIUM priority on-time % (default share)
// //   loginHours: 0.15,
// //   scheduleAdherence: 0.1,
// //   productivity: 0.3,
// // };

// // // Combined weight pool shared between the HIGH bucket and the
// // // LOW+MEDIUM bucket — always 25% total, however it gets split.
// // const ON_TIME_POOL_WEIGHT = WEIGHTS.priorityOnTime + WEIGHTS.onTime;

// // // ============================================================
// // // DATE HELPERS
// // // ============================================================

// // function startOfDay(date = new Date()) {
// //   const d = new Date(date);

// //   d.setHours(0, 0, 0, 0);

// //   return d;
// // }

// // function monthRange(month, year) {
// //   const start = new Date(year, month - 1, 1, 0, 0, 0, 0);

// //   const end = new Date(year, month, 0, 23, 59, 59, 999);

// //   return {
// //     start,
// //     end,
// //   };
// // }

// // // ============================================================
// // // WORKING DAYS
// // // ============================================================

// // function countWorkingDays(start, end) {
// //   const today = startOfDay();

// //   // Never count future working days
// //   const cappedEnd = end > today ? today : end;

// //   if (cappedEnd < start) {
// //     return 0;
// //   }

// //   let count = 0;

// //   const cursor = new Date(start);

// //   while (cursor <= cappedEnd) {
// //     const day = cursor.getDay();

// //     // Monday to Saturday = working day
// //     if (day !== 0) count++;

// //     cursor.setDate(cursor.getDate() + 1);
// //   }

// //   return count;
// // }

// // // ============================================================
// // // ATTENDANCE DURATION (CLOSED SESSIONS + LIVE OPEN SESSION)
// // // ============================================================
// // //
// // // THE FIX:
// // // Previously this only trusted a session once it had a `logoutTime`,
// // // so an employee who was still logged in contributed ZERO seconds to
// // // totalLoggedSeconds for the whole day — no matter how many hours
// // // they'd actually been logged in. That made idleSeconds collapse to
// // // 0 (since idle = totalLogged - inProgress, and totalLogged was 0),
// // // which in turn made productivityPct = inProgress / (inProgress + 0)
// // // = 100% every time, regardless of how little task-timer activity
// // // there actually was. That's the "4m active, 100%" bug.
// // //
// // // Now: a CLOSED session (has logoutTime) still uses its own stored
// // // `duration` — untouched, unchanged behavior. An OPEN session (no
// // // logoutTime yet — employee is still logged in right now) counts its
// // // elapsed time live, as (now - loginTime), the same way task timers
// // // already compute `currentSessionTime` for a running timer. This
// // // means logged/idle/productivity time updates continuously through
// // // the day instead of freezing at 0 until logout.
// // //
// // // There is still no cap on the upper end: working more than the
// // // 9-hour standard keeps counting fully toward active/idle time. Only
// // // the "Login Hours %" ratio against the 9-hour expectation is clamped
// // // at 100%, which is normal for a percentage metric.
// // // ============================================================

// // function attendanceSeconds(record, { live = true } = {}) {
// //   const sessions = Array.isArray(record.sessions) ? record.sessions : [];
// //   const now = new Date();

// //   return sessions.reduce((sum, session) => {
// //     if (session.logoutTime) {
// //       // Session is closed — trust its own recorded duration.
// //       return sum + Number(session.duration || 0);
// //     }

// //     if (!live || !session.loginTime) {
// //       // Still open and caller explicitly doesn't want live elapsed
// //       // counted (or there's no loginTime to measure from at all).
// //       return sum;
// //     }

// //     // Still open — count elapsed time so far instead of waiting for
// //     // logout.
// //     const loginTime = new Date(session.loginTime);
// //     const elapsed = Math.max(
// //       0,
// //       Math.floor((now.getTime() - loginTime.getTime()) / 1000),
// //     );

// //     return sum + elapsed;
// //   }, 0);
// // }

// // // Kept as an alias so nothing else importing the old name breaks —
// // // it now includes live open-session time by default.
// // const closedSessionSeconds = attendanceSeconds;

// // // ============================================================
// // // SCORE BANDS
// // // ============================================================

// // const STANDARD_BANDS = [
// //   { min: 90, points: 5 },
// //   { min: 85, points: 4 },
// //   { min: 80, points: 3 },
// //   { min: 75, points: 2 },
// //   { min: -Infinity, points: 1 },
// // ];

// // const HOURS_BANDS = [
// //   { min: 95, points: 5 },
// //   { min: 90, points: 4 },
// //   { min: 85, points: 3 },
// //   { min: 80, points: 2 }, 
// //   { min: -Infinity, points: 1 },
// // ];

// // const PRODUCTIVITY_BANDS = [
// //   { min: 85, points: 5 }, // >85
// //   { min: 80, points: 4 },
// //   { min: 75, points: 3 },
// //   { min: 70, points: 2 },
// //   { min: -Infinity, points: 1 },
// // ];

// // // ============================================================
// // // HELPERS
// // // ============================================================

// // function scoreBand(value, bands, { strict = false } = {}) {
// //   for (let i = 0; i < bands.length; i++) {
// //     const { min, points } = bands[i];

// //     const isTopBand = i === 0;

// //     const passes = isTopBand && strict ? value > min : value >= min;

// //     if (passes) {
// //       return points;
// //     }
// //   }

// //   return bands[bands.length - 1].points;
// // }

// // // IMPORTANT:
// // // Empty data = 0, NOT 100.
// // function pct(numerator, denominator) {
// //   if (!denominator || denominator <= 0) {
// //     return 0;
// //   }

// //   return (numerator / denominator) * 100;
// // }

// // function round1(value) {
// //   return Math.round(value * 10) / 10;
// // }

// // function clamp(value, min = 0, max = 100) {
// //   return Math.min(max, Math.max(min, value));
// // }

// // // ============================================================
// // // EMPTY METRIC HANDLER
// // // ============================================================

// // function calculateMetric({
// //   key,
// //   label,
// //   weight,
// //   value,
// //   bands,
// //   detail,
// //   strict = false,
// //   hasData = true,
// // }) {
// //   const safeValue = round1(clamp(value));

// //   // No data = 0 points
// //   const points = !hasData ? 0 : scoreBand(safeValue, bands, { strict });

// //   const contribution = points === 0 ? 0 : round1((weight * points * 100) / 5);

// //   return {
// //     key,
// //     label,
// //     weight,
// //     weightPercent: Math.round(weight * 100),

// //     value: safeValue,

// //     points,

// //     maxPoints: 5,

// //     contribution,

// //     detail,

// //     hasData,
// //   };
// // }

// // // ============================================================
// // // ON-TIME TASK
// // // ============================================================

// // function isOnTime(task) {
// //   if (task.status !== "DONE" || !task.completedAt) {
// //     return false;
// //   }

// //   if (!task.due_date) {
// //     return true;
// //   }

// //   return new Date(task.completedAt) <= new Date(task.due_date);
// // }

// // // ============================================================
// // // MAIN PRODUCTIVITY CALCULATION
// // // ============================================================

// // async function computeProductivityScore(userId, period = {}) {
// //   const now = new Date();

// //   const month = Number(period.month) || now.getMonth() + 1;

// //   const year = Number(period.year) || now.getFullYear();

// //   const { start, end } = monthRange(month, year);

// //   // ==========================================================
// //   // FETCH DATA
// //   // ==========================================================

// //   const [attendance, tasks] = await Promise.all([
// //     Attendance.find({
// //       user: userId,
// //       date: {
// //         $gte: start,
// //         $lte: end,
// //       },
// //     })
// //       .sort({ date: 1 })
// //       .lean(),

// //     Task.find({
// //       assigned_to: userId,

// //       $or: [
// //         { start_date: { $gte: start, $lte: end } },
// //         { completedAt: { $gte: start, $lte: end } },
// //         { due_date: { $gte: start, $lte: end } },
// //       ],
// //     })
// //       .populate("project", "name")
// //       .lean(),
// //   ]);

// //   // ==========================================================
// //   // 1. COMPLETION %
// //   // ==========================================================

// //   const totalTasks = tasks.length;

// //   const completedTasks = tasks.filter((task) => task.status === "DONE");

// //   const completedCount = completedTasks.length;

// //   const completionPct = pct(completedCount, totalTasks);

// //   // ==========================================================
// //   // 2 & 3. HIGH vs LOW/MEDIUM ON-TIME % — WEIGHT REDISTRIBUTION
// //   // ==========================================================

// //   const highTasks = tasks.filter((task) => task.priority === "HIGH");

// //   const highOnTime = highTasks.filter((task) => isOnTime(task));

// //   const priorityOnTimePct = pct(highOnTime.length, highTasks.length);

// //   const lowMedTasks = tasks.filter(
// //     (task) => task.priority === "LOW" || task.priority === "MEDIUM",
// //   );

// //   const lowMedOnTime = lowMedTasks.filter((task) => isOnTime(task));

// //   const onTimePct = pct(lowMedOnTime.length, lowMedTasks.length);

// //   const hasHighTasks = highTasks.length > 0;
// //   const hasLowMedTasks = lowMedTasks.length > 0;

// //   let priorityOnTimeWeight = WEIGHTS.priorityOnTime;
// //   let onTimeWeight = WEIGHTS.onTime;
// //   let priorityOnTimeNote = "";
// //   let onTimeNote = "";

// //   if (hasHighTasks && !hasLowMedTasks) {
// //     priorityOnTimeWeight = ON_TIME_POOL_WEIGHT;
// //     onTimeWeight = 0;
// //     priorityOnTimeNote = ` (full ${Math.round(
// //       ON_TIME_POOL_WEIGHT * 100,
// //     )}% — no low/medium priority tasks this period)`;
// //   } else if (!hasHighTasks && hasLowMedTasks) {
// //     onTimeWeight = ON_TIME_POOL_WEIGHT;
// //     priorityOnTimeWeight = 0;
// //     onTimeNote = ` (full ${Math.round(
// //       ON_TIME_POOL_WEIGHT * 100,
// //     )}% — no high priority tasks this period)`;
// //   }

// //   // ==========================================================
// //   // 4. LOGIN HOURS %
// //   // ==========================================================

// //   const totalLoggedSeconds = attendance.reduce(
// //     (sum, record) => sum + attendanceSeconds(record),
// //     0,
// //   );

// //   const workingDays = countWorkingDays(start, end);

// //   const expectedSeconds = workingDays * STANDARD_WORKDAY_HOURS * 3600;

// //   const loginHoursPct =
// //     expectedSeconds > 0 ? clamp(pct(totalLoggedSeconds, expectedSeconds)) : 0;

// //   // ==========================================================
// //   // 5. SCHEDULE ADHERENCE % — WITH 1 LATE-LOGIN GRACE DAY/MONTH
// //   // ==========================================================

// //   const presentDays = attendance.filter(
// //     (record) => Array.isArray(record.sessions) && record.sessions.length > 0,
// //   );

// //   const onTimeLoginDays = presentDays.filter((record) => {
// //     const sortedSessions = [...record.sessions].sort(
// //       (a, b) => new Date(a.loginTime) - new Date(b.loginTime),
// //     );

// //     const firstSession = sortedSessions[0];

// //     if (!firstSession?.loginTime) {
// //       return false;
// //     }

// //     const loginTime = new Date(firstSession.loginTime);

// //     return loginTime.getHours() < SCHEDULE_CUTOFF_HOUR;
// //   });

// //   const lateLoginDaysCount = presentDays.length - onTimeLoginDays.length;

// //   const gracedLateDays = Math.min(
// //     lateLoginDaysCount,
// //     LATE_LOGIN_GRACE_DAYS_PER_MONTH,
// //   );

// //   const effectiveAdherentCount = Math.min(
// //     presentDays.length,
// //     onTimeLoginDays.length + gracedLateDays,
// //   );

// //   const scheduleAdherencePct = pct(
// //     effectiveAdherentCount,
// //     presentDays.length,
// //   );

// //   // ==========================================================
// //   // 6. PRODUCTIVITY % (+ IDLE %)
// //   // ==========================================================
// //   //
// //   // Active = time spent with a task timer running (from timeSessions).
// //   // Idle   = logged-in time (now including LIVE open sessions, thanks
// //   //          to the fix above) that wasn't spent on any task timer —
// //   //          i.e. logged in, but nothing in progress. This is what
// //   //          was broken: idle used to be stuck at 0 all day because
// //   //          totalLoggedSeconds was 0 until logout.
// //   //
// //   // productivityPct + idlePct always add up to 100% of tracked time,
// //   // and there's no cap on either side beyond that — working (or
// //   // sitting idle) more than 9 hours still counts fully here.
// //   // ==========================================================

// //   let inProgressSeconds = 0;

// //   for (const task of tasks) {
// //     const sessions = Array.isArray(task.timeSessions) ? task.timeSessions : [];

// //     for (const session of sessions) {
// //       if (!session.startedAt) {
// //         continue;
// //       }

// //       const startedAt = new Date(session.startedAt);

// //       if (startedAt >= start && startedAt <= end) {
// //         inProgressSeconds += Number(session.duration || 0);
// //       }
// //     }
// //   }

// //   const idleSeconds = Math.max(0, totalLoggedSeconds - inProgressSeconds);

// //   const trackedSeconds = inProgressSeconds + idleSeconds;

// //   const productivityPct =
// //     trackedSeconds > 0 ? clamp(pct(inProgressSeconds, trackedSeconds)) : 0;

// //   const idlePct = trackedSeconds > 0 ? round1(100 - productivityPct) : 0;

// //   // ==========================================================
// //   // METRICS
// //   // ==========================================================

// //   const metrics = [
// //     calculateMetric({
// //       key: "completion",
// //       label: "Completion %",
// //       weight: WEIGHTS.completion,
// //       value: completionPct,
// //       bands: STANDARD_BANDS,
// //       hasData: totalTasks > 0,
// //       detail:
// //         totalTasks > 0
// //           ? `${completedCount}/${totalTasks} tasks completed`
// //           : "0/0 tasks completed",
// //     }),

// //     calculateMetric({
// //       key: "priorityOnTime",
// //       label: "High Priority On-time %",
// //       weight: priorityOnTimeWeight,
// //       value: priorityOnTimePct,
// //       bands: STANDARD_BANDS,
// //       hasData: hasHighTasks,
// //       detail:
// //         (hasHighTasks
// //           ? `${highOnTime.length}/${highTasks.length} high-priority tasks on time`
// //           : "No high-priority tasks") + priorityOnTimeNote,
// //     }),

// //     calculateMetric({
// //       key: "onTime",
// //       label: "Low/Medium On-time %",
// //       weight: onTimeWeight,
// //       value: onTimePct,
// //       bands: STANDARD_BANDS,
// //       hasData: hasLowMedTasks,
// //       detail:
// //         (hasLowMedTasks
// //           ? `${lowMedOnTime.length}/${lowMedTasks.length} low/medium-priority tasks on time`
// //           : "No low/medium-priority tasks") + onTimeNote,
// //     }),

// //     calculateMetric({
// //       key: "loginHours",
// //       label: "Login Hours",
// //       weight: WEIGHTS.loginHours,
// //       value: loginHoursPct,
// //       bands: HOURS_BANDS,
// //       hasData: totalLoggedSeconds > 0 && expectedSeconds > 0,
// //       detail:
// //         expectedSeconds > 0
// //           ? `${(totalLoggedSeconds / 3600).toFixed(1)}h logged of ${(
// //               expectedSeconds / 3600
// //             ).toFixed(1)}h expected (9h standard)`
// //           : "No login hours recorded",
// //     }),

// //     calculateMetric({
// //       key: "scheduleAdherence",
// //       label: "Schedule Adherence %",
// //       weight: WEIGHTS.scheduleAdherence,
// //       value: scheduleAdherencePct,
// //       bands: HOURS_BANDS,
// //       hasData: presentDays.length > 0,
// //       detail:
// //         presentDays.length > 0
// //           ? `${effectiveAdherentCount}/${presentDays.length} days before 10:00 AM` +
// //             (gracedLateDays > 0
// //               ? ` (${gracedLateDays} late-login grace day applied — ${lateLoginDaysCount} actual late day${
// //                   lateLoginDaysCount !== 1 ? "s" : ""
// //                 })`
// //               : "")
// //           : "No attendance recorded",
// //     }),

// //     calculateMetric({
// //       key: "productivity",
// //       label: "Productivity %",
// //       weight: WEIGHTS.productivity,
// //       value: productivityPct,
// //       bands: PRODUCTIVITY_BANDS,
// //       strict: true,
// //       hasData: trackedSeconds > 0,
// //       detail:
// //         trackedSeconds > 0
// //           ? `${Math.round(inProgressSeconds / 60)}m active (${round1(
// //               productivityPct,
// //             )}%) vs ${Math.round(idleSeconds / 60)}m idle (${idlePct}%)`
// //           : "No productive time recorded",
// //     }),
// //   ];

// //   // ==========================================================
// //   // FINAL SCORE
// //   // ==========================================================

// //   const finalScore = Math.round(
// //     metrics.reduce((sum, metric) => sum + Number(metric.contribution || 0), 0),
// //   );

// //   let rating;

// //   if (finalScore >= 90) {
// //     rating = "Excellent";
// //   } else if (finalScore >= 75) {
// //     rating = "Good";
// //   } else if (finalScore >= 60) {
// //     rating = "Average";
// //   } else {
// //     rating = "Needs Improvement";
// //   }

// //   return {
// //     period: {
// //       month,
// //       year,
// //       start,
// //       end,
// //     },

// //     score: finalScore,

// //     rating,

// //     metrics,

// //     totals: {
// //       totalTasks,
// //       completedTasks: completedCount,

// //       highTasks: highTasks.length,
// //       highOnTime: highOnTime.length,

// //       lowMedTasks: lowMedTasks.length,
// //       lowMedOnTime: lowMedOnTime.length,

// //       priorityOnTimeWeightPercent: Math.round(priorityOnTimeWeight * 100),
// //       onTimeWeightPercent: Math.round(onTimeWeight * 100),

// //       totalLoggedSeconds,
// //       inProgressSeconds,
// //       idleSeconds,

// //       productivityPercent: round1(productivityPct),
// //       idlePercent: idlePct,

// //       workingDays,
// //       expectedSeconds,
// //       standardWorkdayHours: STANDARD_WORKDAY_HOURS,

// //       presentDays: presentDays.length,
// //       onTimeLoginDays: onTimeLoginDays.length,
// //       lateLoginDays: lateLoginDaysCount,
// //       gracedLateDays,
// //       effectiveAdherentDays: effectiveAdherentCount,
// //     },

// //     raw: {
// //       attendance,
// //       tasks,

// //       totalLoggedSeconds,
// //       inProgressSeconds,
// //       idleSeconds,

// //       productivityPercent: round1(productivityPct),
// //       idlePercent: idlePct,

// //       workingDays,
// //       expectedSeconds,
// //     },
// //   };
// // }

// // // ============================================================
// // // EXPORT
// // // ============================================================

// // module.exports = {
// //   computeProductivityScore,

// //   attendanceSeconds,
// //   closedSessionSeconds, // alias — kept for anything importing the old name

// //   WEIGHTS,

// //   ON_TIME_POOL_WEIGHT,

// //   STANDARD_WORKDAY_HOURS,

// //   LATE_LOGIN_GRACE_DAYS_PER_MONTH,

// //   STANDARD_BANDS,

// //   HOURS_BANDS,

// //   PRODUCTIVITY_BANDS,
// // };
























// const Attendance = require("../models/Attendance");
// const Task = require("../models/Task");

// // ============================================================
// // CONFIG
// // ============================================================

// // Office hours: 9:30 AM – 6:30 PM = 9 hours standard workday
// const STANDARD_WORKDAY_HOURS = 9;

// // Before 10:00 AM = on time
// // 10:00 AM or later = late
// const SCHEDULE_CUTOFF_HOUR = 10;

// // One late login per month is forgiven — it does not count against
// // Schedule Adherence. A second (or later) late day in the same period
// // does count. (Applied per-period, whatever the period length is.)
// const LATE_LOGIN_GRACE_DAYS_PER_MONTH = 1;

// const WEIGHTS = {
//   completion: 0.2,
//   priorityOnTime: 0.15, // HIGH priority on-time % (default share)
//   onTime: 0.1, // LOW + MEDIUM priority on-time % (default share)
//   loginHours: 0.15,
//   scheduleAdherence: 0.1,
//   productivity: 0.3,
// };

// // Combined weight pool shared between the HIGH bucket and the
// // LOW+MEDIUM bucket — always 25% total, however it gets split.
// const ON_TIME_POOL_WEIGHT = WEIGHTS.priorityOnTime + WEIGHTS.onTime;

// // ============================================================
// // DATE HELPERS
// // ============================================================

// function startOfDay(date = new Date()) {
//   const d = new Date(date);

//   d.setHours(0, 0, 0, 0);

//   return d;
// }

// // Kept for any other caller that still passes { month, year } instead
// // of an explicit { start, end } range.
// function monthRange(month, year) {
//   const start = new Date(year, month - 1, 1, 0, 0, 0, 0);

//   const end = new Date(year, month, 0, 23, 59, 59, 999);

//   return {
//     start,
//     end,
//   };
// }

// // ============================================================
// // WORKING DAYS
// // ============================================================
// //
// // Generic over any [start, end] range — a single day, a week, a
// // month, or a full year all just fall out of the same loop. This is
// // what lets daily/weekly/yearly views compute a meaningful "expected
// // hours" figure without any granularity-specific branching.
// // ============================================================

// function countWorkingDays(start, end) {
//   const today = startOfDay();

//   // Never count future working days
//   const cappedEnd = end > today ? today : end;

//   if (cappedEnd < start) {
//     return 0;
//   }

//   let count = 0;

//   const cursor = new Date(start);

//   while (cursor <= cappedEnd) {
//     const day = cursor.getDay();

//     // Monday to Saturday = working day
//     if (day !== 0) count++;

//     cursor.setDate(cursor.getDate() + 1);
//   }

//   return count;
// }

// // ============================================================
// // ATTENDANCE DURATION (CLOSED SESSIONS + LIVE OPEN SESSION)
// // ============================================================

// function attendanceSeconds(record, { live = true } = {}) {
//   const sessions = Array.isArray(record.sessions) ? record.sessions : [];
//   const now = new Date();

//   return sessions.reduce((sum, session) => {
//     if (session.logoutTime) {
//       // Session is closed — trust its own recorded duration.
//       return sum + Number(session.duration || 0);
//     }

//     if (!live || !session.loginTime) {
//       return sum;
//     }

//     // Still open — count elapsed time so far instead of waiting for
//     // logout.
//     const loginTime = new Date(session.loginTime);
//     const elapsed = Math.max(
//       0,
//       Math.floor((now.getTime() - loginTime.getTime()) / 1000),
//     );

//     return sum + elapsed;
//   }, 0);
// }

// // Kept as an alias so nothing else importing the old name breaks.
// const closedSessionSeconds = attendanceSeconds;

// // ============================================================
// // SCORE BANDS
// // ============================================================

// const STANDARD_BANDS = [
//   { min: 90, points: 5 },
//   { min: 85, points: 4 },
//   { min: 80, points: 3 },
//   { min: 75, points: 2 },
//   { min: -Infinity, points: 1 },
// ];

// const HOURS_BANDS = [
//   { min: 95, points: 5 },
//   { min: 90, points: 4 },
//   { min: 85, points: 3 },
//   { min: 80, points: 2 },
//   { min: -Infinity, points: 1 },
// ];

// const PRODUCTIVITY_BANDS = [
//   { min: 85, points: 5 }, // >85
//   { min: 80, points: 4 },
//   { min: 75, points: 3 },
//   { min: 70, points: 2 },
//   { min: -Infinity, points: 1 },
// ];

// // ============================================================
// // HELPERS
// // ============================================================

// function scoreBand(value, bands, { strict = false } = {}) {
//   for (let i = 0; i < bands.length; i++) {
//     const { min, points } = bands[i];

//     const isTopBand = i === 0;

//     const passes = isTopBand && strict ? value > min : value >= min;

//     if (passes) {
//       return points;
//     }
//   }

//   return bands[bands.length - 1].points;
// }

// // IMPORTANT:
// // Empty data = 0, NOT 100.
// function pct(numerator, denominator) {
//   if (!denominator || denominator <= 0) {
//     return 0;
//   }

//   return (numerator / denominator) * 100;
// }

// function round1(value) {
//   return Math.round(value * 10) / 10;
// }

// function clamp(value, min = 0, max = 100) {
//   return Math.min(max, Math.max(min, value));
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
//   const safeValue = round1(clamp(value));

//   // No data = 0 points
//   const points = !hasData ? 0 : scoreBand(safeValue, bands, { strict });

//   const contribution = points === 0 ? 0 : round1((weight * points * 100) / 5);

//   return {
//     key,
//     label,
//     weight,
//     weightPercent: Math.round(weight * 100),

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
//   if (task.status !== "DONE" || !task.completedAt) {
//     return false;
//   }

//   if (!task.due_date) {
//     return true;
//   }

//   return new Date(task.completedAt) <= new Date(task.due_date);
// }

// // ============================================================
// // MAIN PRODUCTIVITY CALCULATION
// // ============================================================
// //
// // Accepts EITHER:
// //   { start, end }              — an explicit date range (daily,
// //                                  weekly, yearly, or anything else
// //                                  the caller wants to resolve)
// //   { month, year }              — legacy calendar-month shorthand,
// //                                  kept for backward compatibility
// //
// // `month`/`year` may still be passed alongside `start`/`end` purely
// // as metadata to echo back in the response — they don't affect the
// // calculation once `start`/`end` are given.
// // ============================================================

// async function computeProductivityScore(userId, period = {}) {
//   const now = new Date();

//   let start;
//   let end;
//   let month = period.month;
//   let year = period.year;

//   if (period.start && period.end) {
//     start = new Date(period.start);
//     end = new Date(period.end);
//   } else {
//     month = Number(period.month) || now.getMonth() + 1;
//     year = Number(period.year) || now.getFullYear();

//     ({ start, end } = monthRange(month, year));
//   }

//   // ==========================================================
//   // FETCH DATA
//   // ==========================================================

//   const [attendance, tasks] = await Promise.all([
//     Attendance.find({
//       user: userId,
//       date: {
//         $gte: start,
//         $lte: end,
//       },
//     })
//       .sort({ date: 1 })
//       .lean(),

//     Task.find({
//       assigned_to: userId,

//       $or: [
//         { start_date: { $gte: start, $lte: end } },
//         { completedAt: { $gte: start, $lte: end } },
//         { due_date: { $gte: start, $lte: end } },
//       ],
//     })
//       .populate("project", "name")
//       .lean(),
//   ]);

//   // ==========================================================
//   // 1. COMPLETION %
//   // ==========================================================

//   const totalTasks = tasks.length;

//   const completedTasks = tasks.filter((task) => task.status === "DONE");

//   const completedCount = completedTasks.length;

//   const completionPct = pct(completedCount, totalTasks);

//   // ==========================================================
//   // 2 & 3. HIGH vs LOW/MEDIUM ON-TIME % — WEIGHT REDISTRIBUTION
//   // ==========================================================

//   const highTasks = tasks.filter((task) => task.priority === "HIGH");

//   const highOnTime = highTasks.filter((task) => isOnTime(task));

//   const priorityOnTimePct = pct(highOnTime.length, highTasks.length);

//   const lowMedTasks = tasks.filter(
//     (task) => task.priority === "LOW" || task.priority === "MEDIUM",
//   );

//   const lowMedOnTime = lowMedTasks.filter((task) => isOnTime(task));

//   const onTimePct = pct(lowMedOnTime.length, lowMedTasks.length);

//   const hasHighTasks = highTasks.length > 0;
//   const hasLowMedTasks = lowMedTasks.length > 0;

//   let priorityOnTimeWeight = WEIGHTS.priorityOnTime;
//   let onTimeWeight = WEIGHTS.onTime;
//   let priorityOnTimeNote = "";
//   let onTimeNote = "";

//   if (hasHighTasks && !hasLowMedTasks) {
//     priorityOnTimeWeight = ON_TIME_POOL_WEIGHT;
//     onTimeWeight = 0;
//     priorityOnTimeNote = ` (full ${Math.round(
//       ON_TIME_POOL_WEIGHT * 100,
//     )}% — no low/medium priority tasks this period)`;
//   } else if (!hasHighTasks && hasLowMedTasks) {
//     onTimeWeight = ON_TIME_POOL_WEIGHT;
//     priorityOnTimeWeight = 0;
//     onTimeNote = ` (full ${Math.round(
//       ON_TIME_POOL_WEIGHT * 100,
//     )}% — no high priority tasks this period)`;
//   }

//   // ==========================================================
//   // 4. LOGIN HOURS %
//   // ==========================================================

//   const totalLoggedSeconds = attendance.reduce(
//     (sum, record) => sum + attendanceSeconds(record),
//     0,
//   );

//   const workingDays = countWorkingDays(start, end);

//   const expectedSeconds = workingDays * STANDARD_WORKDAY_HOURS * 3600;

//   const loginHoursPct =
//     expectedSeconds > 0 ? clamp(pct(totalLoggedSeconds, expectedSeconds)) : 0;

//   // ==========================================================
//   // 5. SCHEDULE ADHERENCE % — WITH 1 LATE-LOGIN GRACE DAY/PERIOD
//   // ==========================================================

//   const presentDays = attendance.filter(
//     (record) => Array.isArray(record.sessions) && record.sessions.length > 0,
//   );

//   const onTimeLoginDays = presentDays.filter((record) => {
//     const sortedSessions = [...record.sessions].sort(
//       (a, b) => new Date(a.loginTime) - new Date(b.loginTime),
//     );

//     const firstSession = sortedSessions[0];

//     if (!firstSession?.loginTime) {
//       return false;
//     }

//     const loginTime = new Date(firstSession.loginTime);

//     return loginTime.getHours() < SCHEDULE_CUTOFF_HOUR;
//   });

//   const lateLoginDaysCount = presentDays.length - onTimeLoginDays.length;

//   const gracedLateDays = Math.min(
//     lateLoginDaysCount,
//     LATE_LOGIN_GRACE_DAYS_PER_MONTH,
//   );

//   const effectiveAdherentCount = Math.min(
//     presentDays.length,
//     onTimeLoginDays.length + gracedLateDays,
//   );

//   const scheduleAdherencePct = pct(
//     effectiveAdherentCount,
//     presentDays.length,
//   );

//   // ==========================================================
//   // 6. PRODUCTIVITY % (+ IDLE %)
//   // ==========================================================

//   let inProgressSeconds = 0;

//   for (const task of tasks) {
//     const sessions = Array.isArray(task.timeSessions) ? task.timeSessions : [];

//     for (const session of sessions) {
//       if (!session.startedAt) {
//         continue;
//       }

//       const startedAt = new Date(session.startedAt);

//       if (startedAt >= start && startedAt <= end) {
//         inProgressSeconds += Number(session.duration || 0);
//       }
//     }
//   }

//   const idleSeconds = Math.max(0, totalLoggedSeconds - inProgressSeconds);

//   const trackedSeconds = inProgressSeconds + idleSeconds;

//   const productivityPct =
//     trackedSeconds > 0 ? clamp(pct(inProgressSeconds, trackedSeconds)) : 0;

//   const idlePct = trackedSeconds > 0 ? round1(100 - productivityPct) : 0;

//   // ==========================================================
//   // METRICS
//   // ==========================================================

//   const metrics = [
//     calculateMetric({
//       key: "completion",
//       label: "Completion %",
//       weight: WEIGHTS.completion,
//       value: completionPct,
//       bands: STANDARD_BANDS,
//       hasData: totalTasks > 0,
//       detail:
//         totalTasks > 0
//           ? `${completedCount}/${totalTasks} tasks completed`
//           : "0/0 tasks completed",
//     }),

//     calculateMetric({
//       key: "priorityOnTime",
//       label: "High Priority On-time %",
//       weight: priorityOnTimeWeight,
//       value: priorityOnTimePct,
//       bands: STANDARD_BANDS,
//       hasData: hasHighTasks,
//       detail:
//         (hasHighTasks
//           ? `${highOnTime.length}/${highTasks.length} high-priority tasks on time`
//           : "No high-priority tasks") + priorityOnTimeNote,
//     }),

//     calculateMetric({
//       key: "onTime",
//       label: "Low/Medium On-time %",
//       weight: onTimeWeight,
//       value: onTimePct,
//       bands: STANDARD_BANDS,
//       hasData: hasLowMedTasks,
//       detail:
//         (hasLowMedTasks
//           ? `${lowMedOnTime.length}/${lowMedTasks.length} low/medium-priority tasks on time`
//           : "No low/medium-priority tasks") + onTimeNote,
//     }),

//     calculateMetric({
//       key: "loginHours",
//       label: "Login Hours",
//       weight: WEIGHTS.loginHours,
//       value: loginHoursPct,
//       bands: HOURS_BANDS,
//       hasData: totalLoggedSeconds > 0 && expectedSeconds > 0,
//       detail:
//         expectedSeconds > 0
//           ? `${(totalLoggedSeconds / 3600).toFixed(1)}h logged of ${(
//               expectedSeconds / 3600
//             ).toFixed(1)}h expected (9h standard)`
//           : "No login hours recorded",
//     }),

//     calculateMetric({
//       key: "scheduleAdherence",
//       label: "Schedule Adherence %",
//       weight: WEIGHTS.scheduleAdherence,
//       value: scheduleAdherencePct,
//       bands: HOURS_BANDS,
//       hasData: presentDays.length > 0,
//       detail:
//         presentDays.length > 0
//           ? `${effectiveAdherentCount}/${presentDays.length} days before 10:00 AM` +
//             (gracedLateDays > 0
//               ? ` (${gracedLateDays} late-login grace day applied — ${lateLoginDaysCount} actual late day${
//                   lateLoginDaysCount !== 1 ? "s" : ""
//                 })`
//               : "")
//           : "No attendance recorded",
//     }),

//     calculateMetric({
//       key: "productivity",
//       label: "Productivity %",
//       weight: WEIGHTS.productivity,
//       value: productivityPct,
//       bands: PRODUCTIVITY_BANDS,
//       strict: true,
//       hasData: trackedSeconds > 0,
//       detail:
//         trackedSeconds > 0
//           ? `${Math.round(inProgressSeconds / 60)}m active (${round1(
//               productivityPct,
//             )}%) vs ${Math.round(idleSeconds / 60)}m idle (${idlePct}%)`
//           : "No productive time recorded",
//     }),
//   ];

//   // ==========================================================
//   // FINAL SCORE
//   // ==========================================================

//   const finalScore = Math.round(
//     metrics.reduce((sum, metric) => sum + Number(metric.contribution || 0), 0),
//   );

//   let rating;

//   if (finalScore >= 90) {
//     rating = "Excellent";
//   } else if (finalScore >= 75) {
//     rating = "Good";
//   } else if (finalScore >= 60) {
//     rating = "Average";
//   } else {
//     rating = "Needs Improvement";
//   }

//   return {
//     period: {
//       month: month ?? null,
//       year: year ?? null,
//       start,
//       end,
//     },

//     score: finalScore,

//     rating,

//     metrics,

//     totals: {
//       totalTasks,
//       completedTasks: completedCount,

//       highTasks: highTasks.length,
//       highOnTime: highOnTime.length,

//       lowMedTasks: lowMedTasks.length,
//       lowMedOnTime: lowMedOnTime.length,

//       priorityOnTimeWeightPercent: Math.round(priorityOnTimeWeight * 100),
//       onTimeWeightPercent: Math.round(onTimeWeight * 100),

//       totalLoggedSeconds,
//       inProgressSeconds,
//       idleSeconds,

//       productivityPercent: round1(productivityPct),
//       idlePercent: idlePct,

//       workingDays,
//       expectedSeconds,
//       standardWorkdayHours: STANDARD_WORKDAY_HOURS,

//       presentDays: presentDays.length,
//       onTimeLoginDays: onTimeLoginDays.length,
//       lateLoginDays: lateLoginDaysCount,
//       gracedLateDays,
//       effectiveAdherentDays: effectiveAdherentCount,
//     },

//     raw: {
//       attendance,
//       tasks,

//       totalLoggedSeconds,
//       inProgressSeconds,
//       idleSeconds,

//       productivityPercent: round1(productivityPct),
//       idlePercent: idlePct,

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
//   closedSessionSeconds, // alias — kept for anything importing the old name

//   monthRange,
//   countWorkingDays,

//   WEIGHTS,

//   ON_TIME_POOL_WEIGHT,

//   STANDARD_WORKDAY_HOURS,

//   LATE_LOGIN_GRACE_DAYS_PER_MONTH,

//   STANDARD_BANDS,

//   HOURS_BANDS,

//   PRODUCTIVITY_BANDS,
// };































const Attendance = require("../models/Attendance");
const Task = require("../models/Task");

// ============================================================
// CONFIG
// ============================================================

// Office hours: 9:30 AM – 6:30 PM = 9 hours standard workday
const STANDARD_WORKDAY_HOURS = 9;

// Before 10:00 AM = on time
// 10:00 AM or later = late
const SCHEDULE_CUTOFF_HOUR = 10;

// One late login per month is forgiven — it does not count against
// Schedule Adherence. A second (or later) late day in the same period
// does count. (Applied per-period, whatever the period length is.)
const LATE_LOGIN_GRACE_DAYS_PER_MONTH = 1;

// Safety cap on how long a single "live" (still open, not yet logged
// out) session is allowed to accrue elapsed time for, in seconds.
// This guards against a session that SHOULD have been closed (by a
// clean logout, the tab-close beacon, or the daily sweep job) but
// wasn't, from silently growing forever every time a report is
// generated. 16h comfortably covers a very long single day without
// letting a multi-day-stale session explode the number.
const MAX_LIVE_SESSION_SECONDS = 16 * 3600;

const WEIGHTS = {
  completion: 0.2,
  priorityOnTime: 0.15, // HIGH priority on-time % (default share)
  onTime: 0.1, // LOW + MEDIUM priority on-time % (default share)
  loginHours: 0.15,
  scheduleAdherence: 0.1,
  productivity: 0.3,
};

// Combined weight pool shared between the HIGH bucket and the
// LOW+MEDIUM bucket — always 25% total, however it gets split.
const ON_TIME_POOL_WEIGHT = WEIGHTS.priorityOnTime + WEIGHTS.onTime;

// ============================================================
// DATE HELPERS
// ============================================================

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameLocalDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

// Kept for any other caller that still passes { month, year } instead
// of an explicit { start, end } range.
function monthRange(month, year) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

// ============================================================
// WORKING DAYS
// ============================================================

function countWorkingDays(start, end) {
  const today = startOfDay();

  // Never count future working days
  const cappedEnd = end > today ? today : end;

  if (cappedEnd < start) {
    return 0;
  }

  let count = 0;
  const cursor = new Date(start);

  while (cursor <= cappedEnd) {
    const day = cursor.getDay();

    // Monday to Saturday = working day
    if (day !== 0) count++;

    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

// ============================================================
// ATTENDANCE DURATION (CLOSED SESSIONS + LIVE OPEN SESSION)
// ============================================================
//
// THE BUG THIS FIXES:
// Previously, ANY session without a `logoutTime` — on ANY day's
// record, no matter how old — was treated as "still live" and had
// `(now - loginTime)` added to its duration. If a session was left
// open because the tab/system died without a clean close (no
// beforeunload beacon fired, connection dropped, machine slept or
// force-shut-down), that session never got a logoutTime. Every time
// a productivity report was generated afterwards — even days later,
// even after the person had already checked in again for a brand new
// day — that stale session kept computing "now minus its original
// login time" and adding it to that PAST day's total. That's how a
// single day could show 115h: the "open" session from days ago was
// still being measured against today's `now`.
//
// THE FIX:
// A session may only accrue LIVE elapsed time if BOTH of these hold:
//   1. It belongs to TODAY's attendance record (not a past day).
//   2. It is the MOST RECENTLY STARTED session on that record that is
//      still open (guards against duplicate/overlapping open sessions
//      caused by a re-check-in race — only the newest one is "the"
//      current session; any earlier "still open" session is stale and
//      must not also be extended to `now`).
//
// Any other open session (past-day record, or an older duplicate on
// today's record) contributes only its recorded `duration` field
// (0 if none was ever recorded) — it does NOT get extended to `now`.
// On top of that, even a legitimately live session's elapsed time is
// capped at MAX_LIVE_SESSION_SECONDS as a last line of defense.
// ============================================================

function attendanceSeconds(record, { live = true } = {}) {
  const sessions = Array.isArray(record.sessions) ? [...record.sessions] : [];
  if (sessions.length === 0) return 0;

  const now = new Date();
  const recordIsToday = isSameLocalDay(record.date || now, now);

  // Sort ascending by login time so "most recently started" is simply
  // the last element among the still-open ones.
  const ordered = sessions
    .map((session, originalIndex) => ({ session, originalIndex }))
    .sort(
      (a, b) => new Date(a.session.loginTime) - new Date(b.session.loginTime),
    );

  let lastOpenPos = -1;
  for (let i = ordered.length - 1; i >= 0; i--) {
    if (!ordered[i].session.logoutTime) {
      lastOpenPos = i;
      break;
    }
  }

  return ordered.reduce((sum, { session }, pos) => {
    if (session.logoutTime) {
      // Closed session — trust its own recorded duration, unchanged.
      return sum + Number(session.duration || 0);
    }

    // Open session (no logoutTime yet).
    if (!live || !session.loginTime) {
      return sum + Number(session.duration || 0);
    }

    const isTheCurrentLiveSession = recordIsToday && pos === lastOpenPos;

    if (!isTheCurrentLiveSession) {
      // Stale or duplicate open session (past day, or an older
      // overlapping session on today's record). Do NOT extend this
      // to `now` — only count whatever was actually recorded.
      return sum + Number(session.duration || 0);
    }

    const loginTime = new Date(session.loginTime);
    const elapsed = Math.max(
      0,
      Math.floor((now.getTime() - loginTime.getTime()) / 1000),
    );

    return sum + Math.min(elapsed, MAX_LIVE_SESSION_SECONDS);
  }, 0);
}

// Kept as an alias so nothing else importing the old name breaks.
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
// HELPERS
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

// ============================================================
// EMPTY METRIC HANDLER
// ============================================================

function calculateMetric({
  key,
  label,
  weight,
  value,
  bands,
  detail,
  strict = false,
  hasData = true,
}) {
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

  const [attendance, tasks] = await Promise.all([
    Attendance.find({
      user: userId,
      date: { $gte: start, $lte: end },
    })
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
  ]);

  // ==========================================================
  // 1. COMPLETION %
  // ==========================================================

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "DONE");
  const completedCount = completedTasks.length;
  const completionPct = pct(completedCount, totalTasks);

  // ==========================================================
  // 2 & 3. HIGH vs LOW/MEDIUM ON-TIME % — WEIGHT REDISTRIBUTION
  // ==========================================================

  const highTasks = tasks.filter((task) => task.priority === "HIGH");
  const highOnTime = highTasks.filter((task) => isOnTime(task));
  const priorityOnTimePct = pct(highOnTime.length, highTasks.length);

  const lowMedTasks = tasks.filter(
    (task) => task.priority === "LOW" || task.priority === "MEDIUM",
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
      ON_TIME_POOL_WEIGHT * 100,
    )}% — no low/medium priority tasks this period)`;
  } else if (!hasHighTasks && hasLowMedTasks) {
    onTimeWeight = ON_TIME_POOL_WEIGHT;
    priorityOnTimeWeight = 0;
    onTimeNote = ` (full ${Math.round(
      ON_TIME_POOL_WEIGHT * 100,
    )}% — no high priority tasks this period)`;
  }

  // ==========================================================
  // 4. LOGIN HOURS %
  // ==========================================================

  const totalLoggedSeconds = attendance.reduce(
    (sum, record) => sum + attendanceSeconds(record),
    0,
  );

  const workingDays = countWorkingDays(start, end);
  const expectedSeconds = workingDays * STANDARD_WORKDAY_HOURS * 3600;

  const loginHoursPct =
    expectedSeconds > 0 ? clamp(pct(totalLoggedSeconds, expectedSeconds)) : 0;

  // ==========================================================
  // 5. SCHEDULE ADHERENCE % — WITH 1 LATE-LOGIN GRACE DAY/PERIOD
  // ==========================================================

  const presentDays = attendance.filter(
    (record) => Array.isArray(record.sessions) && record.sessions.length > 0,
  );

  const onTimeLoginDays = presentDays.filter((record) => {
    const sortedSessions = [...record.sessions].sort(
      (a, b) => new Date(a.loginTime) - new Date(b.loginTime),
    );
    const firstSession = sortedSessions[0];
    if (!firstSession?.loginTime) return false;
    const loginTime = new Date(firstSession.loginTime);
    return loginTime.getHours() < SCHEDULE_CUTOFF_HOUR;
  });

  const lateLoginDaysCount = presentDays.length - onTimeLoginDays.length;

  const gracedLateDays = Math.min(
    lateLoginDaysCount,
    LATE_LOGIN_GRACE_DAYS_PER_MONTH,
  );

  const effectiveAdherentCount = Math.min(
    presentDays.length,
    onTimeLoginDays.length + gracedLateDays,
  );

  const scheduleAdherencePct = pct(effectiveAdherentCount, presentDays.length);

  // ==========================================================
  // 6. PRODUCTIVITY % (+ IDLE %)
  // ==========================================================

  let inProgressSeconds = 0;

  for (const task of tasks) {
    const sessions = Array.isArray(task.timeSessions) ? task.timeSessions : [];
    for (const session of sessions) {
      if (!session.startedAt) continue;
      const startedAt = new Date(session.startedAt);
      if (startedAt >= start && startedAt <= end) {
        inProgressSeconds += Number(session.duration || 0);
      }
    }
  }

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
              productivityPct,
            )}%) vs ${Math.round(idleSeconds / 60)}m idle (${idlePct}%)`
          : "No productive time recorded",
    }),
  ];

  // ==========================================================
  // FINAL SCORE
  // ==========================================================

  const finalScore = Math.round(
    metrics.reduce((sum, metric) => sum + Number(metric.contribution || 0), 0),
  );

  let rating;
  if (finalScore >= 90) rating = "Excellent";
  else if (finalScore >= 75) rating = "Good";
  else if (finalScore >= 60) rating = "Average";
  else rating = "Needs Improvement";

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

  WEIGHTS,
  ON_TIME_POOL_WEIGHT,
  STANDARD_WORKDAY_HOURS,
  LATE_LOGIN_GRACE_DAYS_PER_MONTH,
  MAX_LIVE_SESSION_SECONDS,

  STANDARD_BANDS,
  HOURS_BANDS,
  PRODUCTIVITY_BANDS,
};