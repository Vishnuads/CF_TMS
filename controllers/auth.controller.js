// const User = require("../models/User");
// const Session = require("../models/Session");
// const bcrypt = require("bcryptjs");
// const jwt = require("jsonwebtoken");
// const nodemailer = require("nodemailer");
// const crypto = require("crypto");
// const Role = require("../models/Role")
// const Attendance = require("../models/Attendance");
// const socket = require("../socket");

// const { recordCheckIn, closeOpenSessionNow } = require("./attendanceCleanup");



//  function startOfDay(d = new Date()) {
//   const x = new Date(d);
//   x.setHours(0, 0, 0, 0);
//   return x;
// }

// // const transporter = nodemailer.createTransport({
// //   service: "gmail",
// //   auth: {
// //     user: process.env.EMAIL_USER,
// //     pass: process.env.EMAIL_PASS
// //   }
// // });


// const transporter = nodemailer.createTransport({
//   host: "smtp.gmail.com",
//   port: 465,
//   secure: true,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS 
//   }
// });


// exports.register = async (req, res) => {
//   try {
//     const { name, email, role } = req.body;

//     const roleId = await Role.findById(role);
//     if (!roleId) {
//       return res.status(400).json({ message: "Invalid role selected" });
//     }

//     const tempPassword = crypto.randomInt(1000, 10000).toString();

//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({ message: "User already exists" });
//     }

//     const hashedPassword = await bcrypt.hash(tempPassword, 10);

//     const user = await User.create({
//       name,
//       email,
//       password: hashedPassword,
//       role: roleId._id,
//       isActive: true
//     });

//     // ✅ send email (keep your existing mail code)

//     const loginUrl = process.env.TEAMLOGIN;
// const mailOptions = {
//   from: `"TaskFlow Admin" <${process.env.EMAIL_USER}>`,
//   to: email,
//   subject: "🚀 You're Invited to TaskFlow",
//   html: `
//   <div style="background:#f4f6fb;padding:40px 0;font-family:Arial,Helvetica,sans-serif">
//     <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08)">
      
//       <!-- Header -->
//       <tr>
//         <td style="background:linear-gradient(135deg,#4f46e5,#3b82f6);padding:24px;text-align:center">
//           <h1 style="color:#ffffff;margin:0;font-size:26px;letter-spacing:0.5px">
//             TaskFlow
//           </h1>
//           <p style="color:#e0e7ff;margin:6px 0 0;font-size:14px">
//             Task Management System
//           </p>
//         </td>
//       </tr>

//       <!-- Body -->
//       <tr>
//         <td style="padding:32px">
//           <h2 style="margin:0 0 12px;color:#111827;font-size:22px">
//             Welcome, ${name} 👋
//           </h2>

//           <p style="color:#374151;font-size:15px;line-height:1.6">
//             You have been invited to join <strong>TaskFlow</strong> as an
//             <strong>${roleId.name}</strong>. Your account has been successfully created.
//           </p>

//           <!-- Credentials Box -->
//           <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:20px 0">
//             <p style="margin:6px 0;font-size:14px;color:#111827">
//               <strong>Login Email:</strong> ${email}
//             </p>
//             <p style="margin:6px 0;font-size:14px;color:#111827">
//               <strong>Temporary Password:</strong>
//               <span style="background:#e0e7ff;color:#1e3a8a;padding:4px 8px;border-radius:6px;font-weight:bold">
//                 ${tempPassword}
//               </span>
//             </p>
//           </div>

//           <!-- CTA -->
//           <div style="text-align:center;margin:28px 0">
//             <a href="${loginUrl}"
//                style="background:linear-gradient(135deg,#4f46e5,#3b82f6);
//                       color:#ffffff;
//                       text-decoration:none;
//                       padding:14px 28px;
//                       border-radius:10px;
//                       font-size:15px;
//                       font-weight:bold;
//                       display:inline-block">
//               Login to TaskFlow
//             </a>
//           </div>

//           <p style="color:#6b7280;font-size:13px;line-height:1.5">
//             ⚠️ For security reasons, please log in and change your password immediately after first login.
//           </p>

//           <p style="margin-top:24px;color:#374151;font-size:14px">
//             If you have any questions, feel free to contact your administrator.
//           </p>

//           <p style="margin-top:16px;font-size:14px;color:#111827">
//             Regards,<br/>
//             <strong>TaskFlow Team</strong>
//           </p>
//         </td>
//       </tr>

//       <!-- Footer -->
//       <tr>
//         <td style="background:#f9fafb;text-align:center;padding:16px;font-size:12px;color:#9ca3af">
//           © ${new Date().getFullYear()} TaskFlow. All rights reserved.
//         </td>
//       </tr>

//     </table>
//   </div>
//   `,
// };


//     await transporter.sendMail(mailOptions);


//     res.status(201).json({
//       message: "User invited successfully",
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         role: roleId.name
//       }
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({ message: "Registration failed" });
//   }
// };



// // exports.login = async (req, res) => {
// //   const { email, password } = req.body;

// //   const user = await User.findOne({ email }).populate("role");
// //   if (!user) return res.status(401).json({ message: "Invalid credentials" });

// //   if (!user.isActive) {
// //     return res.status(403).json({ message: "Account deactivated" });
// //   }

// //   const isMatch = await bcrypt.compare(password, user.password);
// //   if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

// //   const token = jwt.sign(
// //     { id: user._id },
// //     process.env.JWT_SECRET
// //   );

// //   // ✅ SAVE SESSION
// // await Session.create({
// //   user: user._id,
// //   token,
// //   isValid: true
// // });




// //  // ✅ ATTENDANCE — record login (creates today's doc, or opens a new session)
// //   try {
// //     const today = startOfDay();
// //     let attendance = await Attendance.findOne({ user: user._id, date: today });

// //     if (!attendance) {
// //       attendance = await Attendance.create({
// //         user: user._id,
// //         date: today,
// //         loginTime: new Date(),
// //         sessions: [{ loginTime: new Date() }],
// //       });
// //     } else {
// //       attendance.sessions.push({ loginTime: new Date() });
// //       await attendance.save();
// //     }
// //   } catch (err) {
// //     console.error("Attendance login error:", err);
// //     // Don't block login if attendance recording fails
// //   }



// //     // ✅ SOCKET — notify admin panel of check-in, live
// //   try {
// //     const io = socket.getIO();
// //     io.to("admin").emit("attendance-checkin", {
// //       userId: user._id,
// //       name: user.name,
// //       loginTime: new Date(),
// //     });
// //     io.emit("attendance-checkin", {
// //       userId: user._id,
// //       name: user.name,
// //       loginTime: new Date(),
// //     });
// //   } catch (err) {
// //     console.error("Socket emit (checkin) failed:", err.message);
// //   }

// //   res.json({
// //     token,
// //     role: user.role.name,
// //     permissions: user.role.permissions, // 🔥 THIS FIXES EVERYTHING
// //     name: user.name,
// //     email: user.email,
// //     id:user._id
// //   });
// // };



// // exports.logout = async (req, res) => {
// //   await Session.updateOne({ token: req.token }, { isValid: false });
// //   res.json({ message: "Logged out" });
// // };





// exports.login = async (req, res) => {
//   const { email, password } = req.body;

//   const user = await User.findOne({ email }).populate("role");
//   if (!user) return res.status(401).json({ message: "Invalid credentials" });

//   if (!user.isActive) {
//     return res.status(403).json({ message: "Account deactivated" });
//   }

//   const isMatch = await bcrypt.compare(password, user.password);
//   if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

//   const token = jwt.sign(
//     { id: user._id },
//     process.env.JWT_SECRET
//   );

//   await Session.create({
//     user: user._id,
//     token,
//     isValid: true,
//   });


//     // ✅ ATTENDANCE — shared logic, same function the /checkin route uses
//   try {
//     await recordCheckIn(user._id, user.name);
//   } catch (err) {
//     console.error("Attendance login error:", err);
//   }


//   // const now = new Date();

//   // try {
//   //   const today = startOfDay(now);
//   //   let attendance = await Attendance.findOne({ user: user._id, date: today });

//   //   if (!attendance) {
//   //     attendance = await Attendance.create({
//   //       user: user._id,
//   //       date: today,
//   //       loginTime: now,
//   //       sessions: [{ loginTime: now }],
//   //     });
//   //   } else {
//   //     attendance.sessions.push({ loginTime: now });
//   //     await attendance.save();
//   //   }

    
//   //   try {
//   //     const io = socket.getIO();
//   //     const payload = {
//   //       userId: user._id,
//   //       name: user.name,
//   //       loginTime: now,
//   //     };
//   //     io.to("admin").emit("attendance-checkin", payload);
//   //     io.emit("attendance-checkin", payload);
//   //   } catch (socketErr) {
//   //     console.error("Socket emit (checkin) failed:", socketErr.message);
//   //   }
//   // } catch (err) {
//   //   console.error("Attendance login error:", err);
//   // }

//   res.json({
//     token,
//     role: user.role.name,
//     permissions: user.role.permissions,
//     name: user.name,
//     email: user.email,
//     id: user._id,
//   });
// };





// // exports.logout = async (req, res) => {
// //   await Session.updateOne({ token: req.token }, { isValid: false });

// //   try {
// //     const userId = req.user?._id || req.user?.id;

// //     if (userId) {
// //       const today = startOfDay();
// //       const attendance = await Attendance.findOne({ user: userId, date: today });

// //       if (attendance) {
// //         const now = new Date();
// //         let openSession = null;
// //         for (let i = attendance.sessions.length - 1; i >= 0; i--) {
// //           if (!attendance.sessions[i].logoutTime) {
// //             openSession = attendance.sessions[i];
// //             break;
// //           }
// //         }

// //         if (openSession) {
// //           const duration = Math.max(
// //             0,
// //             Math.floor((now - openSession.loginTime) / 1000)
// //           );
// //           openSession.logoutTime = now;
// //           openSession.duration = duration;
// //           attendance.totalDuration += duration;
// //         }

// //         attendance.logoutTime = now;
// //         await attendance.save();
// //         try {
// //           const io = socket.getIO();
// //           const payload = {
// //             userId,
// //             logoutTime: now,
// //             sessionDuration: openSession ? openSession.duration : 0,
// //             totalDuration: attendance.totalDuration,
// //           };
// //           io.to("admin").emit("attendance-checkout", payload);
// //           io.emit("attendance-checkout", payload);
// //         } catch (socketErr) {
// //           console.error("Socket emit (checkout) failed:", socketErr.message);
// //         }
// //       } else {
// //         console.warn(`Logout: no attendance doc found today for user ${userId}`);
// //       }
// //     }
// //   } catch (err) {
// //     console.error("Attendance logout error:", err);
// //   }

// //   res.json({ message: "Logged out" });
// // };






// exports.logout = async (req, res) => {
//   await Session.updateOne({ token: req.token }, { isValid: false });

//   try {
//     const userId = req.user?._id || req.user?.id;
//     if (userId) {
//       await closeOpenSessionNow(userId, "manual");
//     }
//   } catch (err) {
//     console.error("Attendance logout error:", err);
//   }

//   res.json({ message: "Logged out" });
// };




// // exports.logout = async (req, res) => {
// //   await Session.updateOne({ token: req.token }, { isValid: false });

// //   try {
// //     const userId = req.user?._id || req.user?.id;

// //     if (userId) {
// //       const today = startOfDay();
// //       const attendance = await Attendance.findOne({ user: userId, date: today });

// //       if (attendance) {
// //         const now = new Date();

// //         // Walk from the end to find the open session (guaranteed to reference
// //         // the live subdocument, not a copy)
// //         let openSession = null;
// //         for (let i = attendance.sessions.length - 1; i >= 0; i--) {
// //           if (!attendance.sessions[i].logoutTime) {
// //             openSession = attendance.sessions[i];
// //             break;
// //           }
// //         }

// //         if (openSession) {
// //           const duration = Math.max(
// //             0,
// //             Math.floor((now - openSession.loginTime) / 1000)
// //           );
// //           openSession.logoutTime = now;
// //           openSession.duration = duration;
// //           attendance.totalDuration += duration;
// //         }

// //         attendance.logoutTime = now;
// //         await attendance.save();
// //       }
// //     }
// //   } catch (err) {
// //     console.error("Attendance logout error:", err);
// //   }
  

// //   res.json({ message: "Logged out" });
// // };





































const User = require("../models/User");
const Session = require("../models/Session");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const Role = require("../models/Role")
const Attendance = require("../models/Attendance");
const socket = require("../socket");

const { recordCheckIn, closeOpenSessionNow } = require("./attendanceCleanup");



 function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS 
  }
});


exports.register = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    const roleId = await Role.findById(role);
    if (!roleId) {
      return res.status(400).json({ message: "Invalid role selected" });
    }

    const tempPassword = crypto.randomInt(1000, 10000).toString();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: roleId._id,
      isActive: true
    });

    const loginUrl = process.env.TEAMLOGIN;
    const mailOptions = {
      from: `"TaskFlow Admin" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "🚀 You're Invited to TaskFlow",
      html: `
      <div style="background:#f4f6fb;padding:40px 0;font-family:Arial,Helvetica,sans-serif">
        <table align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08)">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#4f46e5,#3b82f6);padding:24px;text-align:center">
              <h1 style="color:#ffffff;margin:0;font-size:26px;letter-spacing:0.5px">
                TaskFlow
              </h1>
              <p style="color:#e0e7ff;margin:6px 0 0;font-size:14px">
                Task Management System
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px">
              <h2 style="margin:0 0 12px;color:#111827;font-size:22px">
                Welcome, ${name} 👋
              </h2>

              <p style="color:#374151;font-size:15px;line-height:1.6">
                You have been invited to join <strong>TaskFlow</strong> as an
                <strong>${roleId.name}</strong>. Your account has been successfully created.
              </p>

              <!-- Credentials Box -->
              <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin:20px 0">
                <p style="margin:6px 0;font-size:14px;color:#111827">
                  <strong>Login Email:</strong> ${email}
                </p>
                <p style="margin:6px 0;font-size:14px;color:#111827">
                  <strong>Temporary Password:</strong>
                  <span style="background:#e0e7ff;color:#1e3a8a;padding:4px 8px;border-radius:6px;font-weight:bold">
                    ${tempPassword}
                  </span>
                </p>
              </div>

              <!-- CTA -->
              <div style="text-align:center;margin:28px 0">
                <a href="${loginUrl}"
                   style="background:linear-gradient(135deg,#4f46e5,#3b82f6);
                          color:#ffffff;
                          text-decoration:none;
                          padding:14px 28px;
                          border-radius:10px;
                          font-size:15px;
                          font-weight:bold;
                          display:inline-block">
                  Login to TaskFlow
                </a>
              </div>

              <p style="color:#6b7280;font-size:13px;line-height:1.5">
                ⚠️ For security reasons, please log in and change your password immediately after first login.
              </p>

              <p style="margin-top:24px;color:#374151;font-size:14px">
                If you have any questions, feel free to contact your administrator.
              </p>

              <p style="margin-top:16px;font-size:14px;color:#111827">
                Regards,<br/>
                <strong>TaskFlow Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;text-align:center;padding:16px;font-size:12px;color:#9ca3af">
              © ${new Date().getFullYear()} TaskFlow. All rights reserved.
            </td>
          </tr>

        </table>
      </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(201).json({
      message: "User invited successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: roleId.name
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration failed" });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).populate("role");
  if (!user) return res.status(401).json({ message: "Invalid credentials" });

  if (!user.isActive) {
    return res.status(403).json({ message: "Account deactivated" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

  const token = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET
  );

  await Session.create({
    user: user._id,
    token,
    isValid: true,
  });

  // ✅ ATTENDANCE — shared logic, same function the /checkin route uses
  try {
    await recordCheckIn(user._id, user.name);
  } catch (err) {
    console.error("Attendance login error:", err);
  }

  // NOTE: `isOnline` itself is intentionally NOT set here. It's set
  // the moment the frontend's socket connects and emits `join-user`
  // (see socket.js) — that's the point at which the person actually
  // has a live connection, not just a valid token. This keeps a
  // single source of truth for "online": a live socket in the
  // `user:<id>` room, rather than two places (login + socket) that
  // could drift out of sync.

  res.json({
    token,
    role: user.role.name,
    permissions: user.role.permissions,
    name: user.name,
    email: user.email,
    id: user._id,
  });
};

exports.logout = async (req, res) => {
  await Session.updateOne({ token: req.token }, { isValid: false });

  const userId = req.user?._id || req.user?.id;

  try {
    if (userId) {
      await closeOpenSessionNow(userId, "manual");
    }
  } catch (err) {
    console.error("Attendance logout error:", err);
  }

  // ============================================================
  // THE FIX — TEAM STATUS STAYING "ONLINE" AFTER LOGOUT / END DAY
  // ============================================================
  //
  // This endpoint used to ONLY close the attendance session. It never
  // touched `isOnline` on the User document and never told connected
  // clients that this person had gone offline. The ONLY thing that
  // ever flipped `isOnline` to false was the `disconnect` handler in
  // socket.js — which only fires once the browser's socket connection
  // actually tears down.
  //
  // In a normal SPA logout flow (clear the token, redirect to
  // /login — WITHOUT a full page reload) the socket module is a
  // long-lived singleton that's never told to disconnect. So it just
  // keeps sitting there connected, and the person keeps showing
  // "online" indefinitely. A full page refresh "fixed" it only
  // because a fresh page load tears down that old socket connection,
  // finally triggering the disconnect handler that logout itself
  // should have triggered right away.
  //
  // Fix: on logout we now explicitly —
  //   (a) mark the user offline in the DB immediately,
  //   (b) broadcast `user-status-changed` right away, so every admin
  //       viewing the team list updates instantly instead of waiting
  //       on socket-level disconnect detection (which also has its
  //       own 8s debounce in socket.js),
  //   (c) force-disconnect any socket(s) still joined to this user's
  //       room. This both makes the "online" dot disappear
  //       immediately AND prevents a stale socket — still holding a
  //       now-invalidated token — from later re-triggering
  //       `join-user` / `presence-ping`'s `ensureCheckedInToday`,
  //       which would otherwise silently reopen an attendance session
  //       for someone who already logged out.
  //
  // RECOMMENDED FRONTEND COMPLEMENT (not in this file): call
  // `socket.disconnect()` explicitly in your logout handler too,
  // right before or after this API call. This backend fix makes
  // logout correct even if the frontend doesn't do that, but
  // disconnecting client-side as well avoids a ~1 request round trip
  // of the browser still holding a socket open with a dead token.
  // ============================================================

  try {
    if (userId) {
      await User.findByIdAndUpdate(userId, {
        isOnline: false,
        lastSeen: new Date(),
      });

      const io = socket.getIO();

      io.emit("user-status-changed", {
        userId,
        isOnline: false,
      });

      // Force-disconnect any live socket(s) still joined to this
      // user's room, regardless of whether the frontend explicitly
      // disconnects on its own.
      io.in(`user:${userId}`).disconnectSockets(true);
    }
  } catch (err) {
    console.error("Logout online-status update failed:", err.message);
  }

  res.json({ message: "Logged out" });
};
