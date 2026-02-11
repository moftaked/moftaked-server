import { Router } from "express";
import {
  getReportsAccess,
  getManagarialReports,
  getLeaderEventReport,
  getTeacherEventReport,
  getClassAttendanceSummary,
  getClassAvailableDates,
  getUserAvailableDates,
  getEventAttendanceTrends,
  getAbsentees,
  getPersonAttendanceHistory,
  getChronicAbsentees,
  getSchoolClassComparison,
} from "../controllers/reports.controller";
import { hasRole, isAuthenticated } from "../middleware/authorization.middleware";
import { Roles } from "../enums/roles.enum";

const reportsRouter = Router();
reportsRouter.use(isAuthenticated());

// ---------------------------------------------------------------------------
// Access check – returns what reports the user can see
// ---------------------------------------------------------------------------
reportsRouter.get("/access", getReportsAccess);

reportsRouter.get("/dates", getUserAvailableDates);

// ---------------------------------------------------------------------------
// Manager endpoints
// ---------------------------------------------------------------------------
reportsRouter.get(
  "/manager/overview",
  hasRole([Roles.manager]),
  getManagarialReports,
);

reportsRouter.get(
  "/school/:schoolId/comparison",
  hasRole([Roles.manager]),
  getSchoolClassComparison,
);

// ---------------------------------------------------------------------------
// Leader / Manager endpoints
// ---------------------------------------------------------------------------
reportsRouter.get(
  "/leaders/:eventId/:type",
  hasRole([Roles.leader, Roles.manager]),
  getLeaderEventReport,
);

reportsRouter.get(
  "/class/:classId/absentees",
  hasRole([Roles.leader, Roles.manager]),
  getAbsentees,
);

reportsRouter.get(
  "/class/:classId/chronic-absentees",
  hasRole([Roles.leader, Roles.manager]),
  getChronicAbsentees,
);

// ---------------------------------------------------------------------------
// Any authenticated user (access checked inside controller)
// ---------------------------------------------------------------------------
reportsRouter.get("/teachers/:eventId", getTeacherEventReport);

reportsRouter.get("/class/:classId/summary", getClassAttendanceSummary);

reportsRouter.get("/class/:classId/dates", getClassAvailableDates);

reportsRouter.get("/event/:eventId/trends", getEventAttendanceTrends);

reportsRouter.get("/person/:personId/history", getPersonAttendanceHistory);

export default reportsRouter;