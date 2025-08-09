import express from 'express';
import { isAuthenticated } from '../middleware/authorization.middleware';
import { patchAttendance } from '../controllers/attendance.controller';

const attendanceRouter = express.Router();
attendanceRouter.use(isAuthenticated());

// there is no mechanism to check if the user is authorized to edit the attendance of teachers or not
// we need to check if the eventOccurrenceId the user is editing has sufficient permissions
// we can make a middleware that fetches the class the event occurrence belongs to then use the isInClass middleware
attendanceRouter.patch('/:eventOccurrenceId/students', patchAttendance('student'));
attendanceRouter.patch('/:eventOccurrenceId/teachers', patchAttendance('teacher'));

export default attendanceRouter;