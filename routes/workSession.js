// routes/workSession.js

const router = require("express").Router();
const WorkSession = require("../models/WorkSession");
const authUser = require("../middleware/chatAuth");
const { auth, adminOnly } = require("../middleware/auth.middleware");

// const AUTO_STOP_LIMIT = 30 * 1000; // 1 minute safer window

const AUTO_STOP_LIMIT = 5 * 60 * 1000;

/* ================= START WORK ================= */




router.post("/work/start", authUser, async (req, res) => {
  try {
    let session = await WorkSession.findOne({
      user: req.user._id,
      status: "RUNNING",
    });

    if (session) {
      session.lastSeenAt = new Date();
      await session.save();
      return res.json(session);
    }

    session = await WorkSession.create({
      user: req.user._id,
      startTime: new Date(),
      lastSeenAt: new Date(),
      status: "RUNNING",
    });

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ================= HEARTBEAT ================= */

router.post("/work/heartbeat", authUser, async (req, res) => {
  try {
    const session = await WorkSession.findOne({
      user: req.user._id,
      status: "RUNNING",
    });

    if (!session) return res.sendStatus(204);

    session.lastSeenAt = new Date();

    
    await session.save();

    res.json({ alive: true, sessionId: session._id });
  } catch {
    res.sendStatus(500);
  }
});




router.post("/work/stop/:id", authUser, async (req, res) => {
  try {
    if (!req.params.id || req.params.id === "undefined") {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    const session = await WorkSession.findOne({
      _id: req.params.id,
      user: req.user._id,
      status: "RUNNING",
    });

    if (!session)
      return res.status(404).json({ error: "Session not found" });

    session.endTime = new Date();
    session.status = "STOPPED";

    const totalMs = session.endTime - session.startTime;
    session.totalWorkMs = Math.max(
      totalMs - session.totalIdleMs,
      0
    );

    await session.save();

    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ================= IDLE LOG ================= */

router.post("/idle/start", authUser, async (req, res) => {
  try {
    const { reason } = req.body;

    const session = await WorkSession.findOne({
      user: req.user._id,
      status: "RUNNING",
    });

    if (!session)
      return res.status(404).json({ error: "No running session" });

    const lastIdle = session.idleLogs.at(-1);

    // prevent double idle start
    if (lastIdle && !lastIdle.to)
      return res.status(400).json({ error: "Idle already active" });

    session.idleLogs.push({
      from: new Date(),
      reason,
    });

    await session.save();
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



router.post("/idle/end", authUser, async (req, res) => {
  try {
    const session = await WorkSession.findOne({
      user: req.user._id,
      status: "RUNNING",
    });

    if (!session)
      return res.status(404).json({ error: "No running session" });

    const idle = session.idleLogs.at(-1);

    if (!idle || idle.to)
      return res.status(400).json({ error: "No active idle" });

    idle.to = new Date();

    const idleMs = idle.to - idle.from;
    session.totalIdleMs += idleMs;

    await session.save();
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




router.post("/idle", authUser, async (req, res) => {
  try {
    const { sessionId, from, to, reason } = req.body;

    const session = await WorkSession.findOne({
      _id: sessionId,
      user: req.user._id,
    });

    if (!session) return res.sendStatus(404);

    const idleMs = new Date(to) - new Date(from);

    session.idleLogs.push({ from, to, reason });
    session.totalIdleMs += idleMs;

    await session.save();

    res.sendStatus(200);
  } catch {
    res.sendStatus(500);
  }
});

/* ================= MY RUNNING SESSION ================= */



router.get("/work/my", authUser, async (req, res) => {
  try {
    const session = await WorkSession.findOne({
      user: req.user._id,
      status: "RUNNING",
    });

    if (!session) return res.json(null);

    const lastIdle = session.idleLogs.at(-1);

    const idleActive =
      lastIdle && !lastIdle.to;

    res.json({
      session,
      idle: idleActive,
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/* ================= AUTO STOP + ADMIN VIEW ================= */

// router.get("/work", auth,  async (req, res) => {
//   const now = new Date();

//   const deadSessions = await WorkSession.find({
//     status: "RUNNING",
//     lastSeenAt: { $lt: new Date(now - AUTO_STOP_LIMIT) },
//   });
//   for (const session of deadSessions) {

//   const now = new Date();

//   const activeIdle = session.idleLogs.at(-1);

//   if (activeIdle && !activeIdle.to) {
//     activeIdle.to = now;

//     session.totalIdleMs +=
//       activeIdle.to - activeIdle.from;
//   }

//   session.status = "STOPPED";
//   session.endTime = now;

//   const totalMs = session.endTime - session.startTime;

//   session.totalWorkMs = Math.max(
//     totalMs - session.totalIdleMs,
//     0
//   );

//   await session.save();
// }

//   const sessions = await WorkSession.find()
//     .populate({
//       path: "user",
//       select: "name role",
//       populate: {
//         path: "role",
//         select: "name",
//       },
//     })
//     .sort({ createdAt: -1 });

//   res.json(sessions);
// });


//new

router.get("/work", auth, async (req, res) => {
  try {
    const sessions = await WorkSession.find()
      .populate({
        path: "user",
        select: "name role",
        populate: {
          path: "role",
          select: "name",
        },
      })
      .sort({ createdAt: -1 });

    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});




router.post("/work/cleanup", auth, async (req, res) => {
  const now = new Date();

  const deadSessions = await WorkSession.find({
    status: "RUNNING",
    // lastSeenAt: { $lt: new Date(now - 5 * 60 * 1000) }, // 5 min
    lastSeenAt: { $lt: new Date(now - AUTO_STOP_LIMIT) }

  });

  for (const session of deadSessions) {
    const idle = session.idleLogs.at(-1);

    if (idle && !idle.to) {
      idle.to = now;
      // session.totalIdleMs += idle.to - idle.from;
      const idleMs = Math.max(idle.to - idle.from, 0);
      session.totalIdleMs += idleMs;

    }

    session.status = "STOPPED";
    session.endTime = now;

    const total = now - session.startTime;
    session.totalWorkMs = Math.max(total - session.totalIdleMs, 0);

    await session.save();
  }

  res.json({ cleaned: deadSessions.length });
});



// router.get("/work/:id", authUser, async (req, res) => {
//   const session = await WorkSession.findOne({
//     _id: req.params.id,
//     user: req.user._id,
//   });

//   if (!session) return res.sendStatus(404);
// });


router.get("/work/:id", authUser, async (req, res) => {
  const session = await WorkSession.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!session) return res.sendStatus(404);

  res.json(session);
});


module.exports = router;
