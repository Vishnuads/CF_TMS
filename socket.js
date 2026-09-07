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

//       socket.on("join-user", async (userId) => {
//         if (disconnectTimers[userId]) {
//           clearTimeout(disconnectTimers[userId]);
//           delete disconnectTimers[userId];
//         }

//         socket.userId = userId;
//         socket.join(`user:${userId}`);

//         await User.findByIdAndUpdate(userId, { isOnline: true });
//         io.emit("user-status-changed", { userId, isOnline: true });
//       });

//       socket.on("presence-ping", async (userId) => {
//         await User.findByIdAndUpdate(userId, {
//           lastSeen: new Date(),
//           isOnline: true,
//         });

//         io.emit("user-status-changed", {
//           userId,
//           isOnline: true,
//         });
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

//         // 🔔 notify users (except sender)
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

    const disconnectTimers = {};

    io.on("connection", (socket) => {
      console.log("Socket connected:", socket.id);

      socket.on("disconnect", async () => {
        if (!socket.userId) return;

        const userIdAtDisconnect = socket.userId;

        disconnectTimers[socket.userId] = setTimeout(async () => {
          const rooms = io.sockets.adapter.rooms;
          const userRoom = rooms.get(`user:${userIdAtDisconnect}`);

          if (!userRoom || userRoom.size === 0) {
            await User.findByIdAndUpdate(userIdAtDisconnect, {
              isOnline: false,
              lastSeen: new Date(),
            });
            io.emit("user-status-changed", {
              userId: userIdAtDisconnect,
              isOnline: false,
            });

            try {
              // Lazy require to avoid circular dependency at module load time
              const {
                closeOpenSessionNow,
              } = require("./controllers/attendanceCleanup");
              await closeOpenSessionNow(userIdAtDisconnect, "disconnect");
            } catch (err) {
              console.error("Attendance disconnect-close error:", err.message);
            }
          }

          delete disconnectTimers[userIdAtDisconnect];
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
