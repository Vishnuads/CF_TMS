
// const Attendance = require("../models/Attendance");
// const User = require("../models/User");
// const socket = require("../socket");

// function startOfDay(d = new Date()) {
//   const x = new Date(d);
//   x.setHours(0, 0, 0, 0);
//   return x;
// }


// const INACTIVITY_THRESHOLD_MS = 60 * 1000; // 60s
// const WATCHDOG_INTERVAL_MS = 30 * 1000; // check every 30s

// function broadcastCheckin(userId, name, loginTime) {
//   try {
//     const io = socket.getIO();
//     const payload = { userId, name, loginTime };
//     io.to("admin").emit("attendance-checkin", payload);
//     io.emit("attendance-checkin", payload);
//   } catch (err) {
//     console.error("Socket emit (checkin) failed:", err.message);
//   }
// }

// function broadcastCheckout(userId, logoutTime, sessionDuration, totalDuration, reason) {
//   try {
//     const io = socket.getIO();
//     const payload = { userId, logoutTime, sessionDuration, totalDuration, reason };
//     io.to("admin").emit("attendance-checkout", payload);
//     io.emit("attendance-checkout", payload);
//   } catch (err) {
//     console.error("Socket emit (checkout) failed:", err.message);
//   }
// }

// /**
//  * A session that was resolved through the admin-approval workflow is
//  * PERMANENTLY finalized with an intentionally blank logoutTime.
//  * needsApproval flips to false right after approval, so it can no
//  * longer be used to protect the record from auto-close jobs — this
//  * check (based on closeReason, which never changes again) is what
//  * actually provides permanent protection.
//  */
// function isPermanentlyResolvedByApproval(session) {
//   return session.closeReason === "admin-approved";
// }

// async function hasPendingApproval(userId) {
//   const flagged = await Attendance.exists({ user: userId, needsApproval: true });
//   return Boolean(flagged);
// }

// /**
//  * Closes out any open session on a day BEFORE today for this user.
//  * Runs on every real check-in — covers "closed the tab days ago and just
//  * came back" without waiting for the hourly sweep.
//  */
// async function closeStaleOpenSessions(userId) {
//   // Still-pending records are fully protected — leave them for the
//   // admin approval endpoint.
//   if (await hasPendingApproval(userId)) {
//     console.log(`[attendance-cleanup] Skipping stale-session close for ${userId} — pending admin approval`);
//     return;
//   }

//   const today = startOfDay();

//   const staleDocs = await Attendance.find({
//     user: userId,
//     date: { $lt: today },
//     logoutTime: null,
//   });

//   for (const doc of staleDocs) {
//     let changed = false;

//     for (const session of doc.sessions) {
//       // FIXED: skip any session that was already resolved via admin
//       // approval — its blank logoutTime is intentional and permanent,
//       // not "still needs closing".
//       if (isPermanentlyResolvedByApproval(session)) continue;

//       if (!session.logoutTime) {
//         const endOfThatDay = new Date(doc.date);
//         endOfThatDay.setHours(23, 59, 59, 999);

//         const duration = Math.max(0, Math.floor((endOfThatDay - session.loginTime) / 1000));
//         session.logoutTime = endOfThatDay;
//         session.duration = duration;
//         session.autoClosed = true;
//         session.closeReason = "daily-sweep";

//         doc.totalDuration += duration;
//         changed = true;
//       }
//     }

//     if (changed) {
//       doc.logoutTime = doc.logoutTime || new Date(doc.date).setHours(23, 59, 59, 999);
//       await doc.save();
//     }
//   }
// }

// /**
//  * Closes a user's currently-open session using the REAL current time.
//  * Called on: beacon (tab close), confirmed socket disconnect, or manual
//  * logout. Race-safe — if nothing's open, this is a harmless no-op.
//  */
// async function closeOpenSessionNow(userId, reason = "manual") {
//   const today = startOfDay();
//   const attendance = await Attendance.findOne({ user: userId, date: today });
//   if (!attendance) return null;

//   const now = new Date();
//   let openSession = null;

//   for (let i = attendance.sessions.length - 1; i >= 0; i--) {
//     if (!attendance.sessions[i].logoutTime) {
//       openSession = attendance.sessions[i];
//       break;
//     }
//   }

//   if (!openSession) return attendance; // already closed — nothing to do

//   const duration = Math.max(0, Math.floor((now - openSession.loginTime) / 1000));
//   openSession.logoutTime = now;
//   openSession.duration = duration;
//   openSession.autoClosed = reason !== "manual";
//   openSession.closeReason = reason;

//   attendance.totalDuration += duration;
//   attendance.logoutTime = now;
//   await attendance.save();

//   broadcastCheckout(userId, now, duration, attendance.totalDuration, reason);

//   return attendance;
// }

// /**
//  * Heartbeat watchdog — only ever touches TODAY's date, and admin
//  * approval only ever resolves PREVIOUS days, so there's no overlap
//  * here. No guard needed.
//  */
// async function closeInactiveOpenSessionsToday() {
//   const today = startOfDay();

//   const openDocs = await Attendance.find({
//     date: today,
//     sessions: { $elemMatch: { logoutTime: null } },
//   });

//   for (const doc of openDocs) {
//     const openSession = [...doc.sessions].reverse().find((s) => !s.logoutTime);
//     if (!openSession) continue;

//     const user = await User.findById(doc.user).select("lastSeen").lean();
//     const lastSeen = user?.lastSeen ? new Date(user.lastSeen) : null;

//     if (!lastSeen || Date.now() - lastSeen.getTime() < INACTIVITY_THRESHOLD_MS) continue;

//     const closeAt = lastSeen > openSession.loginTime ? lastSeen : openSession.loginTime;

//     const duration = Math.max(0, Math.floor((closeAt - openSession.loginTime) / 1000));
//     openSession.logoutTime = closeAt;
//     openSession.duration = duration;
//     openSession.autoClosed = true;
//     openSession.closeReason = "disconnect";

//     doc.totalDuration += duration;
//     doc.logoutTime = closeAt;
//     await doc.save();

//     broadcastCheckout(doc.user, closeAt, duration, doc.totalDuration, "disconnect");
//   }
// }

// /**
//  * Opens a new session for "right now". Used by password login AND the
//  * frontend calling in on tab reopen (existing valid token, no fresh
//  * /login call).
//  */
// async function recordCheckIn(userId, userName = null) {
//   if (await hasPendingApproval(userId)) {
//     console.log(`[attendance-cleanup] recordCheckIn blocked for ${userId} — pending admin approval`);
//     return null;
//   }

//   await closeStaleOpenSessions(userId);

//   const today = startOfDay();
//   const now = new Date();

//   let attendance;

//   try {
//     attendance = await Attendance.findOne({ user: userId, date: today });

//     if (!attendance) {
//       attendance = await Attendance.create({
//         user: userId,
//         date: today,
//         loginTime: now,
//         sessions: [{ loginTime: now }],
//       });
//     } else {
//       const lastSession = attendance.sessions[attendance.sessions.length - 1];
//       const alreadyOpen = lastSession && !lastSession.logoutTime;

//       if (!alreadyOpen) {
//         attendance.sessions.push({ loginTime: now });
//         await attendance.save();
//       } else {
//         return attendance;
//       }
//     }
//   } catch (err) {
//     if (err.code === 11000) {
//       attendance = await Attendance.findOne({ user: userId, date: today });
//       if (attendance) {
//         const lastSession = attendance.sessions[attendance.sessions.length - 1];
//         const alreadyOpen = lastSession && !lastSession.logoutTime;
//         if (!alreadyOpen) {
//           attendance.sessions.push({ loginTime: now });
//           await attendance.save();
//         }
//       } else {
//         throw err;
//       }
//     } else {
//       throw err;
//     }
//   }

//   broadcastCheckin(userId, userName, now);
//   return attendance;
// }

// /**
//  * Lightweight reopen used by high-frequency socket events (join-user,
//  * presence-ping) — THIS is the function that fires on every page
//  * refresh, and was the direct trigger for the bug you're seeing.
//  */
// async function ensureCheckedInToday(userId) {
//   if (await hasPendingApproval(userId)) {
//     return null;
//   }

//   const today = startOfDay();
//   const now = new Date();

//   let attendance = await Attendance.findOne({ user: userId, date: today });

//   if (!attendance) {
//     attendance = await Attendance.create({
//       user: userId,
//       date: today,
//       loginTime: now,
//       sessions: [{ loginTime: now }],
//     });
//     broadcastCheckin(userId, null, now);
//     return attendance;
//   }

//   const lastSession = attendance.sessions[attendance.sessions.length - 1];
//   const alreadyOpen = lastSession && !lastSession.logoutTime;
//   if (alreadyOpen) return attendance;

//   attendance.sessions.push({ loginTime: now });
//   await attendance.save();
//   broadcastCheckin(userId, null, now);
//   return attendance;
// }

// /**
//  * Hourly safety-net sweep — catches people who NEVER come back (quit,
//  * multi-day absence) and whose sessions would otherwise stay open forever.
//  */
// async function closeAllStaleOpenSessions() {
//   const today = startOfDay();

//   const staleDocs = await Attendance.find({
//     date: { $lt: today },
//     logoutTime: null,
//     needsApproval: { $ne: true },
//   });

//   let closedCount = 0;

//   for (const doc of staleDocs) {
//     let changed = false;

//     for (const session of doc.sessions) {
//       // FIXED: same permanent-resolution guard as closeStaleOpenSessions.
//       // Without this, the hourly cron alone is enough to silently
//       // overwrite an admin-approved blank checkout with a fabricated
//       // 11:59 PM end-of-day time — which is exactly what you saw.
//       if (isPermanentlyResolvedByApproval(session)) continue;

//       if (!session.logoutTime) {
//         const endOfThatDay = new Date(doc.date);
//         endOfThatDay.setHours(23, 59, 59, 999);

//         const duration = Math.max(0, Math.floor((endOfThatDay - session.loginTime) / 1000));
//         session.logoutTime = endOfThatDay;
//         session.duration = duration;
//         session.autoClosed = true;
//         session.closeReason = "daily-sweep";

//         doc.totalDuration += duration;
//         changed = true;
//       }
//     }

//     if (changed) {
//       doc.logoutTime = doc.logoutTime || new Date(doc.date).setHours(23, 59, 59, 999);
//       await doc.save();
//       closedCount++;

//       broadcastCheckout(doc.user, doc.logoutTime, 0, doc.totalDuration, "daily-sweep");
//     }
//   }

//   if (closedCount > 0) {
//     console.log(`[attendance-cleanup] Auto-closed ${closedCount} stale session(s).`);
//   }
// }

// function startAttendanceCleanupJob() {
//   closeAllStaleOpenSessions().catch((err) =>
//     console.error("[attendance-cleanup] initial run failed:", err)
//   );

//   setInterval(() => {
//     closeAllStaleOpenSessions().catch((err) =>
//       console.error("[attendance-cleanup] scheduled run failed:", err)
//     );
//   }, 60 * 60 * 1000);

//   setInterval(() => {
//     closeInactiveOpenSessionsToday().catch((err) =>
//       console.error("[attendance-watchdog] scheduled run failed:", err)
//     );
//   }, WATCHDOG_INTERVAL_MS);
// }

// module.exports = {
//   startAttendanceCleanupJob,
//   closeAllStaleOpenSessions,
//   closeInactiveOpenSessionsToday,
//   closeOpenSessionNow,
//   recordCheckIn,
//   ensureCheckedInToday,
//   hasPendingApproval,
//   isPermanentlyResolvedByApproval,
//   startOfDay,
// };










//not admin





const Attendance = require("../models/Attendance");
const User = require("../models/User");
const socket = require("../socket");

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const INACTIVITY_THRESHOLD_MS = 60 * 1000; // 60s
const WATCHDOG_INTERVAL_MS = 30 * 1000; // check every 30s

// ============================================================
// SIMPLIFIED: the admin-approval / needsApproval workflow has been
// removed entirely. A session that carries over from a previous day
// (never properly closed — crash, force-quit, lost connection that
// never fired a disconnect event) is now just AUTO-CLOSED at a fixed
// time instead of blocking the user and waiting for manual admin
// review. Change these two constants if the policy time changes.
// ============================================================
const DEFAULT_STALE_LOGOUT_HOUR = 18;   // 6 PM
const DEFAULT_STALE_LOGOUT_MINUTE = 30; // :30 → 6:30 PM

function getDefaultStaleLogoutTime(baseDate) {
  const d = new Date(baseDate);
  d.setHours(DEFAULT_STALE_LOGOUT_HOUR, DEFAULT_STALE_LOGOUT_MINUTE, 0, 0);
  return d;
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

// ============================================================
// Reconciliation helpers — shared by the open-session flow and the
// stale-session sweep below.
//
// closeOrphanSessions: any session OTHER than the current last one
// that's still open gets closed using the NEXT session's login time.
// That earlier session's existence, with a later one already having
// started, is proof the connection died silently without a clean
// close event ever reaching the server. For an exact duplicate (same
// login time as the next session — a race-condition leftover), this
// collapses it to a real 0-duration closed row instead of leaving a
// permanent "still active" ghost.
//
// recomputeTotalDuration: rebuilds totalDuration from scratch as the
// sum of closed sessions, so it can never carry forward a
// double-counted overlapping span from a duplicate.
// ============================================================

function closeOrphanSessions(attendance) {
  let changed = false;

  for (let i = 0; i < attendance.sessions.length - 1; i++) {
    const session = attendance.sessions[i];
    if (session.logoutTime) continue;

    const nextSession = attendance.sessions[i + 1];
    const closeAt = nextSession.loginTime;
    const duration = Math.max(0, Math.floor((closeAt - session.loginTime) / 1000));

    session.logoutTime = closeAt;
    session.duration = duration;
    session.autoClosed = true;
    session.closeReason = "disconnect";
    changed = true;
  }

  return changed;
}

function recomputeTotalDuration(sessions) {
  return sessions.reduce((sum, s) => sum + (s.logoutTime ? s.duration || 0 : 0), 0);
}

// ============================================================
// Atomic-ish, self-healing session open. Reconciles any orphaned
// open session first, THEN decides whether to open a new one — this
// is what prevents duplicate sessions from rapid reconnects/multiple
// tabs, and self-heals even if a duplicate slips through once.
// ============================================================
async function reconcileAndOpenSession(userId, now) {
  const today = startOfDay(now);

  let attendance = await Attendance.findOne({ user: userId, date: today });

  if (!attendance) {
    try {
      attendance = await Attendance.create({
        user: userId,
        date: today,
        loginTime: now,
        sessions: [{ loginTime: now }],
      });
      return { attendance, opened: true };
    } catch (err) {
      if (err.code !== 11000) throw err;
      attendance = await Attendance.findOne({ user: userId, date: today });
      if (!attendance) throw err;
    }
  }

  const reconciled = closeOrphanSessions(attendance);

  const lastSession = attendance.sessions[attendance.sessions.length - 1];
  const alreadyOpen = lastSession && !lastSession.logoutTime;

  let opened = false;
  if (!alreadyOpen) {
    attendance.sessions.push({ loginTime: now });
    opened = true;
  }

  if (reconciled || opened) {
    attendance.totalDuration = recomputeTotalDuration(attendance.sessions);
    await attendance.save();
  }

  return { attendance, opened };
}

/**
 * SIMPLIFIED: auto-closes any open session on a day BEFORE today for
 * this user, using the fixed default logout time — no approval flag,
 * no blocking. Runs on every real check-in, covers "closed the tab
 * days ago and just came back" without waiting for the hourly sweep.
 */
async function closeStaleOpenSessions(userId) {
  const today = startOfDay();

  const staleDocs = await Attendance.find({
    user: userId,
    date: { $lt: today },
    logoutTime: null,
  });

  for (const doc of staleDocs) {
    let changed = closeOrphanSessions(doc);

    const lastSession = doc.sessions[doc.sessions.length - 1];

    if (lastSession && !lastSession.logoutTime) {
      const closeAt = getDefaultStaleLogoutTime(doc.date);
      const duration = Math.max(0, Math.floor((closeAt - lastSession.loginTime) / 1000));

      lastSession.logoutTime = closeAt;
      lastSession.duration = duration;
      lastSession.autoClosed = true;
      lastSession.closeReason = "daily-sweep";
      changed = true;
    }

    if (changed) {
      doc.totalDuration = recomputeTotalDuration(doc.sessions);
      doc.logoutTime = doc.logoutTime || getDefaultStaleLogoutTime(doc.date);
      await doc.save();
    }
  }
}

/**
 * Closes a user's currently-open session(s) using the REAL current
 * time. Called on: beacon (tab close), confirmed socket disconnect,
 * or manual logout. Race-safe — if nothing's open, this is a no-op.
 * Closes EVERY open session in today's doc, not just the last one,
 * to guard against any leftover duplicate.
 */
async function closeOpenSessionNow(userId, reason = "manual") {
  const today = startOfDay();
  const attendance = await Attendance.findOne({ user: userId, date: today });
  if (!attendance) return null;

  const now = new Date();
  let closedAny = false;
  let lastDuration = 0;

  for (const session of attendance.sessions) {
    if (session.logoutTime) continue;

    const duration = Math.max(0, Math.floor((now - session.loginTime) / 1000));
    session.logoutTime = now;
    session.duration = duration;
    session.autoClosed = reason !== "manual";
    session.closeReason = reason;

    lastDuration = duration;
    closedAny = true;
  }

  if (!closedAny) return attendance; // already closed — nothing to do

  attendance.totalDuration = recomputeTotalDuration(attendance.sessions);
  attendance.logoutTime = now;
  await attendance.save();

  broadcastCheckout(userId, now, lastDuration, attendance.totalDuration, reason);

  return attendance;
}

/**
 * Heartbeat watchdog — only ever touches TODAY's date. Closes EVERY
 * open session in a doc, not just the last one.
 */
async function closeInactiveOpenSessionsToday() {
  const today = startOfDay();

  const openDocs = await Attendance.find({
    date: today,
    sessions: { $elemMatch: { logoutTime: null } },
  });

  for (const doc of openDocs) {
    const user = await User.findById(doc.user).select("lastSeen").lean();
    const lastSeen = user?.lastSeen ? new Date(user.lastSeen) : null;

    if (!lastSeen || Date.now() - lastSeen.getTime() < INACTIVITY_THRESHOLD_MS) continue;

    let closedAny = false;
    let lastDuration = 0;
    let lastCloseAt = null;

    for (const session of doc.sessions) {
      if (session.logoutTime) continue;

      const closeAt = lastSeen > session.loginTime ? lastSeen : session.loginTime;
      const duration = Math.max(0, Math.floor((closeAt - session.loginTime) / 1000));

      session.logoutTime = closeAt;
      session.duration = duration;
      session.autoClosed = true;
      session.closeReason = "disconnect";

      lastDuration = duration;
      lastCloseAt = closeAt;
      closedAny = true;
    }

    if (!closedAny) continue;

    doc.totalDuration = recomputeTotalDuration(doc.sessions);
    doc.logoutTime = lastCloseAt;
    await doc.save();

    broadcastCheckout(doc.user, lastCloseAt, lastDuration, doc.totalDuration, "disconnect");
  }
}

/**
 * Opens (or reuses) today's session for a REAL login / explicit
 * check-in call. No approval gate — always proceeds.
 */
async function recordCheckIn(userId, userName = null) {
  await closeStaleOpenSessions(userId);

  const now = new Date();
  const { attendance, opened } = await reconcileAndOpenSession(userId, now);

  if (opened) broadcastCheckin(userId, userName, now);
  return attendance;
}

/**
 * Lightweight reopen used by high-frequency socket events (join-user,
 * presence-ping).
 */
async function ensureCheckedInToday(userId) {
  const now = new Date();
  const { attendance, opened } = await reconcileAndOpenSession(userId, now);

  if (opened) broadcastCheckin(userId, null, now);
  return attendance;
}

/**
 * Hourly safety-net sweep — catches people who NEVER come back (quit,
 * multi-day absence). Auto-closes at the fixed default time instead
 * of flagging for approval.
 */
async function closeAllStaleOpenSessions() {
  const today = startOfDay();

  const staleDocs = await Attendance.find({
    date: { $lt: today },
    logoutTime: null,
  });

  let closedCount = 0;

  for (const doc of staleDocs) {
    let changed = closeOrphanSessions(doc);

    const lastSession = doc.sessions[doc.sessions.length - 1];

    if (lastSession && !lastSession.logoutTime) {
      const closeAt = getDefaultStaleLogoutTime(doc.date);
      const duration = Math.max(0, Math.floor((closeAt - lastSession.loginTime) / 1000));

      lastSession.logoutTime = closeAt;
      lastSession.duration = duration;
      lastSession.autoClosed = true;
      lastSession.closeReason = "daily-sweep";
      changed = true;
    }

    if (changed) {
      doc.totalDuration = recomputeTotalDuration(doc.sessions);
      doc.logoutTime = doc.logoutTime || getDefaultStaleLogoutTime(doc.date);
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
  }, 60 * 60 * 1000);

  setInterval(() => {
    closeInactiveOpenSessionsToday().catch((err) =>
      console.error("[attendance-watchdog] scheduled run failed:", err)
    );
  }, WATCHDOG_INTERVAL_MS);
}

module.exports = {
  startAttendanceCleanupJob,
  closeAllStaleOpenSessions,
  closeInactiveOpenSessionsToday,
  closeOpenSessionNow,
  recordCheckIn,
  ensureCheckedInToday,
  startOfDay,
};