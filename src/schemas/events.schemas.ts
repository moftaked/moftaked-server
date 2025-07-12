import {z} from 'zod/v4';
import { eventTypes } from '../enums/eventTypes.enum';

export const EventOccurrenceSchema = z.object({
  eventId: z.number().int().positive(),
});

export type EventOccurrenceDto = z.infer<typeof EventOccurrenceSchema>;

export const EventSchema = z.object({
  classId: z.number().int().positive(),
  eventName: z.string().min(2).max(50),
  type: z.enum(eventTypes)
})

export type EventDto = z.infer<typeof EventSchema>;
