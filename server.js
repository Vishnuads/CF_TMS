const express = require('express');
const http = require("http");
const app = express();
const path = require('path');
const dotenv = require('dotenv');
 dotenv.config({path:path.join(__dirname,'config','.env')})
const cors = require('cors');
const morgan = require('morgan');     
dotenv.config();
const PORT = process.env.PORT || 3000;
// ✅ Database connection
const database = require('./config/database');
database()
const socket = require("./socket");
const server = http.createServer(app);
// 🔥 INIT SOCKET
socket.init(server);

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const updatedProfileRoutes = require("./routes/updatedProfile")
const projectRoutes = require("./routes/projects")
const taskRoutes = require("./routes/taskRoutes") 
const taskChatRoutes = require("./routes/taskChatRoutes")
const dashboardRoutes = require("./routes/dashboard.routes")
const dailyReport  = require("./routes/DailyReport")
const roleRoutes = require("./routes/roleRoutes")
const activityRoutes = require("./routes/activityRoutes")
const screenshotRoutes = require("./routes/screenshotRoutes")
const workSession = require("./routes/workSession")


app.use(cors())  
app.use(morgan('dev'));     
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", updatedProfileRoutes);
app.use("/api", projectRoutes)
app.use("/api", taskRoutes)
app.use("/api", taskChatRoutes)       
app.use("/api", dashboardRoutes);
app.use("/api", dailyReport);
app.use("/api", roleRoutes);
app.use("/api", activityRoutes);
app.use("/api", screenshotRoutes);
app.use("/api",workSession)
   
// ✅ Socket.IO
// const { Server } = require("socket.io");
// const User = require("./models/User");
// const io = new Server(server, {
// cors: {
//     origin: "http://localhost:5173",
//     methods: ["GET", "POST"],
//     credentials: true
//   }});

// app.set("io", io);
// const onlineUsers = new Map();


//  io.on("connection", (socket) => {

//   socket.on("join-user", async (userId) => {
//     socket.userId = userId;
//     socket.join(`user:${userId}`);

//     await User.findByIdAndUpdate(userId, { isOnline: true });
//     io.emit("user-status-changed", { userId, isOnline: true });
//   });

  
//   socket.on("join-task", (taskId) => {
//     socket.join(`task:${taskId}`);
//     console.log(`Joined task room task:${taskId}`);
//   });

//   socket.on("disconnect", async () => {
//     if (!socket.userId) return;

//     await User.findByIdAndUpdate(socket.userId, { isOnline: false });
//     io.emit("user-status-changed", {
//       userId: socket.userId,
//       isOnline: false,
//     });
//   });
//   });





// Socket.IO connection
// io.on("connection", (socket) => {
//   console.log("User connected:", socket.id);

  
//   // 🔹 Join user room (GLOBAL notifications)


//   // socket.on("join-user", (userId) => {
//   //   if (!userId) return;
//   //   socket.join(userId);
//   //   console.log(`👤 User ${userId} joined personal room`);
//   // });


//   // ===============================
//   // 👤 USER ONLINE (GLOBAL)
//   // ===============================
//  socket.on("join-user", async (userId) => {
//     if (!userId) return;

//     socket.userId = userId;
//     onlineUsers.set(userId, socket.id);

//     await User.findByIdAndUpdate(userId, { isOnline: true });

//     io.emit("user-status-changed", {
//       userId,
//       isOnline: true,
//     });

//     console.log("🟢 ONLINE:", userId);
//   });

   
//   socket.on("join-task", (taskId) => {
//     socket.join(taskId);
//     console.log(`Socket ${socket.id} joined task ${taskId}`);
//   });
       
         
   
//   // socket.on("disconnect", () => {
//   //   console.log("User disconnected:", socket.id);
//   // });

//   // ===============================
//   // 🔴 DISCONNECT
//   // ===============================
//  socket.on("disconnect", async () => {
//     const userId = socket.userId;
//     if (!userId) return;

//     onlineUsers.delete(userId);

//     await User.findByIdAndUpdate(userId, { isOnline: false });

//    io.emit("user-status-changed", {
//   userId: userId.toString(),
//   isOnline: false
// });


//     console.log("🔴 OFFLINE:", userId);
//   });



// });
   
 app.get("/", (req, res) => {
  res.send("🚀 ETM API is running successfully!");
});

server.listen(PORT, (err) => {  
  if (err) {
    console.error("❌ Server failed to start:", err);
  } else {
    console.log(`✅ Server running successfully on port ${PORT}`);
  }
});     