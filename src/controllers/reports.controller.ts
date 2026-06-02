import { NextFunction, Request, Response } from "express";
import reportsService from "../services/reports.service";
import { authenticatedLocals } from "../middleware/authorization.middleware";
import { Result } from "result2";
import { StatusCodes } from "http-status-codes";
import createHttpError from "http-errors";

// ---------------------------------------------------------------------------
// GET /reports/access
// Returns what reports the authenticated user has access to
// ---------------------------------------------------------------------------

export async function getReportsAccess(
  _req: Request,
  res: Response<unknown, authenticatedLocals>,
  next: NextFunction,
) {
  try {
    const access = await reportsService.getReportsAccess(res.locals.user.sub);
    res.status(StatusCodes.OK).json({ success: true, data: access });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/manager/overview?date=
// Manager overview across all managed schools
// ---------------------------------------------------------------------------

export async function getManagarialReports(
  req: Request<unknown, unknown, never, { date: string }>,
  res: Response<unknown, authenticatedLocals>,
  next: NextFunction,
) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const result = await reportsService.getManagarialReports(
      res.locals.user.sub,
      date,
    );
    if (result instanceof Result) return next(result);
    res.status(StatusCodes.OK).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/leaders/:eventId/:type?date=
// Leader event report (existing endpoint kept intact)
// ---------------------------------------------------------------------------

export async function getLeaderEventReport(
  req: Request<
    { eventId: string; type: string },
    any,
    any,
    { date: string }
  >,
  res: Response,
  next: NextFunction,
) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const data = await reportsService.getLeaderEventReport(
      req.params.eventId,
      req.params.type,
      date,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/teachers/:eventId?date=
// Teacher event report (existing endpoint kept intact)
// ---------------------------------------------------------------------------

export async function getTeacherEventReport(
  req: Request<{ eventId: string }, any, any, { date: string }>,
  res: Response,
  next: NextFunction,
) {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const data = await reportsService.getTeacherEventReport(
      req.params.eventId,
      date,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/class/:classId/summary?date=
// Class attendance summary for a specific date
// ---------------------------------------------------------------------------

export async function getClassAttendanceSummary(
  req: Request<{ classId: string }, any, any, { date: string }>,
  res: Response<unknown, authenticatedLocals>,
  next: NextFunction,
) {
  try {
    const classId = parseInt(req.params.classId);
    if (isNaN(classId)) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, "Invalid class ID"));
    }

    // Check user has access to this class
    const role = await reportsService.getUserClassRole(
      res.locals.user.sub,
      classId,
    );
    if (!role) {
      return next(
        createHttpError(StatusCodes.FORBIDDEN, "No access to this class"),
      );
    }

    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const data = await reportsService.getClassAttendanceSummary(classId, date);
    res.status(StatusCodes.OK).json({ success: true, data, role });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/class/:classId/dates?limit=
// Available dates for a class (for date picker)
// ---------------------------------------------------------------------------

export async function getClassAvailableDates(
  req: Request<{ classId: string }, any, any, { limit?: string }>,
  res: Response<unknown, authenticatedLocals>,
  next: NextFunction,
) {
  try {
    const classId = parseInt(req.params.classId);
    if (isNaN(classId)) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, "Invalid class ID"));
    }

    const role = await reportsService.getUserClassRole(
      res.locals.user.sub,
      classId,
    );
    if (!role) {
      return next(
        createHttpError(StatusCodes.FORBIDDEN, "No access to this class"),
      );
    }

    const limit = parseInt(req.query.limit || "30");
    const data = await reportsService.getClassAvailableDates(classId, limit);
    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/event/:eventId/trends?type=&limit=
// Event attendance trends
// ---------------------------------------------------------------------------

export async function getEventAttendanceTrends(
  req: Request<
    { eventId: string },
    any,
    any,
    { type?: string; limit?: string }
  >,
  res: Response<unknown, authenticatedLocals>,
  next: NextFunction,
) {
  try {
    const eventId = parseInt(req.params.eventId);
    if (isNaN(eventId)) {
      return next(
        createHttpError(StatusCodes.BAD_REQUEST, "Invalid event ID"),
      );
    }

    const personType = req.query.type || "student";
    const limit = parseInt(req.query.limit || "10");

    const data = await reportsService.getEventAttendanceTrends(
      eventId,
      personType,
      limit,
    );

    // Verify user has access to the class this event belongs to
    if (data.class_id) {
      const role = await reportsService.getUserClassRole(
        res.locals.user.sub,
        data.class_id,
      );
      if (!role) {
        return next(
          createHttpError(StatusCodes.FORBIDDEN, "No access to this event"),
        );
      }
    }

    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/class/:classId/absentees?date=&eventId=
// Absentees for a specific event on a specific date
// ---------------------------------------------------------------------------

export async function getAbsentees(
  req: Request<
    { classId: string },
    any,
    any,
    { date: string; eventId: string }
  >,
  res: Response<unknown, authenticatedLocals>,
  next: NextFunction,
) {
  try {
    const classId = parseInt(req.params.classId);
    const eventId = parseInt(req.query.eventId);
    if (isNaN(classId) || isNaN(eventId)) {
      return next(
        createHttpError(
          StatusCodes.BAD_REQUEST,
          "Invalid class ID or event ID",
        ),
      );
    }

    const role = await reportsService.getUserClassRole(
      res.locals.user.sub,
      classId,
    );
    if (!role || role === "teacher") {
      return next(
        createHttpError(
          StatusCodes.FORBIDDEN,
          "Only leaders and managers can view absentees",
        ),
      );
    }

    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const data = await reportsService.getAbsentees(classId, eventId, date);
    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/person/:personId/history?type=&limit=
// Individual person attendance history
// ---------------------------------------------------------------------------

export async function getPersonAttendanceHistory(
  req: Request<
    { personId: string },
    any,
    any,
    { type?: string; limit?: string }
  >,
  res: Response<unknown, authenticatedLocals>,
  next: NextFunction,
) {
  try {
    const personId = parseInt(req.params.personId);
    if (isNaN(personId)) {
      return next(
        createHttpError(StatusCodes.BAD_REQUEST, "Invalid person ID"),
      );
    }

    const personType = req.query.type || "student";
    const limit = parseInt(req.query.limit || "20");

    const role = await reportsService.getUserPersonRole(
      res.locals.user.sub,
      personId,
      personType,
    );
    if (!role) {
      return next(
        createHttpError(StatusCodes.FORBIDDEN, "No access to this person"),
      );
    }

    const data = await reportsService.getPersonAttendanceHistory(
      personId,
      personType,
      limit,
    );

    if (!data) {
      return next(createHttpError(StatusCodes.NOT_FOUND, "Person not found"));
    }

    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/class/:classId/chronic-absentees?type=&threshold=&last=
// Chronic absentees (below attendance threshold)
// ---------------------------------------------------------------------------

export async function getChronicAbsentees(
  req: Request<
    { classId: string },
    any,
    any,
    { type?: string; threshold?: string; last?: string }
  >,
  res: Response<unknown, authenticatedLocals>,
  next: NextFunction,
) {
  try {
    const classId = parseInt(req.params.classId);
    if (isNaN(classId)) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, "Invalid class ID"));
    }

    const role = await reportsService.getUserClassRole(
      res.locals.user.sub,
      classId,
    );
    if (!role || role === "teacher") {
      return next(
        createHttpError(
          StatusCodes.FORBIDDEN,
          "Only leaders and managers can view chronic absentees",
        ),
      );
    }

    const personType = req.query.type || "student";
    const threshold = parseInt(req.query.threshold || "50");
    const lastN = parseInt(req.query.last || "5");

    const data = await reportsService.getChronicAbsentees(
      classId,
      personType,
      threshold,
      lastN,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/school/:schoolId/comparison?date=
// School class comparison (manager only)
// ---------------------------------------------------------------------------

export async function getSchoolClassComparison(
  req: Request<{ schoolId: string }, any, any, { date: string }>,
  res: Response<unknown, authenticatedLocals>,
  next: NextFunction,
) {
  try {
    const schoolId = parseInt(req.params.schoolId);
    if (isNaN(schoolId)) {
      return next(
        createHttpError(StatusCodes.BAD_REQUEST, "Invalid school ID"),
      );
    }

    // todo: move auth to route with middleware
    const isManager = await reportsService.isSchoolManager(
      res.locals.user.sub,
      schoolId,
    );
    if (!isManager) {
      return next(
        createHttpError(
          StatusCodes.FORBIDDEN,
          "Only managers can view school comparisons",
        ),
      );
    }

    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const data = await reportsService.getSchoolClassComparison(schoolId, date);
    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /reports/dates?limit=
// Available dates across all classes the user belongs to (for date picker)
// ---------------------------------------------------------------------------

export async function getUserAvailableDates(
  _req: Request,
  res: Response<unknown, authenticatedLocals>,
  next: NextFunction,
) {
  try {
    const data = await reportsService.getUserAvailableDates(
      res.locals.user.sub,
    );
    res.status(StatusCodes.OK).json({ success: true, data });
  } catch (err) {
    next(err);
  }
}
