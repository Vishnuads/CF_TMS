const mongoose = require("mongoose");

const TaskMessageSchema = new mongoose.Schema(
  {
    task: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true
    },
      project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" }, 
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",  
      required: true
    },
    message: {
      type: String
    },
     readBy: {
  type: [mongoose.Schema.Types.ObjectId],
  ref: "User",
  default: []
},

  },
  { timestamps: true }
);

module.exports = mongoose.model("TaskMessage", TaskMessageSchema);
