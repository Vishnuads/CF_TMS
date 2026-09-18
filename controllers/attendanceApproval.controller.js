
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const socket = require("../socket");

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ============================================================
// Shared helper — is this user an Admin? Admins are exempt from
// the entire missing-logout / approval workflow: never blocked,
// never listed for approval, never counted in history.
// ============================================================
async function isAdminUser(userId) {
  const user = await User.findById(userId).populate("role", "name");
  return user?.role?.name === "ADMIN";
}

// ============================================================
// GET /api/attendance/pending-approval/me
// ============================================================

exports.getMyPendingApproval = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    // NEW — admins are never blocked by this guard.
    if (await isAdminUser(userId)) {
      return res.json({ success: true, blocked: false });
    }

    const today = startOfDay();

    const record = await Attendance.findOne({
      user: userId,
      date: { $lt: today },
      needsApproval: true,
    }).sort({ date: -1 });

    if (!record) {
      return res.json({ success: true, blocked: false });
    }

    const openSession = [...record.sessions]
      .reverse()
      .find((s) => !s.logoutTime);

    return res.json({
      success: true,
      blocked: true,
      data: {
        date: record.date,
        loginTime: openSession?.loginTime || record.loginTime,
      },
    });
  } catch (err) {
    console.error("getMyPendingApproval error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// GET /api/attendance/pending-approvals   (ADMIN)
// ============================================================

exports.listPendingApprovals = async (req, res) => {
  try {
    const records = await Attendance.find({ needsApproval: true })
      .populate({ path: "user", select: "name email role", populate: { path: "role", select: "name" } })
      .sort({ date: 1 })
      .lean();

    const rows = records
      .map((record) => {
        if (!record.user) return null;

        // NEW — never surface an admin's own record in this table.
        if (record.user.role?.name === "ADMIN") return null;

        const openSession = [...(record.sessions || [])]
          .reverse()
          .find((s) => !s.logoutTime);

        if (!openSession) return null;

        return {
          attendanceId: record._id,
          userId: record.user._id,
          name: record.user.name,
          email: record.user.email,
          date: record.date,
          loginTime: openSession.loginTime,
          sessionId: openSession._id,
        };
      })
      .filter(Boolean);

    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("listPendingApprovals error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// POST /api/attendance/approve-logout/:userId   (ADMIN)
// ============================================================











// FIX: fixed logout time credited when Admin approves a missed
// logout, instead of leaving logoutTime blank (null). Change the
// hour/minute here if the policy time ever changes. Place this pair
// near the top of the file (outside the function) alongside your
// other helpers.

// const APPROVED_LOGOUT_HOUR = 18;   // 6 PM
// const APPROVED_LOGOUT_MINUTE = 30; // :30 → 6:30 PM

// function getApprovedLogoutTime(baseDate) {
//   const d = new Date(baseDate);
//   d.setHours(APPROVED_LOGOUT_HOUR, APPROVED_LOGOUT_MINUTE, 0, 0);
//   return d;
// }

// exports.approvePreviousLogout = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const adminId = req.user?._id || req.user?.id;

//     // NEW — defensive guard: an admin's own session should never
//     // reach this endpoint (it's excluded upstream), but block it
//     // explicitly too in case it's ever called directly.
//     if (await isAdminUser(userId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Admin accounts are exempt from the approval workflow",
//       });
//     }

//     const record = await Attendance.findOne({
//       user: userId,
//       needsApproval: true,
//     }).sort({ date: -1 });

//     if (!record) {
//       return res.status(404).json({
//         success: false,
//         message: "No pending approval found for this user",
//       });
//     }

//     let openSessionIndex = -1;
//     for (let i = record.sessions.length - 1; i >= 0; i--) {
//       if (!record.sessions[i].logoutTime) {
//         openSessionIndex = i;
//         break;
//       }
//     }

//     if (openSessionIndex === -1) {
//       record.needsApproval = false;
//       await record.save();
//       return res.status(400).json({
//         success: false,
//         message: "No open session found — nothing to approve",
//       });
//     }

//     const openSession = record.sessions[openSessionIndex];
//     const loginTime = openSession.loginTime;

//     // FIX: previously logoutTime = null and duration = 0 (checkout
//     // left blank). Now it credits a fixed 6:30 PM logout time on the
//     // session's own day, so the session gets a real checkout and a
//     // real duration in the DB.
//     const baseDate = loginTime || record.date || new Date();
//     const approvedLogoutTime = getApprovedLogoutTime(baseDate);

//     // Guard against a login that happened AFTER 6:30 PM (rare edge
//     // case) — fall back to the login time itself so duration is 0
//     // instead of negative.
//     const finalLogoutTime =
//       loginTime && approvedLogoutTime < new Date(loginTime)
//         ? new Date(loginTime)
//         : approvedLogoutTime;

//     const durationMs = loginTime
//       ? Math.max(0, finalLogoutTime.getTime() - new Date(loginTime).getTime())
//       : 0;
//     // NOTE: stored in minutes — change this line if your Attendance
//     // schema expects seconds or milliseconds instead.
//     const durationMinutes = Math.round(durationMs / 60000);

//     record.sessions[openSessionIndex].logoutTime = finalLogoutTime;
//     record.sessions[openSessionIndex].duration = durationMinutes;
//     record.sessions[openSessionIndex].autoClosed = false;
//     record.sessions[openSessionIndex].closeReason = "admin-approved";
//     record.sessions[openSessionIndex].logoutType = "ADMIN_APPROVED";
//     record.sessions[openSessionIndex].approvedBy = adminId;
//     record.sessions[openSessionIndex].approvedAt = new Date();

//     record.logoutTime = finalLogoutTime;
//     record.needsApproval = false;

//     record.markModified("sessions");
//     await record.save();

//     try {
//       const io = socket.getIO();
//       io.to(`user:${userId}`).emit("attendance-approved", {
//         message:
//           "Your previous attendance has been approved by Admin, with checkout recorded at 6:30 PM. Please login again to continue working.",
//         logoutTime: finalLogoutTime,
//         approvedAt: record.sessions[openSessionIndex].approvedAt,
//       });
//       io.to(`user:${userId}`).emit("force-logout", {
//         reason: "attendance-approved",
//       });
//       io.emit("pending-approval-resolved", { userId });
//     } catch (err) {
//       console.error("Socket emit (approve-logout) failed:", err.message);
//     }

//     res.json({
//       success: true,
//       message: "Previous session approved — logout time set to 6:30 PM",
//       data: {
//         logoutTime: finalLogoutTime,
//         duration: durationMinutes,
//         logoutType: "ADMIN_APPROVED",
//         approvedAt: record.sessions[openSessionIndex].approvedAt,
//       },
//     });
//   } catch (err) {
//     console.error("approvePreviousLogout error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };



exports.approvePreviousLogout = async (req, res) => {
  try {
    const { userId } = req.params;
    const adminId = req.user?._id || req.user?.id;

    // NEW — defensive guard: an admin's own session should never
    // reach this endpoint (it's excluded upstream), but block it
    // explicitly too in case it's ever called directly.
    if (await isAdminUser(userId)) {
      return res.status(400).json({
        success: false,
        message: "Admin accounts are exempt from the approval workflow",
      });
    }

    const record = await Attendance.findOne({
      user: userId,
      needsApproval: true,
    }).sort({ date: -1 });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: "No pending approval found for this user",
      });
    }

    let openSessionIndex = -1;
    for (let i = record.sessions.length - 1; i >= 0; i--) {
      if (!record.sessions[i].logoutTime) {
        openSessionIndex = i;
        break;
      }
    }

    if (openSessionIndex === -1) {
      record.needsApproval = false;
      await record.save();
      return res.status(400).json({
        success: false,
        message: "No open session found — nothing to approve",
      });
    }

    record.sessions[openSessionIndex].logoutTime = null;
    record.sessions[openSessionIndex].duration = 0;
    record.sessions[openSessionIndex].autoClosed = false;
    record.sessions[openSessionIndex].closeReason = "admin-approved";
    record.sessions[openSessionIndex].logoutType = "ADMIN_APPROVED";
    record.sessions[openSessionIndex].approvedBy = adminId;
    record.sessions[openSessionIndex].approvedAt = new Date();

    record.logoutTime = null;
    record.needsApproval = false;

    record.markModified("sessions");
    await record.save();

    try {
      const io = socket.getIO();
      io.to(`user:${userId}`).emit("attendance-approved", {
        message:
          "Your previous attendance has been approved by Admin. Please login again to continue working.",
        approvedAt: record.sessions[openSessionIndex].approvedAt,
      });
      io.to(`user:${userId}`).emit("force-logout", {
        reason: "attendance-approved",
      });
      io.emit("pending-approval-resolved", { userId });
    } catch (err) {
      console.error("Socket emit (approve-logout) failed:", err.message);
    }

    res.json({
      success: true,
      message: "Previous session approved (checkout left blank)",
      data: {
        logoutTime: null,
        logoutType: "ADMIN_APPROVED",
        approvedAt: record.sessions[openSessionIndex].approvedAt,
      },
    });
  } catch (err) {
    console.error("approvePreviousLogout error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};


// ============================================================
// GET /api/attendance/missing-logout-summary   (ADMIN)
// ============================================================

exports.getMissingLogoutSummary = async (req, res) => {
  try {
    const records = await Attendance.find({
      $or: [
        { needsApproval: true },
        { "sessions.logoutType": "ADMIN_APPROVED" },
      ],
    })
      .populate({ path: "user", select: "name email role", populate: { path: "role", select: "name" } })
      .sort({ date: 1 })
      .lean();

    const byUser = new Map();

    for (const record of records) {
      if (!record.user) continue;

      // NEW — skip admin accounts entirely.
      if (record.user.role?.name === "ADMIN") continue;

      const sessions = Array.isArray(record.sessions) ? record.sessions : [];

      for (const session of sessions) {
        const isPending = record.needsApproval && !session.logoutTime;
        const isApproved = session.logoutType === "ADMIN_APPROVED";

        if (!isPending && !isApproved) continue;

        const userId = String(record.user._id);

        if (!byUser.has(userId)) {
          byUser.set(userId, {
            userId,
            name: record.user.name,
            email: record.user.email,
            totalCount: 0,
            pendingCount: 0,
            approvedCount: 0,
            incidents: [],
          });
        }

        const entry = byUser.get(userId);

        entry.totalCount += 1;
        if (isPending) entry.pendingCount += 1;
        if (isApproved) entry.approvedCount += 1;

        entry.incidents.push({
          date: record.date,
          loginTime: session.loginTime,
          status: isPending ? "PENDING" : "APPROVED",
          approvedBy: session.approvedBy || null,
          approvedAt: session.approvedAt || null,
        });
      }
    }

    const summary = Array.from(byUser.values()).sort(
      (a, b) => b.totalCount - a.totalCount
    );

    res.json({ success: true, data: summary });
  } catch (err) {
    console.error("getMissingLogoutSummary error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// ============================================================
// GET /api/attendance/missing-logout/:userId   (ADMIN)
// ============================================================

exports.getMissingLogoutForUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // NEW — an admin has no history under this feature.
    if (await isAdminUser(userId)) {
      return res.json({
        success: true,
        data: { totalCount: 0, pendingCount: 0, approvedCount: 0, incidents: [] },
      });
    }

    const records = await Attendance.find({
      user: userId,
      $or: [
        { needsApproval: true },
        { "sessions.logoutType": "ADMIN_APPROVED" },
      ],
    })
      .sort({ date: -1 })
      .lean();

    const incidents = [];

    for (const record of records) {
      const sessions = Array.isArray(record.sessions) ? record.sessions : [];

      for (const session of sessions) {
        const isPending = record.needsApproval && !session.logoutTime;
        const isApproved = session.logoutType === "ADMIN_APPROVED";

        if (!isPending && !isApproved) continue;

        incidents.push({
          date: record.date,
          loginTime: session.loginTime,
          status: isPending ? "PENDING" : "APPROVED",
          approvedBy: session.approvedBy || null,
          approvedAt: session.approvedAt || null,
        });
      }
    }

    res.json({
      success: true,
      data: {
        totalCount: incidents.length,
        pendingCount: incidents.filter((i) => i.status === "PENDING").length,
        approvedCount: incidents.filter((i) => i.status === "APPROVED").length,
        incidents,
      },
    });
  } catch (err) {
    console.error("getMissingLogoutForUser error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};



























//new






// const Attendance = require("../models/Attendance");
// const User = require("../models/User");
// const socket = require("../socket");

// function startOfDay(d = new Date()) {
//   const x = new Date(d);
//   x.setHours(0, 0, 0, 0);
//   return x;
// }

// // ============================================================
// // Shared helper — is this user an Admin? Admins are exempt from
// // the entire missing-logout / approval workflow: never blocked,
// // never listed for approval, never counted in history.
// // ============================================================
// async function isAdminUser(userId) {
//   const user = await User.findById(userId).populate("role", "name");
//   return user?.role?.name === "ADMIN";
// }

// // ============================================================
// // GET /api/attendance/pending-approval/me
// // ============================================================

// // exports.getMyPendingApproval = async (req, res) => {
// //   try {
// //     const userId = req.user?._id || req.user?.id;

// //     // NEW — admins are never blocked by this guard.
// //     if (await isAdminUser(userId)) {
// //       return res.json({ success: true, blocked: false });
// //     }

// //     const today = startOfDay();

// //     const record = await Attendance.findOne({
// //       user: userId,
// //       date: { $lt: today },
// //       needsApproval: true,
// //     }).sort({ date: -1 });

// //     if (!record) {
// //       return res.json({ success: true, blocked: false });
// //     }

// //     const openSession = [...record.sessions]
// //       .reverse()
// //       .find((s) => !s.logoutTime);

// //     return res.json({
// //       success: true,
// //       blocked: true,
// //       data: {
// //         date: record.date,
// //         loginTime: openSession?.loginTime || record.loginTime,
// //       },
// //     });
// //   } catch (err) {
// //     console.error("getMyPendingApproval error:", err);
// //     res.status(500).json({ success: false, message: err.message });
// //   }
// // };



// exports.getMyPendingApproval = async (req, res) => {
//   try {
//     const userId = req.user?._id || req.user?.id;

//     // Admin users are never blocked
//     if (await isAdminUser(userId)) {
//       return res.json({ success: true, blocked: false });
//     }

//     const today = startOfDay();

//     const record = await Attendance.findOne({
//       user: userId,
//       date: { $lt: today },
//       needsApproval: true,
//     }).sort({ date: -1 });

//     if (!record) {
//       return res.json({ success: true, blocked: false });
//     }

//     const sessions = record.sessions || [];

//     // Only the LAST session can require approval
//     const lastSession = sessions[sessions.length - 1];

//     if (!lastSession || lastSession.logoutTime) {
//       record.needsApproval = false;
//       await record.save();

//       return res.json({
//         success: true,
//         blocked: false,
//       });
//     }

//     // Already approved → allow login
//     if (lastSession.logoutType === "ADMIN_APPROVED") {
//       record.needsApproval = false;
//       await record.save();

//       return res.json({
//         success: true,
//         blocked: false,
//       });
//     }

//     return res.json({
//       success: true,
//       blocked: true,
//       data: {
//         date: record.date,
//         loginTime: lastSession.loginTime,
//       },
//     });
//   } catch (err) {
//     console.error("getMyPendingApproval error:", err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };


// // ============================================================
// // GET /api/attendance/pending-approvals   (ADMIN)
// // ============================================================

// exports.listPendingApprovals = async (req, res) => {
//   try {
//     const records = await Attendance.find({ needsApproval: true })
//       .populate({ path: "user", select: "name email role", populate: { path: "role", select: "name" } })
//       .sort({ date: 1 })
//       .lean();

//     const rows = records
//       .map((record) => {
//         if (!record.user) return null;

//         // NEW — never surface an admin's own record in this table.
//         if (record.user.role?.name === "ADMIN") return null;

//         // const openSession = [...(record.sessions || [])]
//         //   .reverse()
//         //   .find((s) => !s.logoutTime);

//         // if (!openSession) return null;

//         // return {
//         //   attendanceId: record._id,
//         //   userId: record.user._id,
//         //   name: record.user.name,
//         //   email: record.user.email,
//         //   date: record.date,
//         //   loginTime: openSession.loginTime,
//         //   sessionId: openSession._id,
//         // };




//         const sessions = record.sessions || [];

// // only last session without logout
// const lastSession = sessions[sessions.length - 1];

// if (!lastSession || lastSession.logoutTime) return null;

// return {
//   attendanceId: record._id,
//   userId: record.user._id,
//   name: record.user.name,
//   email: record.user.email,
//   date: record.date,
//   loginTime: lastSession.loginTime,
//   sessionId: lastSession._id,
// };


//       })
//       .filter(Boolean);

//     res.json({ success: true, data: rows });
//   } catch (err) {
//     console.error("listPendingApprovals error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ============================================================
// // POST /api/attendance/approve-logout/:userId   (ADMIN)
// // ============================================================











// // FIX: fixed logout time credited when Admin approves a missed
// // logout, instead of leaving logoutTime blank (null). Change the
// // hour/minute here if the policy time ever changes. Place this pair
// // near the top of the file (outside the function) alongside your
// // other helpers.

// // const APPROVED_LOGOUT_HOUR = 18;   // 6 PM
// // const APPROVED_LOGOUT_MINUTE = 30; // :30 → 6:30 PM

// // function getApprovedLogoutTime(baseDate) {
// //   const d = new Date(baseDate);
// //   d.setHours(APPROVED_LOGOUT_HOUR, APPROVED_LOGOUT_MINUTE, 0, 0);
// //   return d;
// // }

// // exports.approvePreviousLogout = async (req, res) => {
// //   try {
// //     const { userId } = req.params;
// //     const adminId = req.user?._id || req.user?.id;

// //     // NEW — defensive guard: an admin's own session should never
// //     // reach this endpoint (it's excluded upstream), but block it
// //     // explicitly too in case it's ever called directly.
// //     if (await isAdminUser(userId)) {
// //       return res.status(400).json({
// //         success: false,
// //         message: "Admin accounts are exempt from the approval workflow",
// //       });
// //     }

// //     const record = await Attendance.findOne({
// //       user: userId,
// //       needsApproval: true,
// //     }).sort({ date: -1 });

// //     if (!record) {
// //       return res.status(404).json({
// //         success: false,
// //         message: "No pending approval found for this user",
// //       });
// //     }

// //     let openSessionIndex = -1;
// //     for (let i = record.sessions.length - 1; i >= 0; i--) {
// //       if (!record.sessions[i].logoutTime) {
// //         openSessionIndex = i;
// //         break;
// //       }
// //     }

// //     if (openSessionIndex === -1) {
// //       record.needsApproval = false;
// //       await record.save();
// //       return res.status(400).json({
// //         success: false,
// //         message: "No open session found — nothing to approve",
// //       });
// //     }

// //     const openSession = record.sessions[openSessionIndex];
// //     const loginTime = openSession.loginTime;

// //     // FIX: previously logoutTime = null and duration = 0 (checkout
// //     // left blank). Now it credits a fixed 6:30 PM logout time on the
// //     // session's own day, so the session gets a real checkout and a
// //     // real duration in the DB.
// //     const baseDate = loginTime || record.date || new Date();
// //     const approvedLogoutTime = getApprovedLogoutTime(baseDate);

// //     // Guard against a login that happened AFTER 6:30 PM (rare edge
// //     // case) — fall back to the login time itself so duration is 0
// //     // instead of negative.
// //     const finalLogoutTime =
// //       loginTime && approvedLogoutTime < new Date(loginTime)
// //         ? new Date(loginTime)
// //         : approvedLogoutTime;

// //     const durationMs = loginTime
// //       ? Math.max(0, finalLogoutTime.getTime() - new Date(loginTime).getTime())
// //       : 0;
// //     // NOTE: stored in minutes — change this line if your Attendance
// //     // schema expects seconds or milliseconds instead.
// //     const durationMinutes = Math.round(durationMs / 60000);

// //     record.sessions[openSessionIndex].logoutTime = finalLogoutTime;
// //     record.sessions[openSessionIndex].duration = durationMinutes;
// //     record.sessions[openSessionIndex].autoClosed = false;
// //     record.sessions[openSessionIndex].closeReason = "admin-approved";
// //     record.sessions[openSessionIndex].logoutType = "ADMIN_APPROVED";
// //     record.sessions[openSessionIndex].approvedBy = adminId;
// //     record.sessions[openSessionIndex].approvedAt = new Date();

// //     record.logoutTime = finalLogoutTime;
// //     record.needsApproval = false;

// //     record.markModified("sessions");
// //     await record.save();

// //     try {
// //       const io = socket.getIO();
// //       io.to(`user:${userId}`).emit("attendance-approved", {
// //         message:
// //           "Your previous attendance has been approved by Admin, with checkout recorded at 6:30 PM. Please login again to continue working.",
// //         logoutTime: finalLogoutTime,
// //         approvedAt: record.sessions[openSessionIndex].approvedAt,
// //       });
// //       io.to(`user:${userId}`).emit("force-logout", {
// //         reason: "attendance-approved",
// //       });
// //       io.emit("pending-approval-resolved", { userId });
// //     } catch (err) {
// //       console.error("Socket emit (approve-logout) failed:", err.message);
// //     }

// //     res.json({
// //       success: true,
// //       message: "Previous session approved — logout time set to 6:30 PM",
// //       data: {
// //         logoutTime: finalLogoutTime,
// //         duration: durationMinutes,
// //         logoutType: "ADMIN_APPROVED",
// //         approvedAt: record.sessions[openSessionIndex].approvedAt,
// //       },
// //     });
// //   } catch (err) {
// //     console.error("approvePreviousLogout error:", err);
// //     res.status(500).json({ success: false, message: err.message });
// //   }
// // };



// exports.approvePreviousLogout = async (req, res) => {
//   try {
//     const { userId } = req.params;
//     const adminId = req.user?._id || req.user?.id;

//     // NEW — defensive guard: an admin's own session should never
//     // reach this endpoint (it's excluded upstream), but block it
//     // explicitly too in case it's ever called directly.
//     if (await isAdminUser(userId)) {
//       return res.status(400).json({
//         success: false,
//         message: "Admin accounts are exempt from the approval workflow",
//       });
//     }

//     const record = await Attendance.findOne({
//       user: userId,
//       needsApproval: true,
//     }).sort({ date: -1 });

//     if (!record) {
//       return res.status(404).json({
//         success: false,
//         message: "No pending approval found for this user",
//       });
//     }

//     let openSessionIndex = -1;
//     for (let i = record.sessions.length - 1; i >= 0; i--) {
//       if (!record.sessions[i].logoutTime) {
//         openSessionIndex = i;
//         break;
//       }
//     }

//     if (openSessionIndex === -1) {
//       record.needsApproval = false;
//       await record.save();
//       return res.status(400).json({
//         success: false,
//         message: "No open session found — nothing to approve",
//       });
//     }

//     record.sessions[openSessionIndex].logoutTime = null;
//     record.sessions[openSessionIndex].duration = 0;
//     record.sessions[openSessionIndex].autoClosed = false;
//     record.sessions[openSessionIndex].closeReason = "admin-approved";
//     record.sessions[openSessionIndex].logoutType = "ADMIN_APPROVED";
//     record.sessions[openSessionIndex].approvedBy = adminId;
//     record.sessions[openSessionIndex].approvedAt = new Date();

//     record.logoutTime = null;
//     record.needsApproval = false;

//     record.markModified("sessions");
//     await record.save();

//     try {
//       const io = socket.getIO();
//       io.to(`user:${userId}`).emit("attendance-approved", {
//         message:
//           "Your previous attendance has been approved by Admin. Please login again to continue working.",
//         approvedAt: record.sessions[openSessionIndex].approvedAt,
//       });
//       io.to(`user:${userId}`).emit("force-logout", {
//         reason: "attendance-approved",
//       });
//       io.emit("pending-approval-resolved", { userId });
//     } catch (err) {
//       console.error("Socket emit (approve-logout) failed:", err.message);
//     }

//     res.json({
//       success: true,
//       message: "Previous session approved (checkout left blank)",
//       data: {
//         logoutTime: null,
//         logoutType: "ADMIN_APPROVED",
//         approvedAt: record.sessions[openSessionIndex].approvedAt,
//       },
//     });
//   } catch (err) {
//     console.error("approvePreviousLogout error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };


// // ============================================================
// // GET /api/attendance/missing-logout-summary   (ADMIN)
// // ============================================================

// // exports.getMissingLogoutSummary = async (req, res) => {
// //   try {
// //     const records = await Attendance.find({
// //       $or: [
// //         { needsApproval: true },
// //         { "sessions.logoutType": "ADMIN_APPROVED" },
// //       ],
// //     })
// //       .populate({ path: "user", select: "name email role", populate: { path: "role", select: "name" } })
// //       .sort({ date: 1 })
// //       .lean();

// //     const byUser = new Map();

// //     for (const record of records) {
// //       if (!record.user) continue;

// //       // NEW — skip admin accounts entirely.
// //       if (record.user.role?.name === "ADMIN") continue;

// //       const sessions = Array.isArray(record.sessions) ? record.sessions : [];

// //       for (const session of sessions) {
// //         const isPending = record.needsApproval && !session.logoutTime;
// //         const isApproved = session.logoutType === "ADMIN_APPROVED";

// //         if (!isPending && !isApproved) continue;

// //         const userId = String(record.user._id);

// //         if (!byUser.has(userId)) {
// //           byUser.set(userId, {
// //             userId,
// //             name: record.user.name,
// //             email: record.user.email,
// //             totalCount: 0,
// //             pendingCount: 0,
// //             approvedCount: 0,
// //             incidents: [],
// //           });
// //         }

// //         const entry = byUser.get(userId);

// //         entry.totalCount += 1;
// //         if (isPending) entry.pendingCount += 1;
// //         if (isApproved) entry.approvedCount += 1;

// //         entry.incidents.push({
// //           date: record.date,
// //           loginTime: session.loginTime,
// //           status: isPending ? "PENDING" : "APPROVED",
// //           approvedBy: session.approvedBy || null,
// //           approvedAt: session.approvedAt || null,
// //         });
// //       }
// //     }

// //     const summary = Array.from(byUser.values()).sort(
// //       (a, b) => b.totalCount - a.totalCount
// //     );

// //     res.json({ success: true, data: summary });
// //   } catch (err) {
// //     console.error("getMissingLogoutSummary error:", err);
// //     res.status(500).json({ success: false, message: err.message });
// //   }
// // };




// exports.getMissingLogoutSummary = async (req, res) => {
//   try {
//     const records = await Attendance.find({
//       $or: [
//         { needsApproval: true },
//         { "sessions.logoutType": "ADMIN_APPROVED" },
//       ],
//     })
//       .populate({
//         path: "user",
//         select: "name email role",
//         populate: { path: "role", select: "name" },
//       })
//       .sort({ date: -1 })
//       .lean();

//     const byUser = new Map();

//     for (const record of records) {
//       if (!record.user) continue;

//       if (record.user.role?.name === "ADMIN") continue;

//       const sessions = record.sessions || [];

//       for (let index = 0; index < sessions.length; index++) {
//         const session = sessions[index];

//         // Only LAST session without logout = Pending
//         const isPending =
//           record.needsApproval &&
//           index === sessions.length - 1 &&
//           !session.logoutTime;

//         // Already approved missing logout
//         const isApproved =
//           session.logoutType === "ADMIN_APPROVED";

//         if (!isPending && !isApproved) continue;

//         const userId = String(record.user._id);

//         if (!byUser.has(userId)) {
//           byUser.set(userId, {
//             userId,
//             name: record.user.name,
//             email: record.user.email,
//             totalCount: 0,
//             pendingCount: 0,
//             approvedCount: 0,
//             incidents: [],
//           });
//         }

//         const entry = byUser.get(userId);

//         entry.totalCount++;

//         if (isPending) entry.pendingCount++;
//         if (isApproved) entry.approvedCount++;

//         entry.incidents.push({
//           date: record.date,
//           loginTime: session.loginTime,
//           status: isPending ? "PENDING" : "APPROVED",
//           approvedBy: session.approvedBy || null,
//           approvedAt: session.approvedAt || null,
//         });
//       }
//     }

//     const summary = [...byUser.values()].sort(
//       (a, b) => b.totalCount - a.totalCount
//     );

//     res.json({
//       success: true,
//       data: summary,
//     });
//   } catch (err) {
//     console.error("getMissingLogoutSummary:", err);
//     res.status(500).json({
//       success: false,
//       message: err.message,
//     });
//   }
// };



// // ============================================================
// // GET /api/attendance/missing-logout/:userId   (ADMIN)
// // ============================================================

// exports.getMissingLogoutForUser = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     // NEW — an admin has no history under this feature.
//     if (await isAdminUser(userId)) {
//       return res.json({
//         success: true,
//         data: { totalCount: 0, pendingCount: 0, approvedCount: 0, incidents: [] },
//       });
//     }

//     const records = await Attendance.find({
//       user: userId,
//       $or: [
//         { needsApproval: true },
//         { "sessions.logoutType": "ADMIN_APPROVED" },
//       ],
//     })
//       .sort({ date: -1 })
//       .lean();

//     const incidents = [];

//     for (const record of records) {
//       const sessions = Array.isArray(record.sessions) ? record.sessions : [];

//       for (const session of sessions) {
//         const isPending = record.needsApproval && !session.logoutTime;
//         const isApproved = session.logoutType === "ADMIN_APPROVED";

//         if (!isPending && !isApproved) continue;

//         incidents.push({
//           date: record.date,
//           loginTime: session.loginTime,
//           status: isPending ? "PENDING" : "APPROVED",
//           approvedBy: session.approvedBy || null,
//           approvedAt: session.approvedAt || null,
//         });
//       }
//     }

//     res.json({
//       success: true,
//       data: {
//         totalCount: incidents.length,
//         pendingCount: incidents.filter((i) => i.status === "PENDING").length,
//         approvedCount: incidents.filter((i) => i.status === "APPROVED").length,
//         incidents,
//       },
//     });
//   } catch (err) {
//     console.error("getMissingLogoutForUser error:", err);
//     res.status(500).json({ success: false, message: err.message });
//   }
// };