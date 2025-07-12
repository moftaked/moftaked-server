import { Request, Response } from "express";
import rolesService from "../services/roles.service";
import eventsService from "../services/events.service";
import { StatusCodes } from "http-status-codes";
import { EventDto, EventOccurrenceDto } from "../schemas/events.schemas";

export async function getEvents(req: Request, res: Response) {
  let classId: string | number | undefined = req.params["classId"];
  if(!classId) {
    res.status(400).json({ error: "Invalid class ID" }); // handle this in the global error handler
    return;
  }
  classId = parseInt(classId);
  const userId: number = res.locals["user"]["sub"];
  const userRole = await rolesService.getHighestRole(userId, classId);
  res.status(StatusCodes.OK).json({
    success: true,
    data: await eventsService.getEvents(userRole, classId)
  });
}

export async function createEvent(req: Request, res: Response) {
  const body: EventDto = req.body;
  await eventsService.createEvent(body.classId, body.eventName, body.type)
  res.status(StatusCodes.CREATED).json({
    success: true,
  })
}

export async function deleteEvent(req: Request, res: Response) {
  let eventId: string | number | undefined = req.params['eventId'];
  if(!eventId) {
    res.status(400).json({ error: "Invalid event ID" }); // handle this in the global error handler
    return;
  }
  eventId = parseInt(eventId);
  await eventsService.deleteEvent(eventId);
  res.status(StatusCodes.OK).json({
    success: true
  })
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
