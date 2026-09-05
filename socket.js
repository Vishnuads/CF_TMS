


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

















const { Server } = require("socket.io");
const User = require("./models/User");

let io;

module.exports = {
  init: (server) => {
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

    // Keyed by userId. At most ONE pending "mark offline" timer per
    // user at any time — see the disconnect handler below for why
    // this must never be silently overwritten.
    const disconnectTimers = {};

    io.on("connection", (socket) => {
      console.log("Socket connected:", socket.id);

      socket.on("disconnect", async () => {
        if (!socket.userId) return;

        const userId = socket.userId;

        // ============================================================
        // THE FIX
        // ============================================================
        // Previously this ALWAYS did:
        //   disconnectTimers[userId] = setTimeout(...)
        // which overwrites any timer already pending for this user. If
        // a person has two tabs open and both disconnect within a few
        // seconds of each other, the second disconnect replaces the
        // first timer's reference in the map — but the FIRST timer is
        // still scheduled in the event loop; it isn't cancelled. When
        // it fires, it does `delete disconnectTimers[userId]`, which
        // deletes the SECOND timer's map entry (the only reference to
        // it) even though the second timer hasn't fired yet. If the
        // user reconnects in that window, `join-user`'s
        // `clearTimeout(disconnectTimers[userId])` finds nothing to
        // clear — the second timer is orphaned and will still fire
        // later, potentially marking a now-reconnected user as offline.
        //
        // Fix: if a timer is ALREADY pending for this user, don't
        // schedule a second one. The existing timer will re-check the
        // room's live socket count when it fires anyway, so a single
        // debounced timer is all that's needed regardless of how many
        // tabs disconnect in quick succession.
        // ============================================================

        if (disconnectTimers[userId]) {
          console.log("Socket disconnected:", socket.id, "(debounced — timer already pending)");
          return;
        }

        disconnectTimers[userId] = setTimeout(async () => {
          // Clear our own map entry FIRST, before doing anything async,
          // so there's no window where a reconnecting join-user could
          // race against this callback and try to clearTimeout a timer
          // that's already mid-execution.
          delete disconnectTimers[userId];

          const userRoom = io.sockets.adapter.rooms.get(`user:${userId}`);

          if (userRoom && userRoom.size > 0) {
            // Another tab (or a reconnect) is still holding this
            // user's room open — they're not actually offline.
            return;
          }

          await User.findByIdAndUpdate(userId, {
            isOnline: false,
            lastSeen: new Date(),
          });

          io.emit("user-status-changed", {
            userId,
            isOnline: false,
          });

          try {
            // Lazy require to avoid circular dependency at module load time
            const {
              closeOpenSessionNow,
            } = require("./controllers/attendanceCleanup");
            await closeOpenSessionNow(userId, "disconnect");
          } catch (err) {
            console.error("Attendance disconnect-close error:", err.message);
          }
        }, 8000);

        console.log("Socket disconnected:", socket.id);
      });

      // Fires on first connect AND on every auto-reconnect (e.g. right
      // after the laptop wakes from sleep and the socket re-establishes).
      // Beyond marking the user online, this is now also the moment we
      // reopen attendance if a watchdog or the disconnect timer above
      // already closed today's session while this tab was unreachable —
      // otherwise the person stays "logged in" but shows no active
      // session until they do a full password login again.
      socket.on("join-user", async (userId) => {
        if (disconnectTimers[userId]) {
          clearTimeout(disconnectTimers[userId]);
          delete disconnectTimers[userId];
        }

        socket.userId = userId;
        socket.join(`user:${userId}`);

        await User.findByIdAndUpdate(userId, { isOnline: true, lastSeen: new Date() });
        io.emit("user-status-changed", { userId, isOnline: true });

        try {
          const { ensureCheckedInToday } = require("./controllers/attendanceCleanup");
          await ensureCheckedInToday(userId);
        } catch (err) {
          console.error("Attendance re-checkin (join-user) error:", err.message);
        }
      });

      // Regular heartbeat while a tab is genuinely alive. This is the
      // critical path for a SHORT sleep/suspend where the underlying
      // socket connection survives (so "disconnect"/"join-user" never
      // re-fire) but the JS event loop froze — pings simply stopped for a
      // while. When they resume, this is the only signal the server gets
      // that the person is back, so it also needs to reopen the session
      // if the watchdog force-closed it in the meantime.
      socket.on("presence-ping", async (userId) => {
        await User.findByIdAndUpdate(userId, {
          lastSeen: new Date(),
          isOnline: true,
        });

        io.emit("user-status-changed", {
          userId,
          isOnline: true,
        });

        try {
          const { ensureCheckedInToday } = require("./controllers/attendanceCleanup");
          await ensureCheckedInToday(userId);
        } catch (err) {
          console.error("Attendance re-checkin (presence-ping) error:", err.message);
        }
      });

      socket.on("user-offline", async (userId) => {
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen: new Date(),
        });
        io.emit("user-status-changed", { userId, isOnline: false });
      });

      // 📌 TASK ROOM
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

      // 💬 TASK MESSAGE
      socket.on("send-message", (data) => {
        io.to(`task:${data.taskId}`).emit("receive-message", data);

        data.receivers?.forEach((id) => {
          io.to(`user:${id}`).emit("notify-message", data);
        });
      });
    });

    return io;
  },

  getIO: () => {
    if (!io) throw new Error("Socket.io not initialized");
    return io;
  },
};