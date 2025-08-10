import express from 'express';
import { validateData } from '../middleware/validation.middleware';
import { isAuthenticated, isInClass } from '../middleware/authorization.middleware';
import { Roles } from '../enums/roles.enum';
import { getEvents, createEventOccurrence, deleteLastEventOccurrence, createEvent, deleteEvent} from '../controllers/events.controller';
import { EventOccurrenceSchema, EventSchema } from '../schemas/events.schemas';
const eventsRouter = express.Router();

eventsRouter.use(isAuthenticated());

eventsRouter.get('/classes/:classId', getEvents);
eventsRouter.post('/occurrences', validateData(EventOccurrenceSchema), createEventOccurrence);
// if request is deleting an occurrence from an event whatever the class associated with the event, this endpoint will delete it if the classId passed the user is actually in.
eventsRouter.delete('/occurrences', isInClass('body', [Roles.leader, Roles.manager]), deleteLastEventOccurrence);
eventsRouter.post('/', validateData(EventSchema), isInClass('body', [Roles.manager]), createEvent);
// if request is deleting an event whatever the class associated with the event, this endpoint will delete it if the classId passed the user is actually in.
eventsRouter.delete('/:eventId', isInClass('body', [Roles.manager]), deleteEvent);

export default eventsRouter;