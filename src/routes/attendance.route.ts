import express from 'express';
import { isAuthenticated, isInAttendanceEventClass } from '../middleware/authorization.middleware';
import { getAttendance, patchAttendance } from '../controllers/attendance.controller';
import { Roles } from '../enums/roles.enum';

const attendanceRouter = express.Router();
attendanceRouter.use(isAuthenticated());

attendanceRouter.get(
  '/:eventOccurrenceId/students',
  isInAttendanceEventClass([Roles.teacher, Roles.leader, Roles.manager]),
  getAttendance('student'),
);
attendanceRouter.get(
  '/:eventOccurrenceId/teachers',
  isInAttendanceEventClass([Roles.leader, Roles.manager]),
  getAttendance('teacher'),
);
attendanceRouter.patch(
  '/:eventOccurrenceId/students',
  isInAttendanceEventClass([Roles.teacher, Roles.leader, Roles.manager]),
  patchAttendance('student'),
);
attendanceRouter.patch(
  '/:eventOccurrenceId/teachers',
  isInAttendanceEventClass([Roles.leader, Roles.manager]),
  patchAttendance('teacher'),
);

export default attendanceRouter;
