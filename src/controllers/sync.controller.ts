import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import classesService from '../services/classes.service';
import dataVersionsService from '../services/data-versions.service';

export async function getTimestamps(_req: Request, res: Response, _next: NextFunction) {
  const userId: number = res.locals['user']['sub'];
  const schools = await classesService.getUserJoinedSchoolsClasses(userId);
  const classIds = schools.flatMap(school => school.classes.map(c => c.class_id));
  const timestamps = await dataVersionsService.getTimestampsForUser(classIds);
  res.status(StatusCodes.OK).json({ success: true, data: timestamps });
}