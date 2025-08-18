import { StatusCodes } from 'http-status-codes';
import classesService from '../services/classes.service';
import { Request, Response, NextFunction } from 'express';
import personsService from '../services/persons.service';
import createHttpError from 'http-errors';

export async function getClasses(_req: Request, res: Response) {
  const userId: number = res.locals['user']['sub'];
  const classes = await classesService.getUserJoinedClasses(userId);
  res.status(StatusCodes.OK).json({ success: true, data: classes });
}

export async function getStudents(req: Request, res: Response, next: NextFunction) {
  let classId: number = parseInt(req.params['classId']!);
  if (isNaN(classId)) {
    return next(createHttpError(400, 'Invalid class ID'));
  }
  const students = await classesService.getStudents(classId);
  res.status(StatusCodes.OK).json({ success: true, data: students });
}

export async function getTeachers(req: Request, res: Response, next: NextFunction) {
  let classId: number = parseInt(req.params['classId']!);
  if (isNaN(classId)) {
    return next(createHttpError(400, 'Invalid class ID'));
  }
  const teachers = await classesService.getTeachers(classId);
  res.status(StatusCodes.OK).json({ success: true, data: teachers });
}

export function deletePerson(type: 'student' | 'teacher') {
  return async (req: Request, res: Response, next: NextFunction) => {
    const personId = parseInt(req.params[type == 'student' ? 'studentId' : 'teacherId']!);
    const classId = parseInt(req.params['classId']!);
    if (isNaN(personId) || isNaN(classId)) {
      return next(createHttpError(400, 'Invalid person ID or class ID'));
    }
    const result = await personsService.unassignPerson(personId, classId, type);
    if (result === 0) {
      return next(createHttpError(404, 'Person not found or not assigned to class'));
    }
    res.status(200).json({ success: true });
  };
}