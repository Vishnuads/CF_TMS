// routes/projectRoutes.js
const express = require("express");
const router = express.Router();
const controller = require("../controllers/projectController");
const { auth, adminOnly } = require("../middleware/auth.middleware");
const permission = require("../middleware/permission") 

router.post("/project", auth,  permission("projects", "create"),
 controller.createProject);
router.get("/project", auth,  permission("projects", "view"),
 controller.getProjects);
router.get("/project/:id", auth,  permission("projects", "view"),
 controller.getProjectById);
router.put("/project/:id", auth,  permission("projects", "edit"), controller.updateProject);
router.delete("/project/:id", auth, permission("projects", "delete"), controller.deleteProject);
     
module.exports = router;   
