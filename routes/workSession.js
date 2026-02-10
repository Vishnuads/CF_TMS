

// routes/workSession.js
const router = require("express").Router();
const WorkSession = require("../models/WorkSession");
const authUser = require("../middleware/chatAuth");
const {auth,adminOnly} = require("../middleware/auth.middleware")


const AUTO_STOP_LIMIT = 60 * 1000; // 1 minutes
// const AUTO_STOP_LIMIT = 2 * 60 * 1000;
/* ================= START WORK ================= */
   

router.post("/work/start", authUser, async (req, res) => {
  const existing = await WorkSession.findOne({
    user: req.user._id,
    status: "RUNNING",
  });

  if (existing) {
    existing.lastSeenAt = new Date();
    await existing.save();
    return res.json(existing);
  }

  const session = await WorkSession.create({
    user: req.user._id,
    startTime: new Date(),
    lastSeenAt: new Date(),
  });

  res.json(session);
});



router.post("/work/heartbeat", authUser, async (req, res) => {
  const session = await WorkSession.findOne({
    user: req.user._id,
    status: "RUNNING",
  });

  if (!session) return res.sendStatus(204);

  session.lastSeenAt = new Date();
  await session.save();

  res.sendStatus(200);
});




router.post("/work/stop/:id", authUser, async (req, res) => {
  const session = await WorkSession.findById(req.params.id);
  if (!session || session.status !== "RUNNING")
    return res.sendStatus(404);

  session.endTime = new Date();
  session.status = "STOPPED";

  const totalMs = session.endTime - session.startTime;
  session.totalWorkMs = Math.max(totalMs - session.totalIdleMs, 0);

  await session.save();
  res.json(session);
});







/* ================= IDLE LOG ================= */
router.post("/idle", authUser, async (req, res) => {
  const { sessionId, from, to, reason } = req.body;

  const session = await WorkSession.findById(sessionId);
  if (!session) return res.sendStatus(404);

  const idleMs = new Date(to) - new Date(from);

  session.idleLogs.push({ from, to, reason });
  session.totalIdleMs += idleMs;

  await session.save();
  res.sendStatus(200);
});



router.get("/work/my", auth, async (req, res) => {
  const session = await WorkSession.findOne({
    user: req.user._id,
    status: "RUNNING",
  });
  res.json(session);
});




router.get("/work/:id", authUser, async (req, res) => {
  const session = await WorkSession.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!session) return res.sendStatus(404);
  res.json(session);
});



router.get("/work", auth,  async (req, res) => {
  const now = new Date();

  // 🔴 AUTO STOP DEAD SESSIONS
  await WorkSession.updateMany(
    {
      status: "RUNNING",
      lastSeenAt: { $lt: new Date(now - AUTO_STOP_LIMIT) },
    },
    {
      $set: {
        status: "STOPPED",
        endTime: now,
      },
    }
  );

  const sessions = await WorkSession.find()
    // .populate("user", "name email")
    // .populate("user.role", "name")
 
      .populate({
    path: "user",
    select: "name role",
    populate: {
      path: "role",
      select: "name"
    }
  })
  .sort({ createdAt: -1 });

  res.json(sessions);
});




module.exports = router;























