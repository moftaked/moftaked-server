import { NextFunction, Request, Response } from 'express';
import attendanceService from '../services/attendance.service';
import { PatchAttendanceDto } from '../schemas/attendance.schemas';
import createHttpError from 'http-errors';
import { StatusCodes } from 'http-status-codes';
import auditLogService, { AuditEventType } from '../services/audit-log.service';
import { authenticatedLocals } from '../middleware/authorization.middleware';

export function getAttendance(type: 'student' | 'teacher') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const eventOccurrenceId = parseInt(req.params['eventOccurrenceId']!);
    if (isNaN(eventOccurrenceId)) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Event occurrence ID is required'));
    }
    const result = await attendanceService.getAttendance(eventOccurrenceId, type);
    res.status(StatusCodes.OK).json({ success: true, data: result });
  };
}

export function patchAttendance(type: 'student' | 'teacher') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const body: PatchAttendanceDto = req.body;
    const eventOccurrenceId = parseInt(req.params['eventOccurrenceId']!);
    if (isNaN(eventOccurrenceId)) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Event occurrence ID is required'));
    }
    const user = (req.res?.locals as authenticatedLocals)?.user;
    const ipAddress = req.ip ?? req.socket.remoteAddress ?? null;
    const userAgent = req.get('User-Agent') ?? null;
    try {
      await attendanceService.patchAttendance(
        body.attended,
        body.absent,
        eventOccurrenceId,
        type,
      );
      auditLogService.log(auditLogService.createLogEntry(AuditEventType.ATTENDANCE_MODIFIED, {
        userId: user?.sub,
        details: { eventOccurrenceId, type, attended: body.attended, absent: body.absent },
        ipAddress,
        userAgent,
      })).catch(() => {});
      res.json({ message: 'Attendance updated successfully' });
    } catch (err) {
      if (err instanceof Error && err.message === 'EDIT_NOT_LATEST') {
        return next(createHttpError(StatusCodes.FORBIDDEN, 'Only the latest occurrence can be edited'));
      }
      return next(err);
    }
  };
}