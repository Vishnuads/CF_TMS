// const mongoose = require("mongoose");

// const TaskSchema = new mongoose.Schema(
//   {
//     title: { type: String, required: true },
//     description: String,
    
//     type: {
//     type: String
//     },
//     project: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Project",
//       required: true,
//     },

//     assigned_to: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },

//     status: {
//       type: String,
//       enum: ["TODO", "IN_PROGRESS", "DONE"],
//       default: "TODO",
//     },

//     priority: {
//       type: String,
//       enum: ["LOW", "MEDIUM", "HIGH"],
//       default: "MEDIUM",
//     },

//     due_date: Date,

//     // ✅ Multiple files
//     attachments: [
//       {
//         originalName: String,
//         fileName: String,
//         fileType: String,
//         fileSize: Number,
//         fileUrl: String,
//       },
//     ],
//       isRead: {
//     type: Boolean,
//     default: false, // 👈 REQUIRED
//   },
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("Task", TaskSchema);









const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,

    type: { type: String },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    assigned_to: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    status: {
      type: String,
      enum: ["TODO", "IN_PROGRESS", "DONE"],
      default: "TODO",
    },
    completedAt: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM",
    },

    // ✅ start_date stores full datetime (date + time combined)
    start_date: { type: Date },

    // ✅ due_date stores full datetime (date + time combined)
    due_date: { type: Date },

    attachments: [
      {
        originalName: String,
        fileName: String,
        fileType: String,
        fileSize: Number,
        fileUrl: String,
      },
    ],

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Task", TaskSchema);

