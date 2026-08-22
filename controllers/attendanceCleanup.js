const Attendance = require("../models/Attendance");
const socket = require("../socket");

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function broadcastCheckin(userId, name, loginTime) {
  try {
    const io = socket.getIO();
    const payload = { userId, name, loginTime };
    io.to("admin").emit("attendance-checkin", payload);
    io.emit("attendance-checkin", payload);
  } catch (err) {
    console.error("Socket emit (checkin) failed:", err.message);
  }
}

function broadcastCheckout(userId, logoutTime, sessionDuration, totalDuration, reason) {
  try {
    const io = socket.getIO();
    const payload = { userId, logoutTime, sessionDuration, totalDuration, reason };
    io.to("admin").emit("attendance-checkout", payload);
    io.emit("attendance-checkout", payload);
  } catch (err) {
    console.error("Socket emit (checkout) failed:", err.message);
  }
}

/**
 * Closes out any open session on a day BEFORE today for this user.
 * Runs on every check-in — covers "closed the tab days ago and just came
 * back" without waiting for the hourly sweep.
 */
async function closeStaleOpenSessions(userId) {
  const today = startOfDay();

  const staleDocs = await Attendance.find({
    user: userId,
    date: { $lt: today },
    logoutTime: null,
  });

  for (const doc of staleDocs) {
    let changed = false;

    for (const session of doc.sessions) {
      if (!session.logoutTime) {
        const endOfThatDay = new Date(doc.date);
        endOfThatDay.setHours(23, 59, 59, 999);

        const duration = Math.max(0, Math.floor((endOfThatDay - session.loginTime) / 1000));
        session.logoutTime = endOfThatDay;
        session.duration = duration;
        session.autoClosed = true;
        session.closeReason = "daily-sweep";

        doc.totalDuration += duration;
        changed = true;
      }
    }

    if (changed) {
      doc.logoutTime = doc.logoutTime || new Date(doc.date).setHours(23, 59, 59, 999);
      await doc.save();
    }
  }
}

/**
 * Closes a user's currently-open session using the REAL current time.
 * Called on: beacon (tab close), confirmed socket disconnect, or manual
 * logout. Race-safe — if nothing's open, this is a harmless no-op.
 */
async function closeOpenSessionNow(userId, reason = "manual") {
  const today = startOfDay();
  const attendance = await Attendance.findOne({ user: userId, date: today });
  if (!attendance) return null;

  const now = new Date();
  let openSession = null;

  for (let i = attendance.sessions.length - 1; i >= 0; i--) {
    if (!attendance.sessions[i].logoutTime) {
      openSession = attendance.sessions[i];
      break;
    }
  }

  if (!openSession) return attendance; // already closed — nothing to do

  const duration = Math.max(0, Math.floor((now - openSession.loginTime) / 1000));
  openSession.logoutTime = now;
  openSession.duration = duration;
  openSession.autoClosed = reason !== "manual";
  openSession.closeReason = reason;

  attendance.totalDuration += duration;
  attendance.logoutTime = now;
  await attendance.save();

  broadcastCheckout(userId, now, duration, attendance.totalDuration, reason);

  return attendance;
}

/**
 * Opens a new session for "right now". Used by BOTH password login AND
 * the frontend calling in on tab reopen (existing valid token, no fresh
 * /login call). Guards against double-counting: if a session is already
 * open today, this is a no-op.
 */
async function recordCheckIn(userId, userName = null) {
  await closeStaleOpenSessions(userId);

  const today = startOfDay();
  const now = new Date();

  let attendance;

  try {
    attendance = await Attendance.findOne({ user: userId, date: today });

    if (!attendance) {
      attendance = await Attendance.create({
        user: userId,
        date: today,
        loginTime: now,
        sessions: [{ loginTime: now }],
      });
    } else {
      const lastSession = attendance.sessions[attendance.sessions.length - 1];
      const alreadyOpen = lastSession && !lastSession.logoutTime;

      if (!alreadyOpen) {
        attendance.sessions.push({ loginTime: now });
        await attendance.save();
      } else {
        // Already checked in — nothing to do, just return as-is.
        return attendance;
      }
    }
  } catch (err) {
    // Race condition (e.g. two near-simultaneous requests): another
    // request created today's doc between our findOne() and create().
    if (err.code === 11000) {
      attendance = await Attendance.findOne({ user: userId, date: today });
      if (attendance) {
        const lastSession = attendance.sessions[attendance.sessions.length - 1];
        const alreadyOpen = lastSession && !lastSession.logoutTime;
        if (!alreadyOpen) {
          attendance.sessions.push({ loginTime: now });
          await attendance.save();
        }
      } else {
        throw err;
      }
    } else {
      throw err;
    }
  }

  broadcastCheckin(userId, userName, now);
  return attendance;
}

/**
 * Hourly safety-net sweep — catches people who NEVER come back (quit,
 * multi-day absence) and whose sessions would otherwise stay open forever
 * since closeStaleOpenSessions only runs on their next check-in.
 */
async function closeAllStaleOpenSessions() {
  const today = startOfDay();

  const staleDocs = await Attendance.find({
    date: { $lt: today },
    logoutTime: null,
  });

  let closedCount = 0;

  for (const doc of staleDocs) {
    let changed = false;

    for (const session of doc.sessions) {
      if (!session.logoutTime) {
        const endOfThatDay = new Date(doc.date);
        endOfThatDay.setHours(23, 59, 59, 999);

        const duration = Math.max(0, Math.floor((endOfThatDay - session.loginTime) / 1000));
        session.logoutTime = endOfThatDay;
        session.duration = duration;
        session.autoClosed = true;
        session.closeReason = "daily-sweep";

        doc.totalDuration += duration;
        changed = true;
      }
    }

    if (changed) {
      doc.logoutTime = doc.logoutTime || new Date(doc.date).setHours(23, 59, 59, 999);
      await doc.save();
      closedCount++;

      broadcastCheckout(doc.user, doc.logoutTime, 0, doc.totalDuration, "daily-sweep");
    }
  }

  if (closedCount > 0) {
    console.log(`[attendance-cleanup] Auto-closed ${closedCount} stale session(s).`);
  }
}

function startAttendanceCleanupJob() {
  closeAllStaleOpenSessions().catch((err) =>
    console.error("[attendance-cleanup] initial run failed:", err)
  );

  setInterval(() => {
    closeAllStaleOpenSessions().catch((err) =>
      console.error("[attendance-cleanup] scheduled run failed:", err)
    );
  }, 60 * 60 * 1000); // every hour
}

module.exports = {
  startAttendanceCleanupJob,
  closeAllStaleOpenSessions,
  closeOpenSessionNow,
  recordCheckIn,
  startOfDay,
};