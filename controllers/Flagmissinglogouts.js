const cron = require("node-cron");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Role = require("../models/Role");
const { closeOrphanedMidSessions } = require("./attendanceCleanup");

// Same fixed-offset approach as attendanceCleanup.js — keep these two
// files' day-boundary logic in sync. If you ever centralize this,
// pull both from one shared util instead of duplicating it.
const TZ_OFFSET_MINUTES = 330; // IST = UTC+5:30

function toBusinessTime(date) {
  return new Date(date.getTime() + TZ_OFFSET_MINUTES * 60 * 1000);
}

function fromBusinessTime(shifted) {
  return new Date(shifted.getTime() - TZ_OFFSET_MINUTES * 60 * 1000);
}

function startOfDay(d = new Date()) {
  const shifted = toBusinessTime(d);
  shifted.setUTCHours(0, 0, 0, 0);
  return fromBusinessTime(shifted);
}

async function flagMissingLogouts() {
  try {
    const today = startOfDay();

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
    let orphanFixedCount = 0;

    for (const record of records) {
      if (adminUserIds.includes(String(record.user))) continue;

      const sessions = record.sessions || [];

      // Heal any earlier orphan first — these shouldn't count toward
      // "missing logout" on their own.
      const orphanFixed = closeOrphanedMidSessions(record, new Date());
      if (orphanFixed) orphanFixedCount++;

      // FIXED — only the LAST session determines whether this is a
      // genuine missing-logout case. Old code used .some(), which
      // meant a single mid-day orphan (already healed above anyway)
      // could flag the whole day even when the person's actual final
      // session of the day closed normally.
      const lastSession = sessions[sessions.length - 1];
      const isTrailingOpen = lastSession && !lastSession.logoutTime;

      if (isTrailingOpen) {
        record.needsApproval = true;
        flaggedCount++;
      }

      if (isTrailingOpen || orphanFixed) {
        record.markModified("sessions");
        await record.save();
      }
    }

    if (flaggedCount > 0) {
      console.log(`🚩 Flagged ${flaggedCount} missing-logout attendance record(s)`);
    }
    if (orphanFixedCount > 0) {
      console.log(`🩹 Healed ${orphanFixedCount} orphaned mid-day session(s) during flag pass`);
    }
  } catch (err) {
    console.error("flagMissingLogouts error:", err.message);
  }
}

function init() {
  // FIXED — explicitly pinned to Asia/Kolkata. Without a `timezone`
  // option, node-cron interprets "5 0 * * *" in the SERVER's local
  // time. If the server runs in UTC, that fires at 00:05 UTC = 5:35 AM
  // IST — nearly 5.5 hours late, which is why sessions were staying
  // "open" for hours into the next morning before finally getting
  // flagged for approval.
  cron.schedule(
    "5 0 * * *",
    flagMissingLogouts,
    { timezone: "Asia/Kolkata" }
  );

  // Also run once on boot, in case the server restarted after the
  // scheduled time and missed the window for a day.
  flagMissingLogouts();
}

module.exports = { init, flagMissingLogouts };