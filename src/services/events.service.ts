import { RowDataPacket } from 'mysql2';
import { Roles } from '../enums/roles.enum';
import { executeQuery, getConnection } from './database.service';
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

async function updateEvent(
  eventId: number,
  eventName: string,
  type: eventTypes,
) {
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT class_id FROM events WHERE event_id = ?',
    [eventId],
  );
  await executeQuery(
    'UPDATE events SET event_name = ?, type = ? WHERE event_id = ?',
    [eventName, type, eventId],
  );
  if (rows[0]) {
    dataVersionsService.touchClassEvents(rows[0]['class_id']).catch(() => {});
  }
}

async function deleteEvent(eventId: number) {
  // Get the class_id before deleting so we can touch the version
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT class_id FROM events WHERE event_id = ?',
    [eventId],
  );
  if (rows.length === 0) {
    return;
  }
  const classId = rows[0]!['class_id']!;
  await executeQuery('DELETE FROM events WHERE event_id = ?', [eventId]);
  dataVersionsService.touchClassEvents(classId).catch(() => {});
}

async function getClassIdFromEvent(eventId: number): Promise<number | null> {
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT class_id FROM events WHERE event_id = ?',
    [eventId],
  );
  if (rows.length === 0) {
    return null;
  }
  return rows[0]!['class_id']!;
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

/**
 * Create occurrences for today for ALL events across ALL classes in a school
 * that the given user has access to.
 *
 * Uses INSERT IGNORE so duplicate (event_id, occurence_date) pairs are silently
 * skipped — safe to call multiple times on the same day.
 *
 * Returns the list of event IDs that were processed.
 */
async function createSchoolOccurrences(
  userId: number,
  schoolId: number,
): Promise<number[]> {
  // 1. Find all events in classes the user has roles/access in for this school
  const events = await executeQuery<RowDataPacket[]>(
    `SELECT DISTINCT e.event_id
     FROM events e
     INNER JOIN classes c ON e.class_id = c.class_id
     WHERE c.school_id = ?
       AND (
         -- User is admin
         EXISTS (
           SELECT 1 FROM accounts a
           WHERE a.account_id = ? AND a.is_admin = 1
         )
         OR EXISTS (
           SELECT 1 FROM roles r
           WHERE r.account_id = ? AND r.role = 'admin'
         )
         -- User is manager of this school
         OR EXISTS (
           SELECT 1 FROM roles r
           WHERE r.account_id = ? AND r.school_id = ? AND r.role = 'manager'
         )
         -- User has a role in this specific class
         OR EXISTS (
           SELECT 1 FROM roles r
           WHERE r.account_id = ? AND r.class_id = c.class_id
         )
       )`,
    [schoolId, userId, userId, userId, schoolId, userId],
  );

  if (events.length === 0) return [];

  const eventIds: number[] = events.map((e) => e['event_id'] as number);
  const today = new Date().toISOString().slice(0, 10); // yyyy-mm-dd

  // 2. Bulk-insert occurrences (IGNORE skips existing ones)
  const placeholders = eventIds.map(() => '(?, ?)').join(', ');
  const values = eventIds.flatMap((id) => [id, today]);

  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT IGNORE INTO event_occurence (event_id, occurence_date) VALUES ${placeholders}`,
      values,
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  // 3. Touch data-version timestamps for every affected event
  const versionKeys = eventIds.map((id) =>
    dataVersionsService.eventOccurrencesKey(id),
  );
  dataVersionsService.touch(...versionKeys).catch(() => {});

  return eventIds;
}

export default {
  getEvents,
  getEventOccurrences,
  createEventOccurrence,
  deleteLastEventOccurrence,
  createEvent,
  updateEvent,
  deleteEvent,
  createSchoolOccurrences,
  getClassIdFromEvent,
};
