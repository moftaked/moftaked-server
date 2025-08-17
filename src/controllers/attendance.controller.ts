import { NextFunction, Request, Response } from 'express';
import attendanceService from '../services/attendance.service';
import { PatchAttendanceDto } from '../schemas/attendance.schemas';
import createHttpError from 'http-errors';

export function patchAttendance(type: 'student' | 'teacher') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const body: PatchAttendanceDto = req.body;
    const eventOccurrenceId = parseInt(req.params['eventOccurrenceId']!);
    if (isNaN(eventOccurrenceId)) {
      return next(createHttpError(400, 'Event occurrence ID is required'));
    }
    await attendanceService.patchAttendance(
      body.attended,
      body.absent,
      eventOccurrenceId,
      type,
    );
    res.json({ message: 'Attendance updated successfully' });
  };
}
