import { NextFunction, Request, Response } from 'express';
import rolesService from '../services/roles.service';
import eventsService from '../services/events.service';
import { StatusCodes } from 'http-status-codes';
import { EventDto, EventOccurrenceDto, SchoolOccurrenceDto } from '../schemas/events.schemas';
import createHttpError from 'http-errors';
import { Roles } from '../enums/roles.enum';

export async function getEvents(req: Request, res: Response, next: NextFunction) {
  let classId: number = parseInt(req.params['classId']!);
  if (isNaN(classId)) {
    return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid class ID'));
  }
  const userId: number = res.locals['user']['sub'];
  const userRole = await rolesService.getHighestRole(userId, classId);
  if (userRole == undefined) {
    return next(createHttpError(StatusCodes.FORBIDDEN, 'You do not have permission to access this resource'));
  }
  const { studentEvents, teacherEvents, className } = await eventsService.getEvents(userRole, classId);
  res.status(StatusCodes.OK).json({
    success: true,
    data: { studentEvents, teacherEvents },
    role: userRole,
    className,
  });
}

export async function createEvent(req: Request, res: Response) {
  const body: EventDto = req.body;
  await eventsService.createEvent(body.classId, body.eventName, body.type);
  res.status(StatusCodes.CREATED).json({
    success: true,
  });
}

export async function deleteEvent(req: Request, res: Response, next: NextFunction) {
  let eventId: number = parseInt(req.params['eventId']!);
  if (isNaN(eventId)) {
    return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid event ID'));
  }
  await eventsService.deleteEvent(eventId);
  res.status(StatusCodes.OK).json({
    success: true,
  });
}

export async function createEventOccurrence(req: Request, res: Response, next: NextFunction) {
  const body: EventOccurrenceDto = req.body;
  const targetDate = body.date ?? new Date().toISOString().slice(0, 10); // yyyy-mm-dd
  try {
    await eventsService.createEventOccurrence(body.eventId, targetDate);
    res.status(StatusCodes.CREATED).json({ success: true });
  } catch (error: any) {
    if (error && (error.code === 'ER_DUP_ENTRY' || error.errno === 1062)) {
      return next(createHttpError(StatusCodes.CONFLICT, 'Occurrence already exists'));
    }
    next(error);
  }
}

export async function deleteLastEventOccurrence(req: Request, res: Response) {
  const body: EventOccurrenceDto = req.body;
  await eventsService.deleteLastEventOccurrence(body.eventId);
  res.status(StatusCodes.OK).json({ success: true });
}

export async function getEventOccurrences(req: Request, res: Response, next: NextFunction) {
  const eventId = parseInt(req.params['eventId']!);
  if (isNaN(eventId)) {
    return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid event ID'));
  }
  const occurrences = await eventsService.getEventOccurrences(eventId);
  res.status(StatusCodes.OK).json({ success: true, data: occurrences });
}

export async function createSchoolOccurrences(req: Request, res: Response, next: NextFunction) {
  const body: SchoolOccurrenceDto = req.body;
  const userId: number = res.locals['user']['sub'];

  // Verify the user is at least a leader in this school
  const role = await rolesService.getHighestRole(userId, undefined, body.schoolId);
  if (role !== Roles.leader && role !== Roles.manager && role !== Roles.admin) {
    return next(createHttpError(StatusCodes.FORBIDDEN, 'You must be a leader or manager to create a new day for the school'));
  }

  const eventIds = await eventsService.createSchoolOccurrences(userId, body.schoolId, body.date);
  res.status(StatusCodes.CREATED).json({ success: true, eventIds });
}
