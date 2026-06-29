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
  getRangedAbsentees,
  getSchoolClassComparison,
  getAbsenceReport,
} from "../controllers/reports.controller";
import { hasRole, isAuthenticated, isInClass, isInAttendanceEventClass, isInEventClass } from "../middleware/authorization.middleware";
import { Roles } from "../enums/roles.enum";
import { sensitiveOperationRateLimiter } from "../middleware/rate-limiting.middleware";

const reportsRouter = Router();
reportsRouter.use(isAuthenticated());

// ---------------------------------------------------------------------------
// Access check – returns what reports the user can see
// ---------------------------------------------------------------------------
// todo: refactor so this route is no longer needed
reportsRouter.get("/access", sensitiveOperationRateLimiter, getReportsAccess);

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
  isInEventClass([Roles.leader, Roles.manager]),
  getLeaderEventReport,
);

reportsRouter.get(
  "/class/:classId/absentees",
  hasRole([Roles.leader, Roles.manager]),
  getAbsentees,
);

reportsRouter.get(
  "/class/:classId/ranged-absentees",
  hasRole([Roles.leader, Roles.manager]),
  getRangedAbsentees,
);

reportsRouter.get(
  "/class/:classId/absence-report",
  hasRole([Roles.leader, Roles.manager]),
  getAbsenceReport,
);

// ---------------------------------------------------------------------------
// Any authenticated user (access checked inside controller)
// ---------------------------------------------------------------------------
reportsRouter.get("/teachers/:eventId", isInAttendanceEventClass([Roles.teacher, Roles.leader, Roles.manager]), getTeacherEventReport);

reportsRouter.get("/class/:classId/summary", isInClass('params', [Roles.teacher, Roles.leader, Roles.manager]), getClassAttendanceSummary);

reportsRouter.get("/class/:classId/dates", isInClass('params', [Roles.teacher, Roles.leader, Roles.manager]), getClassAvailableDates);

reportsRouter.get("/event/:eventId/trends", isInEventClass([Roles.teacher, Roles.leader, Roles.manager]), getEventAttendanceTrends);

reportsRouter.get("/person/:personId/history", getPersonAttendanceHistory);

export default reportsRouter;
