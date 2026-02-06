// controllers/projectController.js
const Project = require("../models/Project");
const socket = require("../socket");




exports.createProject = async (req, res) => {
  try {
    const project = await Project.create({
      ...req.body,
      progress: req.body.progress || 0,
    });

    const populatedProject = await Project.findById(project._id)
      .populate("team_lead", "name email")
      .populate("team_members", "name email");

    // 🔥 REAL-TIME EMIT
    socket.getIO().emit("project-created", populatedProject);

    res.status(201).json(populatedProject);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};


exports.getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate("team_lead", "name email")
      .populate("team_members", "name email");

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    res.json(project);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};




exports.updateProject = async (req, res) => {
  try {
    const updatedProject = await Project.findByIdAndUpdate(
      req.params.id,
      {
        ...req.body,
        start_date: req.body.start_date ? new Date(req.body.start_date) : null,
        end_date: req.body.end_date ? new Date(req.body.end_date) : null,
        progress: Math.min(100, Math.max(0, req.body.progress || 0)),
      },
      { new: true, runValidators: true }
    )
      .populate("team_lead", "name email")
      .populate("team_members", "name email");

    // 🔥 REAL-TIME EMIT
    socket.getIO().emit("project-updated", updatedProject);

    res.json(updatedProject);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};






exports.getProjects = async (req, res) => {
  try {
    const projects = await Project.find().sort({ createdAt: -1 })
    .populate("team_lead", "name email")
      .populate("team_members", "name email");
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE PROJECT
exports.deleteProject = async (req, res) => {
  try {
    await Project.findByIdAndDelete(req.params.id);
        socket.getIO().emit("project-deleted", req.params.id);
    res.json({ message: "Project deleted successfully" });
  } catch (err) {
    res.status(404).json({ message: "Project not found" });
  }
};
