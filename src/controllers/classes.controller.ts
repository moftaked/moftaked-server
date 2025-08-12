import { StatusCodes } from 'http-status-codes';
import classesService from '../services/classes.service';
import { Request, Response } from 'express';
import personsService from '../services/persons.service';

export async function getClasses(_req: Request, res: Response) {
  const userId: number = res.locals['user']['sub'];
  const classes = await classesService.getUserJoinedClasses(userId);
  res.status(StatusCodes.OK).json({ success: true, data: classes });
}

export async function getStudents(req: Request, res: Response) {
  let classId: string | number | undefined = req.params['classId'];
  if (classId) {
    classId = parseInt(classId);
    const students = await classesService.getStudents(classId);
    res.status(StatusCodes.OK).json({ success: true, data: students });
  } else {
    res.status(400).json({ error: 'Invalid class ID' }); // handle this in the global error handler
  }
}

export async function getTeachers(req: Request, res: Response) {
  let classId: string | number | undefined = req.params['classId'];
  if (classId) {
    classId = parseInt(classId);
    const teachers = await classesService.getTeachers(classId);
    res.status(StatusCodes.OK).json({ success: true, data: teachers });
  } else {
    res.status(400).json({ error: 'Invalid class ID' }); // handle this in the global error handler
  }
}

export function deletePerson(type: 'student' | 'teacher') {
  return async (req: Request, res: Response) => {
    const personId = parseInt(req.params[type == 'student' ? 'studentId' : 'teacherId'] || '');
    const classId = parseInt(req.params['classId'] || '');
    if (isNaN(personId) || isNaN(classId)) {
      res.status(400).json({ error: 'Invalid person ID or class ID' });
      return;
    }
    const result = await personsService.unassignPerson(personId, classId, type);
    if (result === 0) {
      res.status(404).json({ error: 'Person not found or not assigned to class' });
      return;
    }
    res.status(200).json({ success: true });
  };
}