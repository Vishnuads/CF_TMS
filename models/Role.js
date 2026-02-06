const mongoose = require("mongoose");

const RoleSchema = new mongoose.Schema({
  name: {
    type: String,  
    unique: true,
    required: true,      
    uppercase: true, // ✅ auto converts to UPPERCASE
    trim: true,
  },

  permissions: [
    {
      page: String, // dashboard, projects, tasks, users
      actions: {
        view: { type: Boolean, default: false },
        create: { type: Boolean, default: false },
        edit: { type: Boolean, default: false },
        delete: { type: Boolean, default: false },
      },
    },
  ],
});

module.exports = mongoose.model("Role", RoleSchema);
