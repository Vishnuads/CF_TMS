const router = require("express").Router();
const { auth } = require("../middleware/auth.middleware");
const permission = require("../middleware/permission");

const {
  getMyPendingApproval,
  listPendingApprovals,
  approvePreviousLogout,
  getMissingLogoutSummary,
  getMissingLogoutForUser
} = require("../controllers/attendanceApproval.controller");

router.get("/pending-approval/me", auth, getMyPendingApproval);

router.get(
  "/pending-approvals",
  auth,
//   permission("attendance", "approve"),
  listPendingApprovals
);

router.post(
  "/approve-logout/:userId",
  auth,
//   permission("attendance", "approve"),
  approvePreviousLogout
);









// NEW
router.get(
  "/missing-logout-summary",
  auth,
//   permission("attendance", "approve"),
  getMissingLogoutSummary
);

router.get(
  "/missing-logout/:userId",
  auth,
//   permission("attendance", "approve"),
  getMissingLogoutForUser
);


module.exports = router;