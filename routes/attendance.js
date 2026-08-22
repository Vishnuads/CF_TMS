// const router = require("express").Router();
// const Attendance = require("../models/Attendance");
// const User = require("../models/User");
// const { auth, adminOnly } = require("../middleware/auth.middleware");

// function monthRange(month, year) {
//   const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
//   const end = new Date(year, month, 0, 23, 59, 59, 999);
//   return { start, end };
// }

// // ─── GET /api/attendance/me ───────────────────────────────────────────────
// // Current logged-in user's attendance for a given month
// router.get("/me", auth, async (req, res) => {
//   try {
//     const userId = req.user?._id || req.user?.id;
//     const month = parseInt(req.query.month) || new Date().getMonth() + 1;
//     const year = parseInt(req.query.year) || new Date().getFullYear();
//     const { start, end } = monthRange(month, year);

//     const records = await Attendance.find({
//       user: userId,
//       date: { $gte: start, $lte: end },
//     }).sort({ date: 1 });

//     res.json({ success: true, data: records });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// // ─── GET /api/attendance/user/:userId ─────────────────────────────────────
// // Admin: any user's attendance for a given month
// router.get("/user/:userId", auth,  async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const month = parseInt(req.query.month) || new Date().getMonth() + 1;
//     const year = parseInt(req.query.year) || new Date().getFullYear();
//     const { start, end } = monthRange(month, year);

//     const user = await User.findById(userId)
//       .select("name email")
//       .populate("role", "name");

//     if (!user) {
//       return res.status(404).json({ success: false, message: "User not found" });
//     }

//     const records = await Attendance.find({
//       user: userId,
//       date: { $gte: start, $lte: end },
//     }).sort({ date: 1 });

//     res.json({ success: true, data: { user, records } });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });



// // ─── GET /api/attendance/live-status ──────────────────────────────────────
// // Everyone with an open session today (checked in, not yet checked out)
// router.get("/live-status", auth,  async (req, res) => {
//   try {
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);

//     const records = await Attendance.find({ date: today })
//       .populate("user", "name email")
//       .lean();

//     const map = {};

//     records.forEach((rec) => {
//       if (!rec.user) return;
//       const openSession = [...(rec.sessions || [])].reverse().find((s) => !s.logoutTime);
//       if (openSession) {
//         map[String(rec.user._id)] = {
//           name: rec.user.name,
//           loginTime: openSession.loginTime,
//           totalDuration: rec.totalDuration || 0,
//         };
//       }
//     });

//     res.json({ success: true, data: map });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// });

// module.exports = router;
























const router = require("express").Router();
const express = require("express");
const jwt = require("jsonwebtoken");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const Session = require("../models/Session");
const { auth, adminOnly } = require("../middleware/auth.middleware");
const { recordCheckIn, closeOpenSessionNow } = require("../controllers/attendanceCleanup");
const socket = require("../socket");

function monthRange(month, year) {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 0, 23, 59, 59, 999);
  return { start, end };
}

// ─── POST /api/attendance/checkin ─────────────────────────────────────────
// Called on app load when a VALID EXISTING token is present but no fresh
// password login happened (tab reopened this morning). Safe to call
// repeatedly — recordCheckIn is idempotent while a session is already open.
router.post("/checkin", auth, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    if (!userId) return res.status(401).json({ success: false, message: "Unauthorized" });

    const attendance = await recordCheckIn(userId, req.user?.name);
    res.json({ success: true, data: attendance });
  } catch (err) {
    console.error("Checkin error:", err.message, err.stack);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── POST /api/attendance/beacon-logout ───────────────────────────────────
// Fired via navigator.sendBeacon on beforeunload/pagehide — the tab is
// closing RIGHT NOW. sendBeacon can't set headers, so the token travels in
// the body instead of Authorization.
router.post("/beacon-logout", express.json(), async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.sendStatus(400);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    Session.updateOne({ token }, { isValid: false }).catch(() => {});

    await closeOpenSessionNow(userId, "tab-closed");

    res.sendStatus(204);
  } catch (err) {
    console.error("Beacon logout error:", err.message);
    res.sendStatus(400);
  }
});

// ─── GET /api/attendance/me ────────────────────────────────────────────────
router.get("/me", auth, async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const { start, end } = monthRange(month, year);

    const records = await Attendance.find({
      user: userId,
      date: { $gte: start, $lte: end },
    }).sort({ date: 1 });

    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/attendance/user/:userId ──────────────────────────────────────
router.get("/user/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const { start, end } = monthRange(month, year);

    const user = await User.findById(userId).select("name email").populate("role", "name");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const records = await Attendance.find({
      user: userId,
      date: { $gte: start, $lte: end },
    }).sort({ date: 1 });

    res.json({ success: true, data: { user, records } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ─── GET /api/attendance/live-status ──────────────────────────────────────
// Everyone with an open session today AND a currently-connected socket.
// This second check is what fixes "still active" showing for people whose
// browser/tab died without any clean signal reaching the server — if
// there's no live socket in their `user:<id>` room, they don't count as
// live even though the DB record still shows an open session (which the
// sweep job / their next check-in will eventually close out).
router.get("/live-status", auth, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const records = await Attendance.find({ date: today })
      .populate("user", "name email")
      .lean();

    let io = null;
    try {
      io = socket.getIO();
    } catch {
      // socket not initialized — fall back to trusting the DB alone
    }

    const map = {};

    records.forEach((rec) => {
      if (!rec.user) return;
      const openSession = [...(rec.sessions || [])].reverse().find((s) => !s.logoutTime);
      if (!openSession) return;

      const userId = String(rec.user._id);

      if (io) {
        const room = io.sockets.adapter.rooms.get(`user:${userId}`);
        const isConnected = Boolean(room && room.size > 0);
        if (!isConnected) return; // DB says open, but nobody's actually connected — skip
      }

      map[userId] = {
        name: rec.user.name,
        loginTime: openSession.loginTime,
        totalDuration: rec.totalDuration || 0,
      };
    });

    res.json({ success: true, data: map });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;