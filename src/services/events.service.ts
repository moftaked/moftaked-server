import { RowDataPacket } from 'mysql2';
import { Roles } from '../enums/roles.enum';
import { executeQuery } from './database.service';
import { eventTypes } from '../enums/eventTypes.enum';

async function getEvents(userType: Roles, classId: number) {
  let query = `
    SELECT event_id, event_name from events
    WHERE class_id = ?`;
  if (userType === Roles.teacher) {
    query += " AND (type = 'student' OR type = 'all')";
  }
  const events = await executeQuery<RowDataPacket[]>(query, [classId]);
  const studentEvents = [];
  const teacherEvents = [];
  for (const event of events) {
    if (event['type'] === 'all') {
      studentEvents.push(event);
      teacherEvents.push(event);
    } else if (event['type'] === 'student') {
      studentEvents.push(event);
    } else if (event['type'] === 'teacher') {
      teacherEvents.push(event);
    }
  }
  return { studentEvents, teacherEvents };
}

async function createEvent(
  classId: number,
  eventName: string,
  type: eventTypes,
) {
  await executeQuery(
    `
    INSERT INTO events(class_id, event_name, type)
    VALUES(?, ?, ?)  
  `,
    [classId, eventName, type],
  );
}

async function deleteEvent(eventId: number) {
  await executeQuery(
    `
    DELETE FROM EVENTS WHERE event_id = ?
    `,
    [eventId],
  );
}

async function createEventOccurrence(eventId: number, date: string) {
  await executeQuery(
    `
    INSERT INTO event_occurence (event_id, occurence_date)
    VALUES (?, ?)`,
    [eventId, date],
  );
}

async function deleteLastEventOccurrence(eventId: number) {
  await executeQuery(
    `
    DELETE FROM event_occurence
    WHERE event_id = ?
    ORDER BY occurence_date DESC
    LIMIT 1`,
    [eventId],
  );
}

export default {
  getEvents,
  createEventOccurrence,
  deleteLastEventOccurrence,
  createEvent,
  deleteEvent,
};
