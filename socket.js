const { Server } = require("socket.io");
const User = require("./models/User");

let io;

module.exports = {
  init: (server) => {
    io = new Server(server, {
      cors: {
        // origin:process.env.CLIENT_URL,
        origin: [
          "https://task.cinemafactoryacademy.com",
           "https://emptask.cinemafactoryacademy.com",
           "http://localhost:5173"
        ],
        methods: ["GET", "POST"],
        credentials: true,
      },
    });

    io.on("connection", (socket) => {
      console.log("Socket connected:", socket.id);

      // 👤 USER ROOM
      socket.on("join-user", async (userId) => {
        socket.userId = userId;
        socket.join(`user:${userId}`);

        await User.findByIdAndUpdate(userId, { isOnline: true });
        io.emit("user-status-changed", { userId, isOnline: true });
      });

      // 📌 TASK ROOM
      socket.on("join-task", (taskId) => {
        socket.join(`task:${taskId}`);
        console.log(`Joined task:${taskId}`);
      });

        socket.on("join-role", roleId => {
    socket.join(`role-${roleId}`);
  });
  
      // join project room
// socket.on("join-project", (projectId) => {
//   socket.join(`project:${projectId}`);
//   console.log(`User joined project:${projectId}`);
// });


  socket.on("join-admin", () => {
    socket.join("admin");
    console.log("Admin joined");
  });

      // 💬 TASK MESSAGE
      socket.on("send-message", (data) => {
        io.to(`task:${data.taskId}`).emit("receive-message", data);

        // 🔔 notify users (except sender)
        data.receivers?.forEach((id) => {
          io.to(`user:${id}`).emit("notify-message", data);
        });
      });

      socket.on("disconnect", async () => {
        if (!socket.userId) return;

        await User.findByIdAndUpdate(socket.userId, { isOnline: false });
        io.emit("user-status-changed", {
          userId: socket.userId,
          isOnline: false,
        });

        console.log("Socket disconnected:", socket.id);
      });
    });

    return io;
  }, 

  getIO: () => {
    if (!io) throw new Error("Socket.io not initialized");
    return io;
  },
};
