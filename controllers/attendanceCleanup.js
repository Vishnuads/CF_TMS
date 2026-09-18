
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

























const Attendance = require("../models/Attendance");
const User = require("../models/User");
const socket = require("../socket");

// ============================================================
// TIMEZONE FIX
// ============================================================
// The whole system computes "start of day" / "end of day" using
// setHours(), which runs in the SERVER PROCESS's local timezone.
// If the server runs in UTC but the business timezone is IST
// (+5:30), every day-boundary timestamp is off by 5.5 hours — this
// is exactly why auto-closed sessions were showing "05:29 am"
// (23:59:59 UTC rendered in IST on the browser) instead of midnight,
// and why some durations came out blank/negative.
//
// Fix: compute boundaries against a FIXED offset, independent of
// whatever timezone the server OS/process happens to be in.
// ============================================================

const TZ_OFFSET_MINUTES = 330; // IST = UTC+5:30. Change if your business timezone differs.

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

function endOfDay(d = new Date()) {
  const shifted = toBusinessTime(d);
  shifted.setUTCHours(23, 59, 59, 999);
  return fromBusinessTime(shifted);
}

// ============================================================
// SESSION-THRASHING FIX
// ============================================================
// Old threshold closed a session after 60s idle, and the very next
// socket ping immediately reopened a new one — producing dozens of
// 0m/1m rows per day. Raised to match the app's own idle-hold
// standard elsewhere (3 min), and the watchdog checks less often too.
// ============================================================

const INACTIVITY_THRESHOLD_MS = 3 * 60 * 1000; // was 60s — way too aggressive
const WATCHDOG_INTERVAL_MS = 60 * 1000; // was 30s

// If a session closes and activity resumes within this window,
// REOPEN the same session instead of starting a brand-new one. This
// is what actually kills the rapid-fire duplicate-session pattern.
const REOPEN_GRACE_MS = 2 * 60 * 1000;

// ============================================================
// PER-USER LOCK — serializes concurrent writes to the same user's
// Attendance document. recordCheckIn / ensureCheckedInToday /
// closeOpenSessionNow / the watchdog were all doing independent
// read-modify-save on the same doc with no coordination, which is
// how a logout write and a reopen write could race and silently
// overwrite each other. In-process lock — fine for a single Node
// instance; if you run multiple server instances behind a load
// balancer, this needs to move to a Mongo-atomic update or a
// distributed lock (e.g. Redis) instead.
// ============================================================

const userLocks = new Map();

async function withUserLock(userId, fn) {
  const key = String(userId);
  const prev = userLocks.get(key) || Promise.resolve();
  let release;
  const next = new Promise((resolve) => (release = resolve));
  userLocks.set(key, prev.then(() => next));

  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (userLocks.get(key) === next) userLocks.delete(key);
  }
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

function isPermanentlyResolvedByApproval(session) {
  return session.closeReason === "admin-approved";
}

async function hasPendingApproval(userId) {
  const flagged = await Attendance.exists({ user: userId, needsApproval: true });
  return Boolean(flagged);
}

/**
 * Closes out any open session on a day BEFORE today for this user.
 * Public entry point — acquires the lock itself.
 */
async function closeStaleOpenSessions(userId) {
  return withUserLock(userId, () => closeStaleOpenSessionsUnlocked(userId));
}

// Internal variant assuming the caller already holds the lock —
// avoids deadlocking against itself when called from inside
// openOrResumeSession.
async function closeStaleOpenSessionsUnlocked(userId) {
  if (await hasPendingApproval(userId)) {
    console.log(`[attendance-cleanup] Skipping stale-session close for ${userId} — pending admin approval`);
    return;
  }

  const today = startOfDay();

  const staleDocs = await Attendance.find({
    user: userId,
    date: { $lt: today },
    logoutTime: null,
  });

  for (const doc of staleDocs) {
    let changed = false;

    for (const session of doc.sessions) {
      if (isPermanentlyResolvedByApproval(session)) continue;

      if (!session.logoutTime) {
        const endOfThatDay = endOfDay(doc.date); // FIXED — IST-aware now

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
      doc.logoutTime = doc.logoutTime || endOfDay(doc.date);
      doc.markModified("sessions");
      await doc.save();
    }
  }
}

/**
 * Closes a user's currently-open session using the real current time.
 */
async function closeOpenSessionNow(userId, reason = "manual") {
  return withUserLock(userId, async () => {
    const today = startOfDay();
    const attendance = await Attendance.findOne({ user: userId, date: today });
    if (!attendance) return null;

    const now = new Date();

    // FIXED — close EVERY open session, not just the most recent one.
    // Old code walked from the end and stopped at the first open
    // session it found, leaving any EARLIER orphaned-open session
    // (a leftover from the race-condition bug) stuck open forever —
    // which is exactly why "Missing logout" kept showing even after
    // an explicit logout closed the latest session.
    let anyClosed = false;
    let lastDuration = 0;

    for (const session of attendance.sessions) {
      if (session.logoutTime) continue; // already closed

      const duration = Math.max(0, Math.floor((now - session.loginTime) / 1000));
      session.logoutTime = now;
      session.duration = duration;
      session.autoClosed = reason !== "manual";
      session.closeReason = reason;

      attendance.totalDuration += duration;
      lastDuration = duration;
      anyClosed = true;
    }

    if (!anyClosed) return attendance; // nothing was open — no-op

    attendance.logoutTime = now;
    attendance.markModified("sessions");
    await attendance.save();

    broadcastCheckout(userId, now, lastDuration, attendance.totalDuration, reason);

    return attendance;
  });
}

/**
 * Core "make sure there's an open session right now" logic, shared by
 * recordCheckIn and ensureCheckedInToday. This is where the reopen
 * grace window lives — if the most recent session closed within the
 * last REOPEN_GRACE_MS, we undo that close instead of starting a new
 * session, collapsing brief disconnect/reconnect flicker into one
 * continuous entry instead of fragmenting it.
 */
async function openOrResumeSession(userId, userName, { runStaleCleanup } = {}) {
  return withUserLock(userId, async () => {
    if (runStaleCleanup) {
      if (await hasPendingApproval(userId)) {
        console.log(`[attendance-cleanup] blocked for ${userId} — pending admin approval`);
        return null;
      }
      await closeStaleOpenSessionsUnlocked(userId);
    } else if (await hasPendingApproval(userId)) {
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
      broadcastCheckin(userId, userName, now);
      return attendance;
    }

    const lastSession = attendance.sessions[attendance.sessions.length - 1];
    const alreadyOpen = lastSession && !lastSession.logoutTime;

    if (alreadyOpen) return attendance; // nothing to do

    // ── REOPEN, don't duplicate, if it closed very recently ──
    if (
      lastSession &&
      lastSession.logoutTime &&
      !isPermanentlyResolvedByApproval(lastSession) &&
      now.getTime() - new Date(lastSession.logoutTime).getTime() <= REOPEN_GRACE_MS
    ) {
      attendance.totalDuration = Math.max(0, attendance.totalDuration - (lastSession.duration || 0));
      lastSession.logoutTime = null;
      lastSession.duration = 0;
      lastSession.autoClosed = false;
      lastSession.closeReason = "manual";
      attendance.markModified("sessions");
      await attendance.save();
      return attendance;
    }

    // Otherwise, genuinely start a new session entry.
    attendance.sessions.push({ loginTime: now });
    attendance.markModified("sessions");
    await attendance.save();

    broadcastCheckin(userId, userName, now);
    return attendance;
  });
}

/**
 * Opens a new session for "right now". Used by password login AND the
 * frontend calling in on tab reopen.
 */
async function recordCheckIn(userId, userName = null) {
  return openOrResumeSession(userId, userName, { runStaleCleanup: true });
}

/**
 * Lightweight reopen used by high-frequency socket events. Now shares
 * the SAME locked, grace-window-aware logic as recordCheckIn instead
 * of its own separate (racy) read-modify-save — this is the direct
 * fix for the dozens-of-0m-sessions pattern.
 */
async function ensureCheckedInToday(userId) {
  return openOrResumeSession(userId, null, { runStaleCleanup: false });
}

/**
 * Heartbeat watchdog.
 */
async function closeInactiveOpenSessionsToday() {
  const today = startOfDay();

  const openDocs = await Attendance.find({
    date: today,
    sessions: { $elemMatch: { logoutTime: null } },
  });

  for (const doc of openDocs) {
    await withUserLock(doc.user, async () => {
      const fresh = await Attendance.findById(doc._id);
      if (!fresh) return;

      const openSession = [...fresh.sessions].reverse().find((s) => !s.logoutTime);
      if (!openSession) return;

      const user = await User.findById(fresh.user).select("lastSeen").lean();
      const lastSeen = user?.lastSeen ? new Date(user.lastSeen) : null;

      if (!lastSeen || Date.now() - lastSeen.getTime() < INACTIVITY_THRESHOLD_MS) return;

      const closeAt = lastSeen > openSession.loginTime ? lastSeen : openSession.loginTime;

      const duration = Math.max(0, Math.floor((closeAt - openSession.loginTime) / 1000));
      openSession.logoutTime = closeAt;
      openSession.duration = duration;
      openSession.autoClosed = true;
      openSession.closeReason = "disconnect";

      fresh.totalDuration += duration;
      fresh.logoutTime = closeAt;
      fresh.markModified("sessions");
      await fresh.save();

      broadcastCheckout(fresh.user, closeAt, duration, fresh.totalDuration, "disconnect");
    });
  }
}

/**
 * Hourly safety-net sweep.
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
    await withUserLock(doc.user, async () => {
      const fresh = await Attendance.findById(doc._id);
      if (!fresh) return;

      let changed = false;

      for (const session of fresh.sessions) {
        if (isPermanentlyResolvedByApproval(session)) continue;

        if (!session.logoutTime) {
          const endOfThatDay = endOfDay(fresh.date); // FIXED — IST-aware

          const duration = Math.max(0, Math.floor((endOfThatDay - session.loginTime) / 1000));
          session.logoutTime = endOfThatDay;
          session.duration = duration;
          session.autoClosed = true;
          session.closeReason = "daily-sweep";

          fresh.totalDuration += duration;
          changed = true;
        }
      }

      if (changed) {
        fresh.logoutTime = fresh.logoutTime || endOfDay(fresh.date);
        fresh.markModified("sessions");
        await fresh.save();
        closedCount++;

        broadcastCheckout(fresh.user, fresh.logoutTime, 0, fresh.totalDuration, "daily-sweep");
      }
    });
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
  endOfDay,
};