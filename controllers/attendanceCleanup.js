
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

// function broadcastCheckout(
//   userId,
//   logoutTime,
//   sessionDuration,
//   totalDuration,
//   reason,
// ) {
//   try {
//     const io = socket.getIO();
//     const payload = {
//       userId,
//       logoutTime,
//       sessionDuration,
//       totalDuration,
//       reason,
//     };
//     io.to("admin").emit("attendance-checkout", payload);
//     io.emit("attendance-checkout", payload);
//   } catch (err) {
//     console.error("Socket emit (checkout) failed:", err.message);
//   }
// }

// /**
//  * NEW — guard used everywhere a stale/previous-day session might get
//  * auto-closed. Once a record is flagged `needsApproval: true` (set by
//  * the nightly missing-logout sweep in attendanceSweep.js), ONLY
//  * approvePreviousLogout() in attendanceApproval.controller.js is
//  * allowed to set its logoutTime. Every auto-close path below must
//  * skip a user who currently has any flagged record, otherwise a
//  * background job silently resolves what's supposed to require admin
//  * sign-off — which is exactly what produced a record with both
//  * needsApproval:true AND a filled-in logoutTime/closeReason.
//  */
// async function hasPendingApproval(userId) {
//   const flagged = await Attendance.exists({
//     user: userId,
//     needsApproval: true,
//   });
//   return Boolean(flagged);
// }

// /**
//  * Closes out any open session on a day BEFORE today for this user.
//  * Runs on every real check-in — covers "closed the tab days ago and just
//  * came back" without waiting for the hourly sweep.
//  */
// async function closeStaleOpenSessions(userId) {
//   // NEW GUARD — never touch a flagged user's stale sessions. Their
//   // dashboard is already blocked by MissingLogoutGuard; leave the
//   // record exactly as the nightly sweep left it until an admin acts.
//   if (await hasPendingApproval(userId)) {
//     console.log(
//       `[attendance-cleanup] Skipping stale-session close for ${userId} — pending admin approval`,
//     );
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
//       if (!session.logoutTime) {
//         const endOfThatDay = new Date(doc.date);
//         endOfThatDay.setHours(23, 59, 59, 999);

//         const duration = Math.max(
//           0,
//           Math.floor((endOfThatDay - session.loginTime) / 1000),
//         );
//         session.logoutTime = endOfThatDay;
//         session.duration = duration;
//         session.autoClosed = true;
//         session.closeReason = "daily-sweep";

//         doc.totalDuration += duration;
//         changed = true;
//       }
//     }

//     if (changed) {
//       doc.logoutTime =
//         doc.logoutTime || new Date(doc.date).setHours(23, 59, 59, 999);
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

//   const duration = Math.max(
//     0,
//     Math.floor((now - openSession.loginTime) / 1000),
//   );
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
//  * Heartbeat watchdog — this is what actually fixes "still shows active
//  * through lunch / after the laptop slept". A socket "disconnect" event is
//  * NOT reliable across OS sleep: the JS event loop can freeze entirely
//  * (no disconnect, no ping — the tab just goes silent), or the underlying
//  * TCP connection can take a long time to be noticed as dead. So instead of
//  * waiting on the socket layer, this checks User.lastSeen directly — which
//  * is only ever updated by a genuinely alive tab (join-user / presence-ping).
//  *
//  * Closes the session AT the last real heartbeat time, not "now" — so the
//  * sleep gap itself never gets counted as worked time.
//  *
//  * This one is SAFE as-is — it only ever operates on TODAY's date, and a
//  * needsApproval flag is only ever set on a PREVIOUS day's record (the
//  * nightly sweep only looks at `date: { $lt: today }`), so there's no
//  * overlap here. No guard needed.
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

//     // No heartbeat recorded yet, or it's still fresh — leave it open.
//     if (!lastSeen || Date.now() - lastSeen.getTime() < INACTIVITY_THRESHOLD_MS)
//       continue;

//     // Never close using a timestamp earlier than the session's own start
//     // (guards against a stale/very old lastSeen value).
//     const closeAt =
//       lastSeen > openSession.loginTime ? lastSeen : openSession.loginTime;

//     const duration = Math.max(
//       0,
//       Math.floor((closeAt - openSession.loginTime) / 1000),
//     );
//     openSession.logoutTime = closeAt;
//     openSession.duration = duration;
//     openSession.autoClosed = true;
//     openSession.closeReason = "disconnect";

//     doc.totalDuration += duration;
//     doc.logoutTime = closeAt;
//     await doc.save();

//     broadcastCheckout(
//       doc.user,
//       closeAt,
//       duration,
//       doc.totalDuration,
//       "disconnect",
//     );
//   }
// }

// /**
//  * Opens a new session for "right now". Used by password login AND the
//  * frontend calling in on tab reopen (existing valid token, no fresh
//  * /login call). Guards against double-counting: if a session is already
//  * open today, this is a no-op. Also runs the cross-day stale sweep, so
//  * it's the right call for an actual login/checkin — but too heavy to run
//  * on every socket heartbeat (see ensureCheckedInToday below for that).
//  */
// async function recordCheckIn(userId, userName = null) {
//   // NEW GUARD — if this user has a flagged previous session awaiting
//   // admin approval, don't open a fresh session for them either. The
//   // frontend (MissingLogoutGuard) already blocks the dashboard UI, but
//   // this stops a direct/race-condition API call from creating a NEW
//   // attendance record while the old one is still unresolved.
//   if (await hasPendingApproval(userId)) {
//     console.log(
//       `[attendance-cleanup] recordCheckIn blocked for ${userId} — pending admin approval`,
//     );
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
//  * presence-ping). This is the piece that was missing before: those events
//  * only ever touched User.isOnline/lastSeen and never checked whether the
//  * watchdog (or a disconnect timer) had already closed today's session.
//  * Waking the laptop and reconnecting now reopens attendance immediately
//  * instead of requiring an actual password login. Deliberately skips the
//  * cross-day closeStaleOpenSessions() pass — that's covered by the hourly
//  * sweep and by recordCheckIn() at real login time — to keep this cheap
//  * enough to call on every heartbeat.
//  */
// async function ensureCheckedInToday(userId) {
//   // NEW GUARD — mirrors recordCheckIn(). This is the function that was
//   // firing on every page refresh (join-user) and silently creating/
//   // extending today's attendance for a user whose previous session was
//   // still waiting on admin approval.
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
//     // NEW GUARD — exclude anything already flagged for admin approval,
//     // so this sweep can never do what closeStaleOpenSessions() was
//     // doing: silently closing a session that's supposed to require a
//     // human decision.
//     needsApproval: { $ne: true },
//     "sessions.logoutType": { $ne: "ADMIN_APPROVED" },   // neww
//   });

//   let closedCount = 0;

//   for (const doc of staleDocs) {
//     let changed = false;

//     for (const session of doc.sessions) {
//       if (!session.logoutTime) {
//         const endOfThatDay = new Date(doc.date);
//         endOfThatDay.setHours(23, 59, 59, 999);

//         const duration = Math.max(
//           0,
//           Math.floor((endOfThatDay - session.loginTime) / 1000),
//         );
//         session.logoutTime = endOfThatDay;
//         session.duration = duration;
//         session.autoClosed = true;
//         session.closeReason = "daily-sweep";

//         doc.totalDuration += duration;
//         changed = true;
//       }
//     }

//     if (changed) {
//       doc.logoutTime =
//         doc.logoutTime || new Date(doc.date).setHours(23, 59, 59, 999);
//       await doc.save();
//       closedCount++;

//       broadcastCheckout(
//         doc.user,
//         doc.logoutTime,
//         0,
//         doc.totalDuration,
//         "daily-sweep",
//       );
//     }
//   }

//   if (closedCount > 0) {
//     console.log(
//       `[attendance-cleanup] Auto-closed ${closedCount} stale session(s).`,
//     );
//   }
// }

// function startAttendanceCleanupJob() {
//   closeAllStaleOpenSessions().catch((err) =>
//     console.error("[attendance-cleanup] initial run failed:", err),
//   );

//   setInterval(
//     () => {
//       closeAllStaleOpenSessions().catch((err) =>
//         console.error("[attendance-cleanup] scheduled run failed:", err),
//       );
//     },
//     60 * 60 * 1000,
//   ); // every hour — days-old stale sessions

//   setInterval(() => {
//     closeInactiveOpenSessionsToday().catch((err) =>
//       console.error("[attendance-watchdog] scheduled run failed:", err),
//     );
//   }, WATCHDOG_INTERVAL_MS); // every 30s — today's sleep/suspend/dead-tab sessions
// }

// module.exports = {
//   startAttendanceCleanupJob,
//   closeAllStaleOpenSessions,
//   closeInactiveOpenSessionsToday,
//   closeOpenSessionNow,
//   recordCheckIn,
//   ensureCheckedInToday,
//   hasPendingApproval,
//   startOfDay,
// };
















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
 * A session that was resolved through the admin-approval workflow is
 * PERMANENTLY finalized with an intentionally blank logoutTime.
 * needsApproval flips to false right after approval, so it can no
 * longer be used to protect the record from auto-close jobs — this
 * check (based on closeReason, which never changes again) is what
 * actually provides permanent protection.
 */
function isPermanentlyResolvedByApproval(session) {
  return session.closeReason === "admin-approved";
}

async function hasPendingApproval(userId) {
  const flagged = await Attendance.exists({ user: userId, needsApproval: true });
  return Boolean(flagged);
}

/**
 * Closes out any open session on a day BEFORE today for this user.
 * Runs on every real check-in — covers "closed the tab days ago and just
 * came back" without waiting for the hourly sweep.
 */
async function closeStaleOpenSessions(userId) {
  // Still-pending records are fully protected — leave them for the
  // admin approval endpoint.
  // if (await hasPendingApproval(userId)) {
  //   console.log(`[attendance-cleanup] Skipping stale-session close for ${userId} — pending admin approval`);
  //   return;
  // }

  const today = startOfDay();

  const staleDocs = await Attendance.find({
    user: userId,
    date: { $lt: today },
    logoutTime: null,
  });

  for (const doc of staleDocs) {
    let changed = false;

    for (const session of doc.sessions) {
      // FIXED: skip any session that was already resolved via admin
      // approval — its blank logoutTime is intentional and permanent,
      // not "still needs closing".
      if (isPermanentlyResolvedByApproval(session)) continue;

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
 * Heartbeat watchdog — only ever touches TODAY's date, and admin
 * approval only ever resolves PREVIOUS days, so there's no overlap
 * here. No guard needed.
 */
async function closeInactiveOpenSessionsToday() {
  const today = startOfDay();

  const openDocs = await Attendance.find({
    date: today,
    sessions: { $elemMatch: { logoutTime: null } },
  });

  for (const doc of openDocs) {
    const openSession = [...doc.sessions].reverse().find((s) => !s.logoutTime);
    if (!openSession) continue;

    const user = await User.findById(doc.user).select("lastSeen").lean();
    const lastSeen = user?.lastSeen ? new Date(user.lastSeen) : null;

    if (!lastSeen || Date.now() - lastSeen.getTime() < INACTIVITY_THRESHOLD_MS) continue;

    const closeAt = lastSeen > openSession.loginTime ? lastSeen : openSession.loginTime;

    const duration = Math.max(0, Math.floor((closeAt - openSession.loginTime) / 1000));
    openSession.logoutTime = closeAt;
    openSession.duration = duration;
    openSession.autoClosed = true;
    openSession.closeReason = "disconnect";

    doc.totalDuration += duration;
    doc.logoutTime = closeAt;
    await doc.save();

    broadcastCheckout(doc.user, closeAt, duration, doc.totalDuration, "disconnect");
  }
}

/**
 * Opens a new session for "right now". Used by password login AND the
 * frontend calling in on tab reopen (existing valid token, no fresh
 * /login call).
 */
async function recordCheckIn(userId, userName = null) {
  // if (await hasPendingApproval(userId)) {
  //   console.log(`[attendance-cleanup] recordCheckIn blocked for ${userId} — pending admin approval`);
  //   return null;
  // }

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
        return attendance;
      }
    }
  } catch (err) {
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
 * Lightweight reopen used by high-frequency socket events (join-user,
 * presence-ping) — THIS is the function that fires on every page
 * refresh, and was the direct trigger for the bug you're seeing.
 */
async function ensureCheckedInToday(userId) {
  if (await hasPendingApproval(userId)) {
    return null;
  }

  const today = startOfDay();
  const now = new Date();

  let attendance = await Attendance.findOne({ user: userId, date: today });

  if (!attendance) {
    attendance = await Attendance.create({
      user: userId,
      date: today,
      loginTime: now,
      sessions: [{ loginTime: now }],
    });
    broadcastCheckin(userId, null, now);
    return attendance;
  }

  const lastSession = attendance.sessions[attendance.sessions.length - 1];
  const alreadyOpen = lastSession && !lastSession.logoutTime;
  if (alreadyOpen) return attendance;

  attendance.sessions.push({ loginTime: now });
  await attendance.save();
  broadcastCheckin(userId, null, now);
  return attendance;
}

/**
 * Hourly safety-net sweep — catches people who NEVER come back (quit,
 * multi-day absence) and whose sessions would otherwise stay open forever.
 */
async function closeAllStaleOpenSessions() {
  const today = startOfDay();

  const staleDocs = await Attendance.find({
    date: { $lt: today },
    logoutTime: null,
    needsApproval: { $ne: true },
  });

  let closedCount = 0;

  for (const doc of staleDocs) {
    let changed = false;

    for (const session of doc.sessions) {
      // FIXED: same permanent-resolution guard as closeStaleOpenSessions.
      // Without this, the hourly cron alone is enough to silently
      // overwrite an admin-approved blank checkout with a fabricated
      // 11:59 PM end-of-day time — which is exactly what you saw.
      if (isPermanentlyResolvedByApproval(session)) continue;

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
  hasPendingApproval,
  isPermanentlyResolvedByApproval,
  startOfDay,
};