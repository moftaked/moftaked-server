import express from 'express';
import { validateData } from '../middleware/validation.middleware';
import {
  isAuthenticated,
  isInClass,
  isInEventClass,
  hasRole,
} from '../middleware/authorization.middleware';
import { Roles } from '../enums/roles.enum';
import {
  getEvents,
  getEventOccurrences,
  createEventOccurrence,
  createSchoolOccurrences,
  deleteLastEventOccurrence,
  createEvent,
  deleteEvent,
} from '../controllers/events.controller';
import { EventOccurrenceSchema, EventSchema, SchoolOccurrenceSchema } from '../schemas/events.schemas';
import { generalApiRateLimiter } from '../middleware/rate-limiting.middleware';
const eventsRouter = express.Router();

eventsRouter.use(isAuthenticated());

eventsRouter.get('/classes/:classId', getEvents);
eventsRouter.get('/:eventId/occurrences', isInEventClass([Roles.teacher, Roles.leader, Roles.manager]), getEventOccurrences);
eventsRouter.post(
  '/occurrences/school',
  generalApiRateLimiter,
  hasRole([Roles.leader, Roles.manager]),
  validateData(SchoolOccurrenceSchema),
  createSchoolOccurrences,
);
eventsRouter.post(
  '/occurrences',
  generalApiRateLimiter,
  hasRole([Roles.leader, Roles.manager]),
  validateData(EventOccurrenceSchema),
  createEventOccurrence,
);
// if request is deleting an occurrence from an event whatever the class associated with the event, this endpoint will delete it if the classId passed the user is actually in.
eventsRouter.delete(
  '/occurrences',
  isInClass('body', [Roles.leader, Roles.manager]),
  deleteLastEventOccurrence,
);
eventsRouter.post(
  '/',
  generalApiRateLimiter,
  validateData(EventSchema),
  isInClass('body', [Roles.manager]),
  createEvent,
);
// if request is deleting an event whatever the class associated with the event, this endpoint will delete it if the classId passed the user is actually in.
eventsRouter.delete(
  '/:eventId',
  isInEventClass([Roles.manager]),
  deleteEvent,
);

export default eventsRouter;
