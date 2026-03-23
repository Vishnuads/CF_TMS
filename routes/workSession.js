// // routes/workSession.js

// const router = require("express").Router();
// const WorkSession = require("../models/WorkSession");
// const authUser = require("../middleware/chatAuth");
// const { auth, adminOnly } = require("../middleware/auth.middleware");


// const AUTO_STOP_LIMIT = 5 * 60 * 1000;


// router.post("/work/start", authUser, async (req, res) => {
//   try {
//     let session = await WorkSession.findOne({
//       user: req.user._id,
//       status: { $in: ["RUNNING", "PAUSED"] },
//     });

  

//     if (session) {
//       session.lastSeenAt = new Date();

//       if (session.status === "RUNNING") {
//         await session.save();
//       }

//       return res.json(session);
//     }

//     session = await WorkSession.create({
//       user: req.user._id,
//       startTime: new Date(),
//       lastSeenAt: new Date(),
//       status: "RUNNING",
//     });

//     res.json(session);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });


// router.post("/work/heartbeat", authUser, async (req, res) => {
//   try {
//     const session = await WorkSession.findOne({
//       user: req.user._id,
//        status: { $in: ["RUNNING", "PAUSED"] },
//     });

//     if (!session) return res.sendStatus(204);

//     session.lastSeenAt = new Date();

//     await session.save();

//     res.json({ alive: true, sessionId: session._id });
//   } catch {
//     res.sendStatus(500);
//   }
// });

// router.post("/work/stop/:id", authUser, async (req, res) => {
//   try {
//     if (!req.params.id || req.params.id === "undefined") {
//       return res.status(400).json({ error: "Invalid session ID" });
//     }

//     const session = await WorkSession.findOne({
//       _id: req.params.id,
//       user: req.user._id,
//       status: "RUNNING",
//     });

//     if (!session) return res.status(404).json({ error: "Session not found" });

//     session.endTime = new Date();
//     session.status = "STOPPED";

//     const totalMs = session.endTime - session.startTime;
//     session.totalWorkMs = Math.max(totalMs - session.totalIdleMs, 0);

//     await session.save();

//     res.json(session);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });


// router.post("/idle/start", authUser, async (req, res) => {
//   try {
//     const { reason } = req.body;

//     const session = await WorkSession.findOne({
//       user: req.user._id,
//       status: "RUNNING",
//     });

//     if (!session) return res.status(404).json({ error: "No running session" });

//     const lastIdle = session.idleLogs.at(-1);

//     if (lastIdle && !lastIdle.to)
//       return res.status(400).json({ error: "Idle already active" });

//     session.idleLogs.push({
//       from: new Date(),
//       reason,
//     });
//     session.status = "PAUSED";
//     await session.save();
//     res.json(session);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.post("/idle/end", authUser, async (req, res) => {
//   try {
//     const session = await WorkSession.findOne({
//       user: req.user._id,
//       status: { $in: ["PAUSED", "RUNNING"] }, 
//     });

//     if (!session) return res.status(404).json({ error: "No running session" });

//     const idle = session.idleLogs.at(-1);

//     if (!idle || idle.to)
//       return res.status(400).json({ error: "No active idle" });

//     idle.to = new Date();

//     const idleMs = idle.to - idle.from;
//     session.totalIdleMs += idleMs;

//     session.status = "RUNNING"; // ✅ resume

//     await session.save();
//     res.json(session);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// router.post("/idle", authUser, async (req, res) => {
//   try {
//     const { sessionId, from, to, reason } = req.body;

//     const session = await WorkSession.findOne({
//       _id: sessionId,
//       user: req.user._id,
//     });

//     if (!session) return res.sendStatus(404);

//     const idleMs = new Date(to) - new Date(from);

//     session.idleLogs.push({ from, to, reason });
//     session.totalIdleMs += idleMs;

//     await session.save();

//     res.sendStatus(200);
//   } catch {
//     res.sendStatus(500);
//   }
// });


// router.get("/work/my", authUser, async (req, res) => {
//   try {
//     const session = await WorkSession.findOne({
//       user: req.user._id,
//       status: { $in: ["RUNNING", "PAUSED"] },
//     });

//     if (!session) return res.json(null);

//     const lastIdle = session.idleLogs.at(-1);

//     const idleActive = lastIdle && !lastIdle.to;

//     res.json({
//       session,
//       idle: idleActive,
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });



// router.get("/work", auth, async (req, res) => {
//   try {
//     const sessions = await WorkSession.find()
//       .populate({
//         path: "user",
//         select: "name role",
//         populate: {
//           path: "role",
//           select: "name",
//         },
//       })
//       .sort({ createdAt: -1 });

//     res.json(sessions);
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ error: err.message });
//   }
// });

// router.post("/work/cleanup", auth, async (req, res) => {
//   const now = new Date();

//   const deadSessions = await WorkSession.find({
//     status: "RUNNING",
//     lastSeenAt: { $lt: new Date(now - AUTO_STOP_LIMIT) },
//   });

//   for (const session of deadSessions) {
//     const idle = session.idleLogs.at(-1);

//     if (idle && !idle.to) {
//       idle.to = now;
//       const idleMs = Math.max(idle.to - idle.from, 0);
//       session.totalIdleMs += idleMs;
//     }

//     session.status = "STOPPED";
//     session.endTime = now;

//     const total = now - session.startTime;
//     session.totalWorkMs = Math.max(total - session.totalIdleMs, 0);

//     await session.save();
//   }

//   res.json({ cleaned: deadSessions.length });
// });

// router.get("/work/:id", authUser, async (req, res) => {
//   const session = await WorkSession.findOne({
//     _id: req.params.id,
//     user: req.user._id,
//   });

//   if (!session) return res.sendStatus(404);

//   res.json(session);
// });

// module.exports = router;



























// routes/workSession.js

const router = require("express").Router();
const WorkSession = require("../models/WorkSession");
const authUser = require("../middleware/chatAuth");
const { auth } = require("../middleware/auth.middleware");

// Sessions older than 5 minutes without a heartbeat are considered dead
const AUTO_STOP_LIMIT = 5 * 60 * 1000;

// ─── helper: close any open idle log and compute totals ───────────────────────
function finaliseSession(session, now) {
  const lastIdle = session.idleLogs.at(-1);

  if (lastIdle && !lastIdle.to) {
    lastIdle.to = now;
    const idleMs = Math.max(lastIdle.to - lastIdle.from, 0);
    session.totalIdleMs += idleMs;
  }

  session.status  = "STOPPED";
  session.endTime = now;

  const totalMs = now - session.startTime;
  session.totalWorkMs = Math.max(totalMs - session.totalIdleMs, 0);
}

// ═══════════════════════════════════════════════════════════════════════════
//  START WORK
// ═══════════════════════════════════════════════════════════════════════════
router.post("/work/start", authUser, async (req, res) => {
  try {
    // return existing active session if one exists (RUNNING or PAUSED)
    let session = await WorkSession.findOne({
      user:   req.user._id,
      status: { $in: ["RUNNING", "PAUSED"] },
    });

    if (session) {
      // only touch lastSeenAt for RUNNING sessions
      // do NOT flip PAUSED → RUNNING here
      if (session.status === "RUNNING") {
        session.lastSeenAt = new Date();
        await session.save();
      }
      return res.json(session);
    }

    // create a brand-new session
    session = await WorkSession.create({
      user:        req.user._id,
      startTime:   new Date(),
      lastSeenAt:  new Date(),
      status:      "RUNNING",
    });

    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  HEARTBEAT
//  Keeps the session alive. Works for both RUNNING and PAUSED states so a
//  paused employee's session is never auto-killed by the cleanup job.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/work/heartbeat", authUser, async (req, res) => {
  try {
    const session = await WorkSession.findOne({
      user:   req.user._id,
      status: { $in: ["RUNNING", "PAUSED"] },
    });

    if (!session) return res.sendStatus(204); // no active session — nothing to keep alive

    session.lastSeenAt = new Date();
    await session.save();

    res.json({ alive: true, sessionId: session._id, status: session.status });
  } catch {
    res.sendStatus(500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  STOP WORK
// ═══════════════════════════════════════════════════════════════════════════
router.post("/work/stop/:id", authUser, async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || id === "undefined") {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    // allow stopping both RUNNING and PAUSED sessions (e.g. End Day while paused)
    const session = await WorkSession.findOne({
      _id:    id,
      user:   req.user._id,
      status: { $in: ["RUNNING", "PAUSED"] },
    });

    if (!session) {
      return res.status(404).json({ error: "Session not found or already stopped" });
    }

    finaliseSession(session, new Date());
    await session.save();

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  IDLE — START (pause work)
// ═══════════════════════════════════════════════════════════════════════════
router.post("/idle/start", authUser, async (req, res) => {
  try {
    const { reason } = req.body;

    if (!reason?.trim()) {
      return res.status(400).json({ error: "Reason is required" });
    }

    const session = await WorkSession.findOne({
      user:   req.user._id,
      status: "RUNNING",
    });

    if (!session) {
      return res.status(404).json({ error: "No running session found" });
    }

    const lastIdle = session.idleLogs.at(-1);

    // prevent double idle start
    if (lastIdle && !lastIdle.to) {
      return res.status(400).json({ error: "Session is already paused" });
    }

    session.idleLogs.push({ from: new Date(), reason: reason.trim() });
    session.status     = "PAUSED";
    session.lastSeenAt = new Date();

    await session.save();
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  IDLE — END (resume work)
// ═══════════════════════════════════════════════════════════════════════════
router.post("/idle/end", authUser, async (req, res) => {
  try {
    // accept both PAUSED and RUNNING as a safety fallback
    const session = await WorkSession.findOne({
      user:   req.user._id,
      status: { $in: ["PAUSED", "RUNNING"] },
    });

    if (!session) {
      return res.status(404).json({ error: "No active session found" });
    }

    const lastIdle = session.idleLogs.at(-1);

    if (!lastIdle || lastIdle.to) {
      return res.status(400).json({ error: "No active idle period to end" });
    }

    lastIdle.to = new Date();

    const idleMs = Math.max(lastIdle.to - lastIdle.from, 0);
    session.totalIdleMs += idleMs;

    session.status     = "RUNNING";
    session.lastSeenAt = new Date();

    await session.save();
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  IDLE — MANUAL LOG (bulk insert, used by admin corrections)
// ═══════════════════════════════════════════════════════════════════════════
router.post("/idle", authUser, async (req, res) => {
  try {
    const { sessionId, from, to, reason } = req.body;

    if (!sessionId || !from || !to) {
      return res.status(400).json({ error: "sessionId, from, to are required" });
    }

    const session = await WorkSession.findOne({
      _id:  sessionId,
      user: req.user._id,
    });

    if (!session) return res.sendStatus(404);

    const idleMs = Math.max(new Date(to) - new Date(from), 0);

    session.idleLogs.push({ from, to, reason: reason || "" });
    session.totalIdleMs += idleMs;

    await session.save();
    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  MY SESSION — used by frontend on restore / mount
// ═══════════════════════════════════════════════════════════════════════════
router.get("/work/my", authUser, async (req, res) => {
  try {
    const session = await WorkSession.findOne({
      user:   req.user._id,
      status: { $in: ["RUNNING", "PAUSED"] },
    });

    // explicit null so frontend knows "no session" vs a server error
    if (!session) return res.json(null);

    const lastIdle  = session.idleLogs.at(-1);
    const idleActive = Boolean(lastIdle && !lastIdle.to);

    res.json({ session, idle: idleActive });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  ADMIN — list all sessions
// ═══════════════════════════════════════════════════════════════════════════
router.get("/work", auth, async (req, res) => {
  try {
    const sessions = await WorkSession.find()
      .populate({
        path:     "user",
        select:   "name role",
        populate: { path: "role", select: "name" },
      })
      .sort({ createdAt: -1 });

    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  ADMIN — cleanup dead sessions (no heartbeat for AUTO_STOP_LIMIT ms)
//  Call this from a cron job or a scheduler, e.g. every 5 minutes.
//  Only stops RUNNING sessions; PAUSED sessions are kept alive intentionally.
// ═══════════════════════════════════════════════════════════════════════════
router.post("/work/cleanup", auth, async (req, res) => {
  try {
    const now        = new Date();
    const cutoff     = new Date(now - AUTO_STOP_LIMIT);

    const deadSessions = await WorkSession.find({
      status:      "RUNNING",           // only kill RUNNING; leave PAUSED alone
      lastSeenAt:  { $lt: cutoff },
    });

    for (const session of deadSessions) {
      finaliseSession(session, now);
      await session.save();
    }

    res.json({ cleaned: deadSessions.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET single session by id
// ═══════════════════════════════════════════════════════════════════════════
router.get("/work/:id", authUser, async (req, res) => {
  try {
    const session = await WorkSession.findOne({
      _id:  req.params.id,
      user: req.user._id,
    });

    if (!session) return res.sendStatus(404);

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
