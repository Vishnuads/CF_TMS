// const { Server } = require("socket.io");
// const User = require("./models/User");

// let io;

// module.exports = {
//   init: (server) => {
//     io = new Server(server, {
//       cors: {
//         origin: [
//           "https://task.cinemafactoryacademy.com",
//           "https://emptask.cinemafactoryacademy.com",
//           "http://localhost:5173",
//         ],
//         methods: ["GET", "POST"],
//         credentials: true,
//       },
//     });

//     const disconnectTimers = {};

//     io.on("connection", (socket) => {
//       console.log("Socket connected:", socket.id);

//       socket.on("disconnect", async () => {
//         if (!socket.userId) return;

//         const userIdAtDisconnect = socket.userId;

//         disconnectTimers[socket.userId] = setTimeout(async () => {
//           const rooms = io.sockets.adapter.rooms;
//           const userRoom = rooms.get(`user:${userIdAtDisconnect}`);

//           if (!userRoom || userRoom.size === 0) {
//             await User.findByIdAndUpdate(userIdAtDisconnect, {
//               isOnline: false,
//               lastSeen: new Date(),
//             });
//             io.emit("user-status-changed", {
//               userId: userIdAtDisconnect,
//               isOnline: false,
//             });

//             try {
//               // Lazy require to avoid circular dependency at module load time
//               const {
//                 closeOpenSessionNow,
//               } = require("./controllers/attendanceCleanup");
//               await closeOpenSessionNow(userIdAtDisconnect, "disconnect");
//             } catch (err) {
//               console.error("Attendance disconnect-close error:", err.message);
//             }
//           }

//           delete disconnectTimers[userIdAtDisconnect];
//         }, 8000);

//         console.log("Socket disconnected:", socket.id);
//       });

//       // Fires on first connect AND on every auto-reconnect (e.g. right
//       // after the laptop wakes from sleep and the socket re-establishes).
//       // Beyond marking the user online, this is now also the moment we
//       // reopen attendance if a watchdog or the disconnect timer above
//       // already closed today's session while this tab was unreachable —
//       // otherwise the person stays "logged in" but shows no active
//       // session until they do a full password login again.
//       socket.on("join-user", async (userId) => {
//         if (disconnectTimers[userId]) {
//           clearTimeout(disconnectTimers[userId]);
//           delete disconnectTimers[userId];
//         }

//         socket.userId = userId;
//         socket.join(`user:${userId}`);

//         await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
//         io.emit("user-status-changed", { userId, isOnline: true });

//         try {
//           const { ensureCheckedInToday } = require("./controllers/attendanceCleanup");
//           await ensureCheckedInToday(userId);
//         } catch (err) {
//           console.error("Attendance re-checkin (join-user) error:", err.message);
//         }
//       });

//       // Regular heartbeat while a tab is genuinely alive. This is the
//       // critical path for a SHORT sleep/suspend where the underlying
//       // socket connection survives (so "disconnect"/"join-user" never
//       // re-fire) but the JS event loop froze — pings simply stopped for a
//       // while. When they resume, this is the only signal the server gets
//       // that the person is back, so it also needs to reopen the session
//       // if the watchdog force-closed it in the meantime.
//       socket.on("presence-ping", async (userId) => {
//         await User.findByIdAndUpdate(userId, {
//           lastSeen: new Date(),
//           isOnline: true,
//         });

//         io.emit("user-status-changed", {
//           userId,
//           isOnline: true,
//         });

//         try {
//           const { ensureCheckedInToday } = require("./controllers/attendanceCleanup");
//           await ensureCheckedInToday(userId);
//         } catch (err) {
//           console.error("Attendance re-checkin (presence-ping) error:", err.message);
//         }
//       });

//       socket.on("user-offline", async (userId) => {
//         await User.findByIdAndUpdate(userId, {
//           isOnline: false,
//           lastSeen: new Date(),
//         });
//         io.emit("user-status-changed", { userId, isOnline: false });
//       });

//       // 📌 TASK ROOM
//       socket.on("join-task", (taskId) => {
//         socket.join(`task:${taskId}`);
//         console.log(`Joined task:${taskId}`);
//       });

//       socket.on("join-role", (roleId) => {
//         socket.join(`role-${roleId}`);
//       });

//       socket.on("join-admin", () => {
//         socket.join("admin");
//         console.log("Admin joined");
//       });

//       // 💬 TASK MESSAGE
//       socket.on("send-message", (data) => {
//         io.to(`task:${data.taskId}`).emit("receive-message", data);

//         data.receivers?.forEach((id) => {
//           io.to(`user:${id}`).emit("notify-message", data);
//         });
//       });
//     });

//     return io;
//   },

//   getIO: () => {
//     if (!io) throw new Error("Socket.io not initialized");
//     return io;
//   },
// };













// const { Server } = require("socket.io");
// const User = require("./models/User");

// let io;

// // userId -> Set of socket.id currently open for that user (multi-tab/device)
// const onlineSockets = new Map();

// // userId -> the ONE pending "go offline" timeout for that user (if any)
// const disconnectTimers = new Map();

// // Page refresh / brief network blip disconnects then reconnects within
// // ~1s. This absorbs that without flickering "offline" to everyone else.
// const OFFLINE_GRACE_MS = 8000;

// module.exports = {
//   init: (server) => {
//     io = new Server(server, {
//       cors: {
//         origin: [
//           "https://task.cinemafactoryacademy.com",
//           "https://emptask.cinemafactoryacademy.com",
//           "http://localhost:5173",
//         ],
//         methods: ["GET", "POST"],
//         credentials: true,
//       },
//     });

//     io.on("connection", (socket) => {
//       console.log("Socket connected:", socket.id);

//       // =========================================================
//       // PRESENCE — join / reconnect
//       // =========================================================
//       socket.on("join-user", async (userId) => {
//         if (!userId) return;

//         socket.userId = userId;
//         socket.join(`user:${userId}`);

//         const pendingTimer = disconnectTimers.get(userId);
//         if (pendingTimer) {
//           clearTimeout(pendingTimer);
//           disconnectTimers.delete(userId);
//         }

//         let sockets = onlineSockets.get(userId);
//         if (!sockets) {
//           sockets = new Set();
//           onlineSockets.set(userId, sockets);
//         }
//         const wasOffline = sockets.size === 0;
//         sockets.add(socket.id);

//         if (wasOffline) {
//           try {
//             await User.findByIdAndUpdate(userId, {
//               isOnline: true,
//               lastSeen: new Date(),
//             });
//           } catch (err) {
//             console.error("Failed to set user online:", err.message);
//           }
//           io.emit("user-status-changed", { userId, isOnline: true });
//         }

//         try {
//           const {
//             ensureCheckedInToday,
//           } = require("./controllers/attendanceCleanup");
//           await ensureCheckedInToday(userId);
//         } catch (err) {
//           console.error(
//             "Attendance re-checkin (join-user) error:",
//             err.message,
//           );
//         }
//       });

//       // =========================================================
//       // HEARTBEAT — tab genuinely alive, JS event loop was frozen
//       // (e.g. laptop asleep) but the underlying socket never dropped,
//       // so "disconnect"/"join-user" never re-fire on wake.
//       // =========================================================
//       socket.on("presence-ping", async (userId) => {
//         if (!userId) return;

//         const sockets = onlineSockets.get(userId);
//         const alreadyKnownOnline = !!sockets && sockets.size > 0;

//         // Always keep lastSeen fresh, but only write isOnline / rebroadcast
//         // when something actually changed. Emitting "isOnline: true" on
//         // every single ping was flooding every client with redundant
//         // status events and DB writes for no behavioral benefit.
//         if (!alreadyKnownOnline) {
//           // We think this user is offline but their tab is pinging us —
//           // treat it like a reconnect.
//           let s = onlineSockets.get(userId);
//           if (!s) {
//             s = new Set();
//             onlineSockets.set(userId, s);
//           }
//           s.add(socket.id);
//           socket.userId = userId;

//           const pendingTimer = disconnectTimers.get(userId);
//           if (pendingTimer) {
//             clearTimeout(pendingTimer);
//             disconnectTimers.delete(userId);
//           }

//           try {
//             await User.findByIdAndUpdate(userId, {
//               isOnline: true,
//               lastSeen: new Date(),
//             });
//           } catch (err) {
//             console.error("Failed to set user online (ping):", err.message);
//           }
//           io.emit("user-status-changed", { userId, isOnline: true });
//         } else {
//           try {
//             await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
//           } catch (err) {
//             console.error("Failed to update lastSeen:", err.message);
//           }
//         }

//         try {
//           const {
//             ensureCheckedInToday,
//           } = require("./controllers/attendanceCleanup");
//           await ensureCheckedInToday(userId);
//         } catch (err) {
//           console.error(
//             "Attendance re-checkin (presence-ping) error:",
//             err.message,
//           );
//         }
//       });

//       // =========================================================
//       // EXPLICIT LOGOUT — user clicked "Logout". We KNOW this is
//       // intentional, so go offline immediately with no grace period.
//       // This is the fix for "logout sometimes still shows online":
//       // previously there was no dedicated event for this at all, so
//       // logout relied on the plain 8s-delayed disconnect path.
//       //
//       // IMPORTANT: your frontend must emit this BEFORE calling
//       // socket.disconnect() on logout, e.g.:
//       //   socket.emit("user-logout", userId);
//       //   socket.disconnect();
//       // =========================================================
//       socket.on("user-logout", async (userId) => {
//         await handleSocketLeaving(io, socket, userId, { immediate: true });
//       });

//       // Back-compat: keep "user-offline" working the same way as
//       // explicit logout, but route it through the same ref-counted
//       // path so it doesn't ignore other open tabs for this user.
//       socket.on("user-offline", async (userId) => {
//         await handleSocketLeaving(io, socket, userId, { immediate: true });
//       });

//       // =========================================================
//       // PLAIN DISCONNECT — tab closed, refresh, network drop
//       // =========================================================
//       socket.on("disconnect", async () => {
//         const userId = socket.userId;
//         console.log("Socket disconnected:", socket.id);
//         await handleSocketLeaving(io, socket, userId, { immediate: false });
//       });

//       // ------------------------------------------------------------
//       // Everything below is unchanged from your original file.
//       // ------------------------------------------------------------
//       socket.on("join-task", (taskId) => {
//         socket.join(`task:${taskId}`);
//         console.log(`Joined task:${taskId}`);
//       });

//       socket.on("join-role", (roleId) => {
//         socket.join(`role-${roleId}`);
//       });

//       socket.on("join-admin", () => {
//         socket.join("admin");
//         console.log("Admin joined");
//       });

//       socket.on("send-message", (data) => {
//         io.to(`task:${data.taskId}`).emit("receive-message", data);
//         data.receivers?.forEach((id) => {
//           io.to(`user:${id}`).emit("notify-message", data);
//         });
//       });

//       socket.on("presence-heartbeat", async ({ userId, idleSeconds }) => {
//         if (!userId) return;

//         const status = idleSeconds >= 180 ? "IDLE" : "ONLINE";

//         try {
//           await User.findByIdAndUpdate(userId, {
//             presenceStatus: status,
//             idleSeconds,
//             lastActivityAt: idleSeconds < 180 ? new Date() : undefined,
//             lastSeen: new Date(),
//           });
//         } catch (err) {
//           console.error("presence-heartbeat update failed:", err.message);
//         }

//         io.emit("presence-status-changed", { userId, status, idleSeconds });
//       });
//     });



//     // ============================================================
// // OFFLINE SWEEP — no heartbeat for 60s = OFFLINE, regardless of
// // socket connection state (covers Electron crashing without a clean
// // disconnect event ever firing).
// // ============================================================


// setInterval(async () => {
//   try {
//     const cutoff = new Date(Date.now() - 60000);
//     await User.updateMany(
//       { lastSeen: { $lt: cutoff }, presenceStatus: { $ne: "OFFLINE" } },
//       { presenceStatus: "OFFLINE" }
//     );
//   } catch (err) {
//     console.error("Presence OFFLINE sweep error:", err.message);
//   }
// }, 15000);



//     return io;
//   },

//   getIO: () => {
//     if (!io) throw new Error("Socket.io not initialized");
//     return io;
//   },
// };

// // -----------------------------------------------------------------------
// // Shared "this socket is leaving presence for userId" logic, used by
// // user-logout, user-offline, and disconnect. Ref-counts against
// // onlineSockets so a user with multiple tabs only goes offline once
// // the LAST tab is gone, and only ever has ONE grace timer live at a
// // time (stored per-userId, cancel-then-set), which is what fixes the
// // original overwritten/orphaned-timer bug.
// // -----------------------------------------------------------------------
// async function handleSocketLeaving(io, socket, userId, { immediate }) {
//   if (!userId) return;

//   const sockets = onlineSockets.get(userId);
//   if (sockets) {
//     sockets.delete(socket.id);
//   }

//   // Other tabs/devices for this user are still connected — stay online.
//   if (sockets && sockets.size > 0) {
//     return;
//   }

//   onlineSockets.delete(userId);

//   // Always clear any existing timer for this user before scheduling
//   // or running a new offline transition, so we never have two timers
//   // alive for the same userId.
//   const existingTimer = disconnectTimers.get(userId);
//   if (existingTimer) {
//     clearTimeout(existingTimer);
//     disconnectTimers.delete(userId);
//   }

//   const goOffline = async () => {
//     disconnectTimers.delete(userId);

//     // Double-check nobody reconnected while we were waiting.
//     const current = onlineSockets.get(userId);
//     if (current && current.size > 0) return;

//     try {
//       await User.findByIdAndUpdate(userId, {
//         isOnline: false,
//         lastSeen: new Date(),
//       });
//     } catch (err) {
//       console.error("Failed to set user offline:", err.message);
//     }

//     io.emit("user-status-changed", { userId, isOnline: false });

//     try {
//       const {
//         closeOpenSessionNow,
//       } = require("./controllers/attendanceCleanup");
//       await closeOpenSessionNow(userId, immediate ? "logout" : "disconnect");
//     } catch (err) {
//       console.error("Attendance close error:", err.message);
//     }
//   };

//   if (immediate) {
//     // Real logout — no waiting.
//     await goOffline();
//     return;
//   }

//   // Plain disconnect — give it a grace period in case it's a refresh
//   // or brief reconnect before declaring the user offline.
//   const timeout = setTimeout(goOffline, OFFLINE_GRACE_MS);
//   disconnectTimers.set(userId, timeout);
// }



















const { Server } = require("socket.io");
const User = require("./models/User");

let io;
let sweepIntervalStarted = false; // NEW — prevents double-registering the interval

// userId -> Set of socket.id currently open for that user (multi-tab/device)
const onlineSockets = new Map();

// userId -> the ONE pending "go offline" timeout for that user (if any)
const disconnectTimers = new Map();

const OFFLINE_GRACE_MS = 8000;

module.exports = {
  init: (server) => {
    // Guard against init() being called more than once (e.g. hot reload,
    // or the module being required and invoked from two different entry
    // points). Without this, every extra call stacks ANOTHER copy of the
    // connection handler AND another sweep interval on top of the old
    // ones, which is very likely what corrupted the updateMany() call.
    if (io) {
      console.warn("socket.init() called more than once — reusing existing io instance");
      return io;
    }

    io = new Server(server, {
      cors: {
        origin: [
          "https://task.cinemafactoryacademy.com",
          "https://emptask.cinemafactoryacademy.com",
          "http://localhost:5173",
        ],
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    io.on("connection", (socket) => {
      console.log("Socket connected:", socket.id);

      socket.on("join-user", async (userId) => {
        if (!userId) return;

        socket.userId = userId;
        socket.join(`user:${userId}`);

        const pendingTimer = disconnectTimers.get(userId);
        if (pendingTimer) {
          clearTimeout(pendingTimer);
          disconnectTimers.delete(userId);
        }

        let sockets = onlineSockets.get(userId);
        if (!sockets) {
          sockets = new Set();
          onlineSockets.set(userId, sockets);
        }
        const wasOffline = sockets.size === 0;
        sockets.add(socket.id);

        if (wasOffline) {
          try {
            await User.findByIdAndUpdate(userId, {
              isOnline: true,
              lastSeen: new Date(),
            });
          } catch (err) {
            console.error("Failed to set user online:", err.message);
          }
          io.emit("user-status-changed", { userId, isOnline: true });
        }

        try {
          const { ensureCheckedInToday } = require("./controllers/attendanceCleanup");
          await ensureCheckedInToday(userId);
        } catch (err) {
          console.error("Attendance re-checkin (join-user) error:", err.message);
        }
      });

      socket.on("presence-ping", async (userId) => {
        if (!userId) return;

        const sockets = onlineSockets.get(userId);
        const alreadyKnownOnline = !!sockets && sockets.size > 0;

        if (!alreadyKnownOnline) {
          let s = onlineSockets.get(userId);
          if (!s) {
            s = new Set();
            onlineSockets.set(userId, s);
          }
          s.add(socket.id);
          socket.userId = userId;

          const pendingTimer = disconnectTimers.get(userId);
          if (pendingTimer) {
            clearTimeout(pendingTimer);
            disconnectTimers.delete(userId);
          }

          try {
            await User.findByIdAndUpdate(userId, {
              isOnline: true,
              lastSeen: new Date(),
            });
          } catch (err) {
            console.error("Failed to set user online (ping):", err.message);
          }
          io.emit("user-status-changed", { userId, isOnline: true });
        } else {
          try {
            await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
          } catch (err) {
            console.error("Failed to update lastSeen:", err.message);
          }
        }

        try {
          const { ensureCheckedInToday } = require("./controllers/attendanceCleanup");
          await ensureCheckedInToday(userId);
        } catch (err) {
          console.error("Attendance re-checkin (presence-ping) error:", err.message);
        }
      });

      socket.on("user-logout", async (userId) => {
        await handleSocketLeaving(io, socket, userId, { immediate: true });
      });

      socket.on("user-offline", async (userId) => {
        await handleSocketLeaving(io, socket, userId, { immediate: true });
      });

      socket.on("disconnect", async () => {
        const userId = socket.userId;
        console.log("Socket disconnected:", socket.id);
        await handleSocketLeaving(io, socket, userId, { immediate: false });
      });

      socket.on("join-task", (taskId) => {
        socket.join(`task:${taskId}`);
        console.log(`Joined task:${taskId}`);
      });

      socket.on("join-role", (roleId) => {
        socket.join(`role-${roleId}`);
      });

      socket.on("join-admin", () => {
        socket.join("admin");
        console.log("Admin joined");
      });

      socket.on("send-message", (data) => {
        io.to(`task:${data.taskId}`).emit("receive-message", data);
        data.receivers?.forEach((id) => {
          io.to(`user:${id}`).emit("notify-message", data);
        });
      });

      socket.on("presence-heartbeat", async ({ userId, idleSeconds }) => {
        if (!userId) return;

        // Guard: idleSeconds must be a finite number, or the comparisons
        // below (and anything derived from it) can misbehave.
        const safeIdleSeconds = Number.isFinite(idleSeconds) ? idleSeconds : 0;
        const status = safeIdleSeconds >= 180 ? "IDLE" : "ONLINE";

        try {
          await User.findByIdAndUpdate(userId, {
            presenceStatus: status,
            idleSeconds: safeIdleSeconds,
            lastActivityAt: safeIdleSeconds < 180 ? new Date() : undefined,
            lastSeen: new Date(),
          });
        } catch (err) {
          console.error("presence-heartbeat update failed:", err.message);
        }

        io.emit("presence-status-changed", { userId, status, idleSeconds: safeIdleSeconds });
      });
    });

    // ============================================================
    // OFFLINE SWEEP — guarded against double-registration and
    // against ever building an invalid filter.
    // ============================================================
    if (!sweepIntervalStarted) {
      sweepIntervalStarted = true;

      setInterval(async () => {
        try {
          const cutoff = new Date(Date.now() - 60000);

          // Defensive check: if cutoff somehow isn't a valid Date, skip
          // this tick instead of passing a broken value into Mongoose.
          if (Number.isNaN(cutoff.getTime())) {
            console.error("Presence OFFLINE sweep skipped — invalid cutoff date");
            return;
          }

          await User.updateMany(
            { lastSeen: { $lt: cutoff }, presenceStatus: { $ne: "OFFLINE" } },
            { presenceStatus: "OFFLINE" }
          );
        } catch (err) {
          console.error("Presence OFFLINE sweep error:", err.message);
        }
      }, 15000);
    }

    return io;
  },

  getIO: () => {
    if (!io) throw new Error("Socket.io not initialized");
    return io;
  },
};

async function handleSocketLeaving(io, socket, userId, { immediate }) {
  if (!userId) return;

  const sockets = onlineSockets.get(userId);
  if (sockets) {
    sockets.delete(socket.id);
  }

  if (sockets && sockets.size > 0) {
    return;
  }

  onlineSockets.delete(userId);

  const existingTimer = disconnectTimers.get(userId);
  if (existingTimer) {
    clearTimeout(existingTimer);
    disconnectTimers.delete(userId);
  }

  const goOffline = async () => {
    disconnectTimers.delete(userId);

    const current = onlineSockets.get(userId);
    if (current && current.size > 0) return;

    try {
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });
    } catch (err) {
      console.error("Failed to set user offline:", err.message);
    }

    io.emit("user-status-changed", { userId, isOnline: false });

    try {
      const { closeOpenSessionNow } = require("./controllers/attendanceCleanup");
      await closeOpenSessionNow(userId, immediate ? "logout" : "disconnect");
    } catch (err) {
      console.error("Attendance close error:", err.message);
    }
  };

  if (immediate) {
    await goOffline();
    return;
  }

  const timeout = setTimeout(goOffline, OFFLINE_GRACE_MS);
  disconnectTimers.set(userId, timeout);
}