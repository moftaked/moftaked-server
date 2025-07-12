import express from 'express';
import { validateData } from '../middleware/validation.middleware';
import { isAuthenticated, isInClass } from '../middleware/authorization.middleware';
import { Roles } from '../enums/roles.enum';
import { getEvents, createEventOccurrence, deleteLastEventOccurrence, createEvent, deleteEvent} from '../controllers/events.controller';
import { EventOccurrenceSchema } from '../schemas/events.schemas';
const eventsRouter = express.Router();

eventsRouter.use(isAuthenticated());

eventsRouter.get('/classes/:classId', getEvents);
eventsRouter.post('/occurrences', validateData(EventOccurrenceSchema), createEventOccurrence);
eventsRouter.delete('/occurrences', isInClass('body', [Roles.leader, Roles.manager]), deleteLastEventOccurrence);
eventsRouter.post('/', isInClass('body', [Roles.manager]), createEvent);
eventsRouter.delete('/:eventId', isInClass('params', [Roles.manager]), deleteEvent);

export default eventsRouter;