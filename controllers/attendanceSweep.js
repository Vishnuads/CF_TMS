// const cron = require("node-cron"); // npm install node-cron
// const Attendance = require("../models/Attendance");

// function startOfDay(d = new Date()) {
//   const x = new Date(d);
//   x.setHours(0, 0, 0, 0);
//   return x;
// }


// async function flagMissingLogouts() {
//   try {
//     const today = startOfDay();

//     const records = await Attendance.find({
//       date: { $lt: today },
//       needsApproval: false,
//     });

//     let flaggedCount = 0;

//     for (const record of records) {
//       const hasOpenSession = (record.sessions || []).some((s) => !s.logoutTime);
//       if (hasOpenSession) {
//         record.needsApproval = true;
//         await record.save();
//         flaggedCount++;
//       }
//     }

//     if (flaggedCount > 0) {
//       console.log(`🚩 Flagged ${flaggedCount} missing-logout attendance record(s)`);
//     }
//   } catch (err) {
//     console.error("flagMissingLogouts error:", err.message);
//   }
// }

// function init() {
//   // 00:05 every day, server-local time
//   cron.schedule("5 0 * * *", flagMissingLogouts);

//   // Also run once on boot, in case the server restarted after the
//   // scheduled time and missed the window for a day.
//   flagMissingLogouts();
// }

// module.exports = { init, flagMissingLogouts };














const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Role = require("../models/Role");

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

async function flagMissingLogouts() {
  try {
    const today = startOfDay();

    // NEW — resolve the set of Admin user IDs once per run, so we can
    // skip them below without a query-per-record N+1 problem.
    const adminRole = await Role.findOne({ name: "ADMIN" }).select("_id");
    const adminUserIds = adminRole
      ? (await User.find({ role: adminRole._id }).select("_id")).map((u) =>
          String(u._id)
        )
      : [];

    const records = await Attendance.find({
      date: { $lt: today },
      needsApproval: false,
    });

    let flaggedCount = 0;

    for (const record of records) {
      // NEW — never flag an admin's attendance record.
      if (adminUserIds.includes(String(record.user))) continue;

      const hasOpenSession = (record.sessions || []).some((s) => !s.logoutTime);
      if (hasOpenSession) {
        record.needsApproval = true;
        await record.save();
        flaggedCount++;
      }
    }

    if (flaggedCount > 0) {
      console.log(`🚩 Flagged ${flaggedCount} missing-logout attendance record(s)`);
    }
  } catch (err) {
    console.error("flagMissingLogouts error:", err.message);
  }
}

function init() {
  cron.schedule("5 0 * * *", flagMissingLogouts);
  flagMissingLogouts();
}

module.exports = { init, flagMissingLogouts };