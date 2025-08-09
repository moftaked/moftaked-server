import { Request, Response } from "express";
import attendanceService from "../services/attendance.service";
import { PatchAttendanceDto } from "../schemas/attendance.schemas";

export function patchAttendance(type: 'student' | 'teacher') {
  return async (req: Request, res: Response) => {
    const body: PatchAttendanceDto = req.body;
    await attendanceService.patchAttendance(body.attended, body.absent, parseInt(req.params['eventOccurrenceId'] || ''), type);
    res.json({ message: 'Attendance updated successfully' });
  };
}