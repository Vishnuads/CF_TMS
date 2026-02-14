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



const User = require("./models/User");

// 🔥 AUTO PRESENCE CLEANUP (GLOBAL BACKGROUND JOB)
setInterval(async () => {
  try {
    const timeout = new Date(Date.now() - 30000);

    await User.updateMany(
      { lastSeen: { $lt: timeout } },
      { isOnline: false }
    );

  } catch (err) {
    console.error("Presence cleanup error:", err);
  }
}, 10000);


    
app.use(cors())  
app.use(morgan('dev'));     
app.use(express.json());
app.use("/uploads", express.static("uploads"));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ✅ Middleware   
app.use(
  cors({
    origin: [
      "https://task.cinemafactoryacademy.com",
      "https://emptask.cinemafactoryacademy.com",
      "http://localhost:5173"
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], 
    credentials: true,
  })
);


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