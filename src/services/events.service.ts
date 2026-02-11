import { RowDataPacket } from 'mysql2';
import { Roles } from '../enums/roles.enum';
import { executeQuery } from './database.service';
import { eventTypes } from '../enums/eventTypes.enum';
import dataVersionsService from './data-versions.service';

async function getEvents(userType: Roles, classId: number) {
  let query = `
    SELECT event_id, event_name, type from events
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
  dataVersionsService.touchClassEvents(classId).catch(() => {});
}

async function deleteEvent(eventId: number) {
  // Get the class_id before deleting so we can touch the version
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT class_id FROM events WHERE event_id = ?',
    [eventId],
  );
  await executeQuery(
    `
    DELETE FROM EVENTS WHERE event_id = ?
    `,
    [eventId],
  );
  if (rows[0]) {
    dataVersionsService.touchClassEvents(rows[0]['class_id']).catch(() => {});
  }
}

async function createEventOccurrence(eventId: number, date: string) {
  await executeQuery(
    `
    INSERT INTO event_occurence (event_id, occurence_date)
    VALUES (?, ?)`,
    [eventId, date],
  );
  dataVersionsService.touchEventOccurrences(eventId).catch(() => {});
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
  dataVersionsService.touchEventOccurrences(eventId).catch(() => {});
}

async function getEventOccurrences(eventId: number) {
  const occurrences = await executeQuery<RowDataPacket[]>(
    `SELECT event_occurence_id, DATE_FORMAT(occurence_date, '%Y-%m-%d') as occurence_date
     FROM event_occurence
     WHERE event_id = ?
     ORDER BY occurence_date DESC`,
    [eventId],
  );
  return occurrences;
}

export default {
  getEvents,
  getEventOccurrences,
  createEventOccurrence,
  deleteLastEventOccurrence,
  createEvent,
  deleteEvent,
};
