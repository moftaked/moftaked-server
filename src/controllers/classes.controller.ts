import { StatusCodes } from 'http-status-codes';
import classesService from '../services/classes.service';
import eventsService from '../services/events.service';
import authService from '../services/auth.service';
import { Request, Response, NextFunction } from 'express';
import personsService from '../services/persons.service';
import createHttpError from 'http-errors';
import { CreateSchoolDto, UpdateSchoolDto, CreateClassDto, UpdateClassDto, UpdateEventDto } from '../schemas/classes.schemas';
import rolesService from '../services/roles.service';
import { executeQuery } from '../services/database.service';
import { RowDataPacket } from 'mysql2/promise';

export async function getClasses(_req: Request, res: Response) {
  const userId: number = res.locals['user']['sub'];
  const classes = await classesService.getUserJoinedSchoolsClasses(userId);
  res.status(StatusCodes.OK).json(classes);
}

export async function getStudents(req: Request, res: Response, next: NextFunction) {
  let classId: number = parseInt(req.params['classId']!);
  if (isNaN(classId)) {
    return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid class ID'));
  }
  const students = await classesService.getStudents(classId);
  res.status(StatusCodes.OK).json({ success: true, data: students });
}

export async function getTeachers(req: Request, res: Response, next: NextFunction) {
  let classId: number = parseInt(req.params['classId']!);
  if (isNaN(classId)) {
    return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid class ID'));
  }
  const teachers = await classesService.getTeachers(classId);
  res.status(StatusCodes.OK).json({ success: true, data: teachers });
}

export function deletePerson(type: 'student' | 'teacher') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const personId = parseInt(req.params[type == 'student' ? 'studentId' : 'teacherId']!);
    const classId = parseInt(req.params['classId']!);
    if (isNaN(personId) || isNaN(classId)) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid person ID or class ID'));
    }
    const result = await personsService.unassignPerson(personId, classId, type);
    if (result === 0) {
      return next(createHttpError(404, 'Person not found or not assigned to class'));
    }
    res.status(200).json({ success: true });
  };
}

// ---------------------------------------------------------------------------
// School CRUD
// ---------------------------------------------------------------------------

export async function getSchools(_req: Request, res: Response) {
  const schools = await classesService.getSchools();
  res.status(StatusCodes.OK).json({ success: true, data: schools });
}

export async function createSchool(req: Request, res: Response) {
  const body: CreateSchoolDto = req.body;
  await classesService.createSchool(body.school_name);
  res.status(StatusCodes.CREATED).json({ success: true });
}

export async function updateSchool(req: Request, res: Response, next: NextFunction) {
  const schoolId = parseInt(req.params['schoolId']!, 10);
  if (isNaN(schoolId)) {
    return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid school ID'));
  }
  const body: UpdateSchoolDto = req.body;
  await classesService.updateSchool(schoolId, body.school_name);
  res.status(StatusCodes.OK).json({ success: true });
}

export async function deleteSchool(req: Request, res: Response, next: NextFunction) {
  const schoolId = parseInt(req.params['schoolId']!, 10);
  if (isNaN(schoolId)) {
    return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid school ID'));
  }
  
  const userId = res.locals['user']['sub'];
  if (!(await authService.isAdmin(userId)) && !(await authService.isManagerOfSchool(userId, schoolId))) {
    return next(createHttpError(StatusCodes.FORBIDDEN, 'You are not authorized to delete this school'));
  }
  
  await classesService.deleteSchool(schoolId);
  res.status(StatusCodes.OK).json({ success: true });
}

// ---------------------------------------------------------------------------
// Class CRUD
// ---------------------------------------------------------------------------

export async function getAllClassesWithSchool(_req: Request, res: Response) {
  const user = res.locals['user'] as { sub: number; username: string };
  const isAdmin = await authService.isAdmin(user.sub);
  let classes;
  if (isAdmin) {
    classes = await classesService.getAllClassesWithSchool();
  } else {
    const managedSchools = await rolesService.getManagedSchools(user.sub);
    const schoolIds = managedSchools.map((r: any) => r.school_id);
    if (schoolIds.length === 0) {
      res.status(StatusCodes.OK).json({ success: true, data: [] });
      return;
    }
    const placeholders = schoolIds.map(() => '?').join(',');
    classes = await executeQuery<RowDataPacket[]>(
      `SELECT c.class_id, c.class_name, s.school_id, s.school_name
       FROM classes c
       INNER JOIN schools s ON c.school_id = s.school_id
       WHERE s.school_id IN (${placeholders})
       ORDER BY s.school_name, c.class_name`,
      schoolIds,
    );
  }
  res.status(StatusCodes.OK).json({ success: true, data: classes });
}

export async function createClass(req: Request, res: Response) {
  const body: CreateClassDto = req.body;
  await classesService.createClass(body.class_name, body.school_id);
  res.status(StatusCodes.CREATED).json({ success: true });
}

export async function updateClass(req: Request, res: Response, next: NextFunction) {
  const classId = parseInt(req.params['classId']!, 10);
  if (isNaN(classId)) {
    return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid class ID'));
  }
  const body: UpdateClassDto = req.body;
  await classesService.updateClass(classId, body.class_name);
  res.status(StatusCodes.OK).json({ success: true });
}

export async function deleteClassById(req: Request, res: Response, next: NextFunction) {
  const classId = parseInt(req.params['classId']!, 10);
  if (isNaN(classId)) {
    return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid class ID'));
  }
  const userId = res.locals['user']['sub'];
  if (!(await authService.isAdmin(userId))) {
    const schoolRows = await classesService.getClassSchoolId(classId);
    if (schoolRows.length === 0) {
      return next(createHttpError(StatusCodes.NOT_FOUND, 'Class not found'));
    }
    const schoolId = schoolRows[0]!['school_id'];
    if (!(await authService.isManagerOfSchool(userId, schoolId))) {
      return next(createHttpError(StatusCodes.FORBIDDEN, 'You are not authorized to delete this class'));
    }
  }
  await classesService.deleteClass(classId);
  res.status(StatusCodes.OK).json({ success: true });
}

// ---------------------------------------------------------------------------
// Event update
// ---------------------------------------------------------------------------

export async function updateEvent(req: Request, res: Response, next: NextFunction) {
  const eventId = parseInt(req.params['eventId']!, 10);
  if (isNaN(eventId)) {
    return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid event ID'));
  }
  const body: UpdateEventDto = req.body;
  await eventsService.updateEvent(eventId, body.event_name, body.type as any);
  res.status(StatusCodes.OK).json({ success: true });
}
