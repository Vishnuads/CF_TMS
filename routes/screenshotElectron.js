// const express = require("express");
// const router = express.Router();
// const Screenshot = require("../models/ScreenshotElectron");

// // POST screenshot info
// router.post("/screenshot/save", async (req, res) => {
//   try {
//     const { filename, path } = req.body;
//     const screenshot = new Screenshot({ filename, path });
//     await screenshot.save();
//     res.status(200).json({ message: "Screenshot saved" });
//   } catch (error) {
//     res.status(500).json({ error: error.message });
//   }
// });

// module.exports = router;





// // routes/electronRoutes.js
// const express    = require("express");
// const router     = express.Router();
// const Screenshot = require("../models/ScreenshotElectron");
// const Recording  = require("../models/RecordingElectron");

// // POST /api/electron/screenshot/save
// router.post("/screenshot/save", async (req, res) => {
//   try {
//     const { filename, path } = req.body;
//     if (!filename || !path)
//       return res.status(400).json({ error: "filename and path are required" });

//     const doc = await Screenshot.create({ filename, path });
//     res.status(200).json({ message: "Screenshot saved", id: doc._id });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// // POST /api/electron/recording/save
// router.post("/recording/save", async (req, res) => {
//   try {
//     const { type, filename, path } = req.body;
//     if (!type || !filename || !path)
//       return res.status(400).json({ error: "type, filename, and path are required" });

//     const doc = await Recording.create({ type, filename, path });
//     res.status(200).json({ message: "Recording saved", id: doc._id });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;















// routes/electronRoutes.js
//
// What this file does:
//  • POST /api/electron/screenshot/save  — Electron sends { filename, path }
//    after saving the PNG locally.  We copy the file into
//    uploads/screenshots/<userId>/<filename> so Express can serve it,
//    then persist a Screenshot document with the correct imageUrl.
//
//  • POST /api/electron/recording/save   — Same pattern for audio/video blobs.
//    Electron sends { type, filename, path }.
//
//  • GET  /api/electron/screenshots      — Returns this user's screenshots
//    (newest first, paginated).
//
//  • GET  /api/electron/recordings       — Returns this user's recordings.
//
// ── One-time wiring in app.js / server.js ────────────────────────────────────
//   const path = require("path");
//   app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// ─────────────────────────────────────────────────────────────────────────────

const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs-extra"); // npm install fs-extra
const multer = require("multer"); // npm install multer
const Screenshot = require("../models/ScreenshotElectron");
const Recording = require("../models/RecordingElectron");
const authUser = require("../middleware/chatAuth");
const { auth, adminOnly } = require("../middleware/auth.middleware");

// ── Upload root folders ───────────────────────────────────────────────────────
const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");
const SCREENSHOTS_FOLDER = path.join(UPLOADS_ROOT, "screenshots");
const RECORDINGS_FOLDER = path.join(UPLOADS_ROOT, "recordings");

// ── Multer — per-user sub-folders, used only for multipart/form-data uploads ──
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const isRecording = req.path.includes("recording");
      const base = isRecording ? RECORDINGS_FOLDER : SCREENSHOTS_FOLDER;
      // const dest = path.join(base, req.user._id.toString());
      const dest = base;
      await fs.ensureDir(dest);
      cb(null, dest);
    } catch (err) {
      cb(err);
    }
  },
  filename: (_req, file, cb) => {
    // Preserve original filename — Electron already timestamps it
    cb(null, file.originalname);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const ok = /\.(png|jpg|jpeg|webm|mp4|ogg)$/i.test(file.originalname);
    cb(null, ok);
  },
});

// ── Helper: build the public URL served by Express static ─────────────────────
// const toUrl = (subfolder, userId, filename) =>
// `/uploads/${subfolder}/${userId}/${filename}`;

const toUrl = (subfolder, filename) => `/uploads/${subfolder}/${filename}`;

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/electron/screenshot/save
//
//  Supports two modes:
//    A) JSON body  { filename, path: "/abs/path/on/electron/host.png" }
//       → server copies the file from that absolute path into uploads/
//    B) multipart/form-data with field "file"
//       → multer writes it directly into uploads/screenshots/<userId>/
//
//  Idempotent: re-queued offline uploads won't create duplicate DB records.
// ═══════════════════════════════════════════════════════════════════════════
router.post(
  "/screenshot/save",
  authUser,
  upload.single("file"),
  async (req, res) => {
    try {
      const userId = req.user._id.toString();
      let filename, localPath;

      if (req.file) {
        // ── Mode B: binary upload ───────────────────────────────────────
        filename = req.file.filename;
        localPath = req.file.path; // multer already wrote it here
      } else {
        // ── Mode A: JSON { filename, path } ────────────────────────────
        filename = req.body.filename;
        localPath = req.body.path;

        if (!filename || !localPath) {
          return res
            .status(400)
            .json({ error: "filename and path are required" });
        }

        // Copy from Electron's capture folder into our uploads folder
        // const userFolder = path.join(SCREENSHOTS_FOLDER, userId);
        // await fs.ensureDir(userFolder);
        // const destPath = path.join(userFolder, filename);

        await fs.ensureDir(SCREENSHOTS_FOLDER);
        const destPath = path.join(SCREENSHOTS_FOLDER, filename);

        // Skip copy if already present — handles re-queued offline retries
        if (!(await fs.pathExists(destPath))) {
          await fs.copy(localPath, destPath);
        }
      }

      // const imageUrl = toUrl("screenshots", userId, filename);

      const imageUrl = toUrl("screenshots", filename);

      // findOneAndUpdate with $setOnInsert = safe upsert; no duplicate writes
      const doc = await Screenshot.findOneAndUpdate(
        { user: req.user._id, filename },
        {
          $setOnInsert: {
            user: req.user._id,
            filename,
            imageUrl,
            localPath,
            capturedAt: new Date(),
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );

      return res.status(201).json({
        message: "Screenshot saved",
        id: doc._id,
        imageUrl,
      });
    } catch (err) {
      console.error("screenshot/save error:", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════
//  POST /api/electron/recording/save
//
//  Same dual-mode approach (JSON path OR multipart binary).
// ═══════════════════════════════════════════════════════════════════════════
router.post(
  "/recording/save",
  authUser,
  upload.single("file"),
  async (req, res) => {
    try {
      const userId = req.user._id.toString();
      let type, filename, localPath;

      if (req.file) {
        // ── Mode B: binary upload ───────────────────────────────────────
        filename = req.file.filename;
        localPath = req.file.path;
        type =
          req.body.type || (filename.startsWith("audio") ? "audio" : "video");
      } else {
        // ── Mode A: JSON { type, filename, path } ──────────────────────
        type = req.body.type;
        filename = req.body.filename;
        localPath = req.body.path;

        if (!type || !filename || !localPath) {
          return res
            .status(400)
            .json({ error: "type, filename, and path are required" });
        }

        // const userFolder = path.join(RECORDINGS_FOLDER, userId);
        // await fs.ensureDir(userFolder);
        // const destPath = path.join(userFolder, filename);

        await fs.ensureDir(RECORDINGS_FOLDER);
        const destPath = path.join(RECORDINGS_FOLDER, filename);

        if (!(await fs.pathExists(destPath))) {
          await fs.copy(localPath, destPath);
        }
      }

      if (!["audio", "video"].includes(type)) {
        return res
          .status(400)
          .json({ error: "type must be 'audio' or 'video'" });
      }

      const fileUrl = toUrl("recordings", userId, filename);

      const doc = await Recording.create({
        user: req.user._id,
        type,
        filename,
        fileUrl,
        localPath,
        recordedAt: new Date(),
      });

      return res.status(201).json({
        message: "Recording saved",
        id: doc._id,
        fileUrl,
      });
    } catch (err) {
      // Duplicate key error = Electron retry for an already-saved recording
      if (err.code === 11000) {
        const existing = await Recording.findOne({
          user: req.user._id,
          filename: req.body?.filename || req.file?.filename,
        });
        return res
          .status(200)
          .json({ message: "Already saved", id: existing?._id });
      }
      console.error("recording/save error:", err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/electron/screenshots?page=1&limit=20
//  Returns ONLY the requesting user's screenshots, newest first.
// ═══════════════════════════════════════════════════════════════════════════
router.get("/screenshots", authUser, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const [screenshots, total] = await Promise.all([
      Screenshot.find({ user: req.user._id })
        .sort({ capturedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("filename imageUrl capturedAt createdAt"),
      Screenshot.countDocuments({ user: req.user._id }),
    ]);

    return res.json({
      screenshots,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/electron/recordings?page=1&limit=20&type=video
// ═══════════════════════════════════════════════════════════════════════════
router.get("/recordings", authUser, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = { user: req.user._id };
    if (req.query.type) filter.type = req.query.type;

    const [recordings, total] = await Promise.all([
      Recording.find(filter)
        .sort({ recordedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("type filename fileUrl recordedAt createdAt"),
      Recording.countDocuments(filter),
    ]);

    return res.json({
      recordings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});








// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/screenshots/user/:userId
//  Admin views a specific employee's screenshots.
//  Supports optional date-range filtering via ?from=YYYY-MM-DD&to=YYYY-MM-DD
// ═══════════════════════════════════════════════════════════════════════════
router.get("/screenshots/user/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;                      // ← employee's ID from URL
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const skip  = (page - 1) * limit;

    // Optional date-range filter
    const dateFilter = {};
    if (req.query.from) {
      dateFilter.$gte = new Date(req.query.from);
    }
    if (req.query.to) {
      // Include the full "to" day up to 23:59:59
      const to = new Date(req.query.to);
      to.setHours(23, 59, 59, 999);
      dateFilter.$lte = to;
    }

    const query = { user: userId };
    if (Object.keys(dateFilter).length) {
      query.capturedAt = dateFilter;
    }

    const [screenshots, total] = await Promise.all([
      Screenshot.find(query)
        .sort({ capturedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("filename imageUrl capturedAt createdAt"),
      Screenshot.countDocuments(query),
    ]);

    // Return flat array — frontend does setShots(res.data) directly
    return res.json(screenshots);
  } catch (err) {
    console.error("GET /screenshots/user/:userId error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  GET /api/screenshots/my
//  Employee views their own screenshots (optional, for self-view)
// ═══════════════════════════════════════════════════════════════════════════
router.get("/my", authUser, async (req, res) => {
  try {
    const page  = Math.max(parseInt(req.query.page)  || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const skip  = (page - 1) * limit;

    const screenshots = await Screenshot.find({ user: req.user._id })
      .sort({ capturedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("filename imageUrl capturedAt createdAt");

    return res.json(screenshots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
//  DELETE /api/screenshots
//  Body: { ids: ["mongoid1", "mongoid2", ...] }
//  Admin bulk-deletes selected screenshots.
// ═══════════════════════════════════════════════════════════════════════════
// router.delete("/screenshots", auth, async (req, res) => {
//   try {
//     const { ids } = req.body;
//     if (!Array.isArray(ids) || ids.length === 0) {
//       return res.status(400).json({ error: "ids array is required" });
//     }
//     const result = await Screenshot.deleteMany({ _id: { $in: ids } });

//     return res.json({ deleted: result.deletedCount });
//   } catch (err) {
//     console.error("DELETE /screenshots error:", err.message);
//     res.status(500).json({ error: err.message });
//   }
// });

router.delete("/screenshots", auth, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "ids array is required" });
    }

    // 1. Get records
    const screenshots = await Screenshot.find({ _id: { $in: ids } });

    // 2. Delete files from SERVER folder
    for (const shot of screenshots) {
      try {
        const filePath = path.join(
          __dirname,
          "..",
          "uploads",
          "screenshots",
          shot.filename
        );

        if (await fs.pathExists(filePath)) {
          await fs.remove(filePath);
          console.log("Deleted:", filePath);
        } else {
          console.log("File not found:", filePath);
        }
      } catch (err) {
        console.error("File delete error:", err.message);
      }
    }

    // 3. Delete DB records
    const result = await Screenshot.deleteMany({ _id: { $in: ids } });

    res.json({
      message: "Screenshots deleted successfully",
      deleted: result.deletedCount,
    });

  } catch (err) {
    console.error("DELETE error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
