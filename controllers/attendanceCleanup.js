

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
//  * Closes out any open session on a day BEFORE today for this user.
//  * Runs on every real check-in — covers "closed the tab days ago and just
//  * came back" without waiting for the hourly sweep.
//  */
// async function closeStaleOpenSessions(userId) {
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
//     if (!lastSeen || Date.now() - lastSeen.getTime() < INACTIVITY_THRESHOLD_MS) continue;

//     // Never close using a timestamp earlier than the session's own start
//     // (guards against a stale/very old lastSeen value).
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
//  * /login call). Guards against double-counting: if a session is already
//  * open today, this is a no-op. Also runs the cross-day stale sweep, so
//  * it's the right call for an actual login/checkin — but too heavy to run
//  * on every socket heartbeat (see ensureCheckedInToday below for that).
//  */
// async function recordCheckIn(userId, userName = null) {
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
//   });

//   let closedCount = 0;

//   for (const doc of staleDocs) {
//     let changed = false;

//     for (const session of doc.sessions) {
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
//   }, 60 * 60 * 1000); // every hour — days-old stale sessions

//   setInterval(() => {
//     closeInactiveOpenSessionsToday().catch((err) =>
//       console.error("[attendance-watchdog] scheduled run failed:", err)
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
//   startOfDay,
// };















// controllers/attendanceCleanup.js
//
// ============================================================
// THE BUG THIS FIXES
// ============================================================
//
// Symptom: after a tab close / system crash / network drop, when the
// person reopens the tab, NO new session starts — the same old
// session just keeps getting extended, with its "login time" frozen
// at the original (now stale) start, silently accumulating hours
// across the gap where nothing was actually happening.
//
// Root cause: `ensureCheckedInToday` (called on every socket
// `join-user` / `presence-ping`) previously just checked "is there
// an open session for today?" — if yes, it left it alone and did
// nothing. That's correct for a BRIEF reconnect (network blip, page
// navigation) but wrong for a genuinely abandoned session: if the
// SERVER itself restarted (deploy, crash), every in-memory disconnect
// timer in socket.js is wiped, so nothing ever calls
// closeOpenSessionNow for sessions that were open at the time. The
// session just sits open in the DB indefinitely. When the person
// comes back, the old code found that stale open session and treated
// it as still valid — extending it instead of closing it out and
// starting fresh.
//
// ============================================================
// THE FIX
// ============================================================
//
// 1. Every session now carries a `lastSeenAt` heartbeat, refreshed on
//    every `join-user` / `presence-ping` while a connection is
//    genuinely alive (see socket.js).
//
// 2. `ensureCheckedInToday` now checks that heartbeat's age:
//      - recent (<= STALE_SESSION_THRESHOLD_MS)  -> just touch it,
//        this really is a continuous session.
//      - stale (older than that)                 -> close THIS
//        session out (closeReason: "stale-timeout"), THEN atomically
//        open a brand new one. The person sees a fresh session start
//        at the moment they actually reconnected, not a session
//        silently extended across the gap.
//
// 3. `recordCheckIn` (used by fresh password login and the manual
//    /checkin endpoint) stays simple and atomic/idempotent as before
//    — a deliberate login always means "I am here now," so it's safe
//    to just open a session if none is open, or leave an existing
//    open one alone.
// ============================================================

const Attendance = require("../models/Attendance");

const MAX_REASONABLE_SESSION_HOURS = 16;

// How long a session can go without a heartbeat before it's
// considered abandoned rather than "still connected". Should be a
// comfortable multiple of however often the frontend sends
// presence-ping (e.g. every 20–30s) so ordinary network jitter or a
// couple of missed pings never trips this, while a real crash/restart
// (which leaves NO further heartbeats at all) gets caught quickly.
const STALE_SESSION_THRESHOLD_MS = 90 * 1000; // 90 seconds

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function computeTotalDuration(sessions) {
  return sessions.reduce((sum, s) => sum + Number(s.duration || 0), 0);
}

function closeSession(session, now, reason) {
  const loginTime = new Date(session.loginTime);
  const rawDuration = Math.max(
    0,
    Math.floor((now.getTime() - loginTime.getTime()) / 1000),
  );

  session.logoutTime = now;
  session.duration = Math.min(rawDuration, MAX_REASONABLE_SESSION_HOURS * 3600);
  session.autoClosed = true;
  session.closeReason = reason;
}

// ============================================================
// CHECK-IN (idempotent, race-safe) — used by login / manual /checkin
// ============================================================

async function recordCheckIn(userId, userName) {
  const now = new Date();
  const today = startOfDay(now);

  await Attendance.updateOne(
    { user: userId, date: today },
    {
      $setOnInsert: {
        user: userId,
        date: today,
        sessions: [],
        totalDuration: 0,
      },
    },
    { upsert: true },
  );

  // Atomically push a new session ONLY IF no open session already
  // exists for today — this filter is what makes concurrent calls
  // (multiple tabs, races) safe: at most one racing call can ever
  // win the push.
  const created = await Attendance.findOneAndUpdate(
    {
      user: userId,
      date: today,
      sessions: { $not: { $elemMatch: { logoutTime: null } } },
    },
    {
      $push: { sessions: { loginTime: now, lastSeenAt: now } },
    },
    { new: true },
  );

  if (created) return created;

  // An open session already exists — leave it alone, this is a
  // deliberate login and a session is already active.
  return Attendance.findOne({ user: userId, date: today });
}

// ============================================================
// ENSURE CHECKED-IN TODAY (staleness-aware) — used by join-user /
// presence-ping, i.e. every reconnect and every heartbeat.
// ============================================================

async function ensureCheckedInToday(userId, userName) {
  const now = new Date();
  const today = startOfDay(now);

  await Attendance.updateOne(
    { user: userId, date: today },
    {
      $setOnInsert: {
        user: userId,
        date: today,
        sessions: [],
        totalDuration: 0,
      },
    },
    { upsert: true },
  );

  const attendance = await Attendance.findOne({ user: userId, date: today });
  if (!attendance) return null; // shouldn't happen given the upsert above

  const openSession = [...attendance.sessions]
    .reverse()
    .find((s) => !s.logoutTime);

  if (!openSession) {
    // No open session — atomically open one (same guarded push as
    // recordCheckIn, safe against races with other reconnects).
    const created = await Attendance.findOneAndUpdate(
      {
        user: userId,
        date: today,
        sessions: { $not: { $elemMatch: { logoutTime: null } } },
      },
      {
        $push: { sessions: { loginTime: now, lastSeenAt: now } },
      },
      { new: true },
    );

    return created || Attendance.findOne({ user: userId, date: today });
  }

  // There IS an open session — decide whether it's genuinely still
  // alive or abandoned, based on its last heartbeat.
  const lastBeat = openSession.lastSeenAt || openSession.loginTime;
  const ageMs = now.getTime() - new Date(lastBeat).getTime();

  if (ageMs <= STALE_SESSION_THRESHOLD_MS) {
    // Recent heartbeat — this really is a continuous session. Just
    // refresh the heartbeat; do NOT create a new session.
    await Attendance.updateOne(
      { _id: attendance._id, "sessions._id": openSession._id },
      { $set: { "sessions.$.lastSeenAt": now } },
    );
    return attendance;
  }

  // Stale — nobody has actually been present since `lastBeat`. Close
  // this session out as abandoned, then open a brand new one so the
  // person sees a fresh session starting NOW, not the old one
  // silently extended across the gap.
  const fresh = await Attendance.findOne({ user: userId, date: today });
  if (!fresh) return null;

  const stillOpen = fresh.sessions.find(
    (s) => String(s._id) === String(openSession._id) && !s.logoutTime,
  );

  if (stillOpen) {
    closeSession(stillOpen, now, "stale-timeout");
    fresh.totalDuration = computeTotalDuration(fresh.sessions);
    fresh.sessions.push({ loginTime: now, lastSeenAt: now });
    await fresh.save();
  } else {
    // Someone else's concurrent call already closed/handled it —
    // just make sure a session is open.
    return ensureCheckedInToday(userId, userName);
  }

  return fresh;
}

// ============================================================
// CLOSE SESSION NOW (self-healing — closes ALL open sessions found)
// ============================================================

async function closeOpenSessionNow(userId, reason = "unknown") {
  const now = new Date();
  const today = startOfDay(now);

  const attendance = await Attendance.findOne({ user: userId, date: today });
  if (!attendance) return null;

  let changed = false;

  for (const session of attendance.sessions) {
    if (!session.logoutTime) {
      closeSession(session, now, reason);
      changed = true;
    }
  }

  if (!changed) return attendance;

  attendance.totalDuration = computeTotalDuration(attendance.sessions);
  await attendance.save();
  return attendance;
}

// ============================================================
// DAILY / PERIODIC SWEEP — belt-and-suspenders for sessions that
// somehow stayed open far longer than the stale threshold could ever
// legitimately allow (e.g. this job itself was down for a while).
// ============================================================

async function closeStaleOpenSessions({
  olderThanHours = MAX_REASONABLE_SESSION_HOURS,
} = {}) {
  const cutoff = new Date(Date.now() - olderThanHours * 3600 * 1000);

  const staleRecords = await Attendance.find({
    "sessions.logoutTime": null,
    "sessions.loginTime": { $lte: cutoff },
  });

  let closedCount = 0;

  for (const attendance of staleRecords) {
    let changed = false;

    for (const session of attendance.sessions) {
      if (!session.logoutTime && new Date(session.loginTime) <= cutoff) {
        closeSession(session, cutoff, "daily-sweep");
        changed = true;
        closedCount += 1;
      }
    }

    if (changed) {
      attendance.totalDuration = computeTotalDuration(attendance.sessions);
      await attendance.save();
    }
  }

  return { recordsTouched: staleRecords.length, sessionsClosed: closedCount };
}

module.exports = {
  recordCheckIn,
  ensureCheckedInToday,
  closeOpenSessionNow,
  closeStaleOpenSessions,
  STALE_SESSION_THRESHOLD_MS,
};