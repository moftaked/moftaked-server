import { NextFunction, Request, Response } from 'express';
import rolesService from '../services/roles.service';
import eventsService from '../services/events.service';
import { StatusCodes } from 'http-status-codes';
import { EventDto, EventOccurrenceDto } from '../schemas/events.schemas';
import createHttpError from 'http-errors';

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
  res.status(StatusCodes.OK).json({
    success: true,
    data: await eventsService.getEvents(userRole, classId),
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

export async function createEventOccurrence(req: Request, res: Response) {
  const body: EventOccurrenceDto = req.body;
  const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd
  await eventsService.createEventOccurrence(body.eventId, today);
  res.status(StatusCodes.CREATED).json({ success: true });
}

export async function deleteLastEventOccurrence(req: Request, res: Response) {
  const body: EventOccurrenceDto = req.body;
  await eventsService.deleteLastEventOccurrence(body.eventId);
  res.status(StatusCodes.OK).json({ success: true });
}
