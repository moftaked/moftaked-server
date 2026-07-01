import { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from './database.service';

/**
 * Ensures the data_versions table exists.
 * Call once at app startup.
 */
async function ensureTable(): Promise<void> {
  await executeQuery(
    `CREATE TABLE IF NOT EXISTS data_versions (
      resource_key VARCHAR(120) NOT NULL PRIMARY KEY,
      last_updated TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;`,
  );
}

/**
 * Touch (upsert) one or more resource keys, setting their last_updated to NOW(3).
 */
async function touch(...resourceKeys: string[]): Promise<void> {
  if (resourceKeys.length === 0) return;
  // Build a single multi-row INSERT … ON DUPLICATE KEY UPDATE
  const placeholders = resourceKeys.map(() => '(?, NOW(3))').join(', ');
  await executeQuery(
    `INSERT INTO data_versions (resource_key, last_updated) VALUES ${placeholders}
     ON DUPLICATE KEY UPDATE last_updated = NOW(3);`,
    resourceKeys,
  );
}

// ---- Convenience helpers for specific resource types ----

function classStudentsKey(classId: number): string {
  return `class_${classId}_students`;
}

function classTeachersKey(classId: number): string {
  return `class_${classId}_teachers`;
}

function classEventsKey(classId: number): string {
  return `class_${classId}_events`;
}

function eventOccurrencesKey(eventId: number): string {
  return `event_${eventId}_occurrences`;
}

function occurrenceAttendanceKey(occurrenceId: number, type?: 'student' | 'teacher'): string {
  if (type) {
    return `occurrence_${occurrenceId}_attendance_${type}`;
  }
  return `occurrence_${occurrenceId}_attendance`;
}

function personProfileKey(personId: number, type: 'student' | 'teacher'): string {
  return `person_${type}_${personId}`;
}

const DISTRICTS_KEY = 'districts';
const CLASSES_KEY = 'classes';
const EQUIPMENT_GROUPS_KEY = 'equipment_groups';

function equipmentGroupItemsKey(groupId: number): string {
  return `equipment_group_${groupId}_items`;
}

async function touchClassStudents(classId: number): Promise<void> {
  await touch(classStudentsKey(classId));
}

async function touchClassTeachers(classId: number): Promise<void> {
  await touch(classTeachersKey(classId));
}

async function touchPersonProfile(personId: number, type: 'student' | 'teacher'): Promise<void> {
  await touch(personProfileKey(personId, type));
}

async function touchClassEvents(classId: number): Promise<void> {
  await touch(classEventsKey(classId));
}

async function touchEventOccurrences(eventId: number): Promise<void> {
  await touch(eventOccurrencesKey(eventId));
}

async function touchOccurrenceAttendance(occurrenceId: number, type?: 'student' | 'teacher'): Promise<void> {
  if (type) {
    await touch(occurrenceAttendanceKey(occurrenceId, type));
  } else {
    // Touch both student and teacher keys
    await touch(
      occurrenceAttendanceKey(occurrenceId, 'student'),
      occurrenceAttendanceKey(occurrenceId, 'teacher'),
    );
  }
}

async function touchEquipmentGroupItems(groupId: number): Promise<void> {
  await touch(equipmentGroupItemsKey(groupId));
}

async function touchDistricts(): Promise<void> {
  await touch(DISTRICTS_KEY);
}

async function touchClasses(): Promise<void> {
  await touch(CLASSES_KEY);
}

/**
 * Retrieve last_updated timestamps for a list of resource keys.
 * Returns a map of resource_key → ISO timestamp string.
 * Keys that have never been touched will be absent from the result.
 */
async function getTimestamps(
  resourceKeys: string[],
): Promise<Record<string, string>> {
  if (resourceKeys.length === 0) return {};
  const placeholders = resourceKeys.map(() => '?').join(', ');
  const rows = await executeQuery<RowDataPacket[]>(
    `SELECT resource_key, last_updated FROM data_versions WHERE resource_key IN (${placeholders});`,
    resourceKeys,
  );
  const result: Record<string, string> = {};
  for (const row of rows) {
    const ts: Date = row['last_updated'];
    result[row['resource_key']] = ts.toISOString();
  }
  return result;
}

/**
 * Build the full set of resource keys a user needs, given their class IDs and
 * the events within those classes, then return all known timestamps.
 */
async function getTimestampsForUser(classIds: number[]): Promise<Record<string, string>> {
  if (classIds.length === 0) return {};

  // Gather event IDs for those classes
  const eventPlaceholders = classIds.map(() => '?').join(', ');
  const eventRows = await executeQuery<RowDataPacket[]>(
    `SELECT event_id FROM events WHERE class_id IN (${eventPlaceholders});`,
    classIds,
  );
  const eventIds: number[] = eventRows.map((r) => r['event_id'] as number);

  // Gather latest occurrence IDs for those events
  let occurrenceIds: number[] = [];
  if (eventIds.length > 0) {
    const ePlaceholders = eventIds.map(() => '?').join(', ');
    const occRows = await executeQuery<RowDataPacket[]>(
      `SELECT eo.event_occurence_id
       FROM event_occurence eo
       INNER JOIN (
         SELECT event_id, MAX(occurence_date) AS max_date
         FROM event_occurence
         WHERE event_id IN (${ePlaceholders})
         GROUP BY event_id
       ) latest ON eo.event_id = latest.event_id AND eo.occurence_date = latest.max_date;`,
      eventIds,
    );
    occurrenceIds = occRows.map((r) => r['event_occurence_id'] as number);
  }

  // Gather person IDs for those classes
  let personIds: { person_id: number; type: 'student' | 'teacher' }[] = [];
  if (classIds.length > 0) {
    const cPlaceholders = classIds.map(() => '?').join(', ');
    const personRows = await executeQuery<RowDataPacket[]>(
      `SELECT DISTINCT person_id, type FROM person_class WHERE class_id IN (${cPlaceholders});`,
      classIds,
    );
    personIds = personRows.map((r) => ({
      person_id: r['person_id'] as number,
      type: r['type'] as 'student' | 'teacher',
    }));
  }

  // Build the full list of resource keys
  const keys: string[] = [CLASSES_KEY, DISTRICTS_KEY];
  for (const cid of classIds) {
    keys.push(classStudentsKey(cid));
    keys.push(classTeachersKey(cid));
    keys.push(classEventsKey(cid));
  }
  for (const eid of eventIds) {
    keys.push(eventOccurrencesKey(eid));
  }
  for (const oid of occurrenceIds) {
    keys.push(occurrenceAttendanceKey(oid, 'student'));
    keys.push(occurrenceAttendanceKey(oid, 'teacher'));
  }
  for (const p of personIds) {
    keys.push(personProfileKey(p.person_id, p.type));
  }

  return getTimestamps(keys);
}

export default {
  ensureTable,
  touch,
  touchClassStudents,
  touchClassTeachers,
  touchClassEvents,
  touchEventOccurrences,
  touchOccurrenceAttendance,
  touchPersonProfile,
  touchDistricts,
  touchClasses,
  touchEquipmentGroupItems,
  getTimestamps,
  getTimestampsForUser,
  // Export key builders so controllers/services can build keys too
  classStudentsKey,
  classTeachersKey,
  classEventsKey,
  eventOccurrencesKey,
  occurrenceAttendanceKey,
  personProfileKey,
  equipmentGroupItemsKey,
  DISTRICTS_KEY,
  CLASSES_KEY,
  EQUIPMENT_GROUPS_KEY,
};