// routes/reportRoutes.js
const router = require("express").Router();
const {
  addReport,
  getMyReports,
  getReportsByUser,
deleteReportByAdmin,
   updateReport,
  deleteReport,
  deleteMultipleReports
} = require("../controllers/DailyReport");

const {auth, adminOnly} = require("../middleware/auth.middleware");
const myAuth = require("../middleware/chatAuth")
  
// USER
router.post("/reports", myAuth, addReport);
router.get("/reports/my", myAuth, getMyReports);

router.put("/reports/:id", myAuth, updateReport);
router.delete("/reports/:id", myAuth, deleteReport);

// ADMIN
router.get("/reports/user/:userId", auth, getReportsByUser);
router.delete(
  "/admin/reports/:id",
  auth,
  deleteReportByAdmin
);


router.delete(
  "/admin/reports",
  auth,
  deleteMultipleReports
);



module.exports = router;
