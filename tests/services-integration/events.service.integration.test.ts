import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import bcrypt from 'bcrypt';
import {
  createTestDatabase,
  dropTestDatabase,
  truncateAllTables,
  seedTestData,
  SeedSchool,
  SeedDistrict,
  SeedAccount,
} from '../helpers/test-db';
import eventsService from '../../src/services/events.service';
import { Roles } from '../../src/enums/roles.enum';
import { eventTypes } from '../../src/enums/eventTypes.enum';
import { executeQuery } from '../../src/services/database.service';
import { RowDataPacket } from 'mysql2/promise';

describe('Events Service — DB Integration', () => {
  let school1: SeedSchool;
  let school2: SeedSchool;
  let district: SeedDistrict;
  let account1: SeedAccount;

  let school1Id: number;
  let school2Id: number;
  let class1Id: number;
  let class2Id: number;
  let class3Id: number;

  beforeAll(async () => {
    await createTestDatabase();
  });

  afterAll(async () => {
    await dropTestDatabase();
  });

  beforeEach(async () => {
    await truncateAllTables();

    const hashedPassword = await bcrypt.hash('TestPass1', 10);
    school1 = { school_name: 'School Alpha' };
    school2 = { school_name: 'School Beta' };
    district = { district_name: 'Test District' };
    account1 = { username: 'user_one', password: hashedPassword, real_name: 'User One' };

    const baseSeed = await seedTestData({
      schools: [school1, school2],
      districts: [district],
      accounts: [account1],
    });

    school1Id = baseSeed.schoolIds[0]!;
    school2Id = baseSeed.schoolIds[1]!;

    const classSeed = await seedTestData({
      classes: [
        { class_name: 'Class A', school_id: school1Id },
        { class_name: 'Class B', school_id: school1Id },
        { class_name: 'Class C', school_id: school2Id },
      ],
    });

    class1Id = classSeed.classIds[0]!;
    class2Id = classSeed.classIds[1]!;
    class3Id = classSeed.classIds[2]!;
  });

  // ---------------------------------------------------------------------------
  // createEvent() / getEvents()
  // ---------------------------------------------------------------------------

  describe('createEvent()', () => {
    it('should insert an event and be retrievable via getEvents', async () => {
      await eventsService.createEvent(class1Id, 'حضور الطلاب', eventTypes.student);

      const { studentEvents, teacherEvents } = await eventsService.getEvents(Roles.leader, class1Id);

      expect(studentEvents).toHaveLength(1);
      expect(studentEvents[0]).toMatchObject({
        event_name: 'حضور الطلاب',
        type: 'student',
      });
      expect(studentEvents[0]!['event_id']).toBeDefined();
      // Student-only events should not appear in teacherEvents
      expect(teacherEvents).toHaveLength(0);
    });

    it('should insert a teacher-type event', async () => {
      await eventsService.createEvent(class1Id, 'Teacher Meeting', eventTypes.teacher);

      const { studentEvents, teacherEvents } = await eventsService.getEvents(Roles.leader, class1Id);

      expect(teacherEvents).toHaveLength(1);
      expect(teacherEvents[0]).toMatchObject({
        event_name: 'Teacher Meeting',
        type: 'teacher',
      });
      // Teacher-only events should not appear in studentEvents
      expect(studentEvents).toHaveLength(0);
    });

    it('should insert an "all" type event that appears in both studentEvents and teacherEvents', async () => {
      await eventsService.createEvent(class1Id, 'General Assembly', eventTypes.all);

      const { studentEvents, teacherEvents } = await eventsService.getEvents(Roles.leader, class1Id);

      expect(studentEvents).toHaveLength(1);
      expect(studentEvents[0]!['event_name']).toBe('General Assembly');
      expect(studentEvents[0]!['type']).toBe('all');

      expect(teacherEvents).toHaveLength(1);
      expect(teacherEvents[0]!['event_name']).toBe('General Assembly');
      expect(teacherEvents[0]!['type']).toBe('all');
    });

    it('should handle Arabic event names', async () => {
      await eventsService.createEvent(class1Id, 'اجتماع المعلمين', eventTypes.teacher);

      const { teacherEvents } = await eventsService.getEvents(Roles.leader, class1Id);
      expect(teacherEvents).toHaveLength(1);
      expect(teacherEvents[0]!['event_name']).toBe('اجتماع المعلمين');
    });

    it('should create multiple events for the same class', async () => {
      await eventsService.createEvent(class1Id, 'Event 1', eventTypes.student);
      await eventsService.createEvent(class1Id, 'Event 2', eventTypes.teacher);
      await eventsService.createEvent(class1Id, 'Event 3', eventTypes.all);

      const { studentEvents, teacherEvents } = await eventsService.getEvents(Roles.leader, class1Id);

      // studentEvents: Event 1 (student) + Event 3 (all) = 2
      expect(studentEvents).toHaveLength(2);
      // teacherEvents: Event 2 (teacher) + Event 3 (all) = 2
      expect(teacherEvents).toHaveLength(2);
    });
  });

  describe('getEvents()', () => {
    beforeEach(async () => {
      await eventsService.createEvent(class1Id, 'Student Only', eventTypes.student);
      await eventsService.createEvent(class1Id, 'Teacher Only', eventTypes.teacher);
      await eventsService.createEvent(class1Id, 'Both Types', eventTypes.all);
    });

    it('should return all event types for a leader/manager role', async () => {
      const { studentEvents, teacherEvents } = await eventsService.getEvents(Roles.leader, class1Id);

      expect(studentEvents).toHaveLength(2); // student + all
      expect(teacherEvents).toHaveLength(2); // teacher + all

      const studentNames = studentEvents.map((e) => e['event_name']);
      expect(studentNames).toContain('Student Only');
      expect(studentNames).toContain('Both Types');

      const teacherNames = teacherEvents.map((e) => e['event_name']);
      expect(teacherNames).toContain('Teacher Only');
      expect(teacherNames).toContain('Both Types');
    });

    it('should filter out teacher-only events for a teacher role', async () => {
      const { studentEvents, teacherEvents } = await eventsService.getEvents(Roles.teacher, class1Id);

      // Teacher role query adds: AND (type = 'student' OR type = 'all')
      // So only student and all events are returned
      const allReturned = [...studentEvents, ...teacherEvents];
      const allNames = allReturned.map((e) => e['event_name']);

      // 'Student Only' (student) and 'Both Types' (all) should be returned
      expect(studentEvents).toHaveLength(2); // student + all
      expect(studentNames(studentEvents)).toContain('Student Only');
      expect(studentNames(studentEvents)).toContain('Both Types');

      // Teacher-only events should NOT be returned for teacher role
      expect(allNames).not.toContain('Teacher Only');
    });

    it('should return manager results same as leader', async () => {
      const { studentEvents, teacherEvents } = await eventsService.getEvents(Roles.manager, class1Id);

      expect(studentEvents).toHaveLength(2);
      expect(teacherEvents).toHaveLength(2);
    });

    it('should return empty arrays when class has no events', async () => {
      const { studentEvents, teacherEvents } = await eventsService.getEvents(Roles.leader, class2Id);

      expect(studentEvents).toEqual([]);
      expect(teacherEvents).toEqual([]);
    });

    it('should only return events for the specified class', async () => {
      // Add an event to class2
      await eventsService.createEvent(class2Id, 'Class2 Event', eventTypes.student);

      const class1Results = await eventsService.getEvents(Roles.leader, class1Id);
      const class2Results = await eventsService.getEvents(Roles.leader, class2Id);

      // class1 should have 3 events (from beforeEach), class2 should have 1
      expect(class1Results.studentEvents.length + class1Results.teacherEvents.length).toBeGreaterThanOrEqual(3);
      expect(class2Results.studentEvents).toHaveLength(1);
      expect(class2Results.studentEvents[0]!['event_name']).toBe('Class2 Event');
    });
  });

  // ---------------------------------------------------------------------------
  // updateEvent()
  // ---------------------------------------------------------------------------

  describe('updateEvent()', () => {
    it('should update the event name and type', async () => {
      await eventsService.createEvent(class1Id, 'Original Name', eventTypes.student);

      const { studentEvents } = await eventsService.getEvents(Roles.leader, class1Id);
      const eventId = studentEvents[0]!['event_id'] as number;

      await eventsService.updateEvent(eventId, 'Updated Name', eventTypes.teacher);

      const afterUpdate = await eventsService.getEvents(Roles.leader, class1Id);
      // Should now be a teacher event, not a student event
      expect(afterUpdate.studentEvents).toHaveLength(0);
      expect(afterUpdate.teacherEvents).toHaveLength(1);
      expect(afterUpdate.teacherEvents[0]!['event_name']).toBe('Updated Name');
      expect(afterUpdate.teacherEvents[0]!['type']).toBe('teacher');
    });

    it('should not affect other events', async () => {
      await eventsService.createEvent(class1Id, 'Keep This', eventTypes.student);
      await eventsService.createEvent(class1Id, 'Change This', eventTypes.student);

      const { studentEvents } = await eventsService.getEvents(Roles.leader, class1Id);
      const changeEvent = studentEvents.find((e) => e['event_name'] === 'Change This');

      await eventsService.updateEvent(changeEvent!['event_id'] as number, 'Changed', eventTypes.all);

      const afterUpdate = await eventsService.getEvents(Roles.leader, class1Id);
      const keepEvent = afterUpdate.studentEvents.find((e) => e['event_name'] === 'Keep This');
      expect(keepEvent).toBeDefined();
      expect(keepEvent!['type']).toBe('student');
    });
  });

  // ---------------------------------------------------------------------------
  // deleteEvent()
  // ---------------------------------------------------------------------------

  describe('deleteEvent()', () => {
    it('should delete the event', async () => {
      await eventsService.createEvent(class1Id, 'To Delete', eventTypes.student);

      const { studentEvents } = await eventsService.getEvents(Roles.leader, class1Id);
      const eventId = studentEvents[0]!['event_id'] as number;

      await eventsService.deleteEvent(eventId);

      const afterDelete = await eventsService.getEvents(Roles.leader, class1Id);
      expect(afterDelete.studentEvents).toHaveLength(0);
      expect(afterDelete.teacherEvents).toHaveLength(0);
    });

    it('should cascade delete event occurrences when event is deleted', async () => {
      await eventsService.createEvent(class1Id, 'Cascade Evt', eventTypes.student);

      const { studentEvents } = await eventsService.getEvents(Roles.leader, class1Id);
      const eventId = studentEvents[0]!['event_id'] as number;

      await eventsService.createEventOccurrence(eventId, '2025-01-10');
      await eventsService.createEventOccurrence(eventId, '2025-01-11');

      const occsBefore = await eventsService.getEventOccurrences(eventId);
      expect(occsBefore).toHaveLength(2);

      await eventsService.deleteEvent(eventId);

      const occsAfter = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM event_occurence WHERE event_id = ?',
        [eventId],
      );
      expect(occsAfter).toHaveLength(0);
    });

    it('should not affect events in other classes', async () => {
      await eventsService.createEvent(class1Id, 'Class1 Evt', eventTypes.student);
      await eventsService.createEvent(class2Id, 'Class2 Evt', eventTypes.student);

      const class1Events = await eventsService.getEvents(Roles.leader, class1Id);
      const eventId = class1Events.studentEvents[0]!['event_id'] as number;

      await eventsService.deleteEvent(eventId);

      const class2Events = await eventsService.getEvents(Roles.leader, class2Id);
      expect(class2Events.studentEvents).toHaveLength(1);
      expect(class2Events.studentEvents[0]!['event_name']).toBe('Class2 Evt');
    });
  });

  // ---------------------------------------------------------------------------
  // Event Occurrences
  // ---------------------------------------------------------------------------

  describe('createEventOccurrence()', () => {
    let eventId: number;

    beforeEach(async () => {
      await eventsService.createEvent(class1Id, 'Occ Event', eventTypes.student);
      const { studentEvents } = await eventsService.getEvents(Roles.leader, class1Id);
      eventId = studentEvents[0]!['event_id'] as number;
    });

    it('should insert an occurrence and be retrievable via getEventOccurrences', async () => {
      await eventsService.createEventOccurrence(eventId, '2025-03-15');

      const occurrences = await eventsService.getEventOccurrences(eventId);
      expect(occurrences).toHaveLength(1);
      expect(occurrences[0]!['occurence_date']).toBe('2025-03-15');
      expect(occurrences[0]!['event_occurence_id']).toBeDefined();
    });

    it('should insert multiple occurrences with different dates', async () => {
      await eventsService.createEventOccurrence(eventId, '2025-03-10');
      await eventsService.createEventOccurrence(eventId, '2025-03-11');
      await eventsService.createEventOccurrence(eventId, '2025-03-12');

      const occurrences = await eventsService.getEventOccurrences(eventId);
      expect(occurrences).toHaveLength(3);
    });

    it('should reject duplicate (event_id, occurence_date) combinations (UNIQUE constraint)', async () => {
      await eventsService.createEventOccurrence(eventId, '2025-03-15');

      await expect(
        eventsService.createEventOccurrence(eventId, '2025-03-15'),
      ).rejects.toThrow();
    });
  });

  describe('getEventOccurrences()', () => {
    let eventId: number;

    beforeEach(async () => {
      await eventsService.createEvent(class1Id, 'Occ List Event', eventTypes.student);
      const { studentEvents } = await eventsService.getEvents(Roles.leader, class1Id);
      eventId = studentEvents[0]!['event_id'] as number;
    });

    it('should return occurrences ordered by date DESC (most recent first)', async () => {
      await eventsService.createEventOccurrence(eventId, '2025-01-01');
      await eventsService.createEventOccurrence(eventId, '2025-06-15');
      await eventsService.createEventOccurrence(eventId, '2025-03-10');

      const occurrences = await eventsService.getEventOccurrences(eventId);
      expect(occurrences).toHaveLength(3);
      expect(occurrences[0]!['occurence_date']).toBe('2025-06-15');
      expect(occurrences[1]!['occurence_date']).toBe('2025-03-10');
      expect(occurrences[2]!['occurence_date']).toBe('2025-01-01');
    });

    it('should return dates formatted as YYYY-MM-DD strings', async () => {
      await eventsService.createEventOccurrence(eventId, '2025-07-04');

      const occurrences = await eventsService.getEventOccurrences(eventId);
      expect(occurrences).toHaveLength(1);
      expect(occurrences[0]!['occurence_date']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should return empty array when event has no occurrences', async () => {
      const occurrences = await eventsService.getEventOccurrences(eventId);
      expect(occurrences).toEqual([]);
    });

    it('should return rows with event_occurence_id and occurence_date columns', async () => {
      await eventsService.createEventOccurrence(eventId, '2025-05-20');

      const occurrences = await eventsService.getEventOccurrences(eventId);
      expect(occurrences[0]).toHaveProperty('event_occurence_id');
      expect(occurrences[0]).toHaveProperty('occurence_date');
    });
  });

  describe('deleteLastEventOccurrence()', () => {
    let eventId: number;

    beforeEach(async () => {
      await eventsService.createEvent(class1Id, 'Del Last Event', eventTypes.student);
      const { studentEvents } = await eventsService.getEvents(Roles.leader, class1Id);
      eventId = studentEvents[0]!['event_id'] as number;
    });

    it('should delete only the most recent occurrence (ORDER BY DESC LIMIT 1)', async () => {
      await eventsService.createEventOccurrence(eventId, '2025-01-01');
      await eventsService.createEventOccurrence(eventId, '2025-06-15');
      await eventsService.createEventOccurrence(eventId, '2025-03-10');

      await eventsService.deleteLastEventOccurrence(eventId);

      const occurrences = await eventsService.getEventOccurrences(eventId);
      expect(occurrences).toHaveLength(2);

      const dates = occurrences.map((o) => o['occurence_date']);
      // The most recent (2025-06-15) should be gone
      expect(dates).not.toContain('2025-06-15');
      expect(dates).toContain('2025-03-10');
      expect(dates).toContain('2025-01-01');
    });

    it('should not throw when there are no occurrences to delete', async () => {
      await expect(
        eventsService.deleteLastEventOccurrence(eventId),
      ).resolves.not.toThrow();
    });

    it('should delete successive last occurrences when called multiple times', async () => {
      await eventsService.createEventOccurrence(eventId, '2025-01-01');
      await eventsService.createEventOccurrence(eventId, '2025-02-01');
      await eventsService.createEventOccurrence(eventId, '2025-03-01');

      await eventsService.deleteLastEventOccurrence(eventId);
      let occurrences = await eventsService.getEventOccurrences(eventId);
      expect(occurrences).toHaveLength(2);
      expect(occurrences[0]!['occurence_date']).toBe('2025-02-01');

      await eventsService.deleteLastEventOccurrence(eventId);
      occurrences = await eventsService.getEventOccurrences(eventId);
      expect(occurrences).toHaveLength(1);
      expect(occurrences[0]!['occurence_date']).toBe('2025-01-01');

      await eventsService.deleteLastEventOccurrence(eventId);
      occurrences = await eventsService.getEventOccurrences(eventId);
      expect(occurrences).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // createSchoolOccurrences()
  // ---------------------------------------------------------------------------

  describe('createSchoolOccurrences()', () => {
    let event1Id: number;
    let event2Id: number;
    let event3Id: number;

    beforeEach(async () => {
      // Give account1 roles in school1's classes so it can access them
      await seedTestData({
        roles: [
          {
            account_id: account1.account_id!,
            class_id: class1Id,
            role: 'leader',
            school_id: school1Id,
          },
          {
            account_id: account1.account_id!,
            class_id: class2Id,
            role: 'teacher',
            school_id: school1Id,
          },
        ],
      });

      // Create events in school1's classes
      await eventsService.createEvent(class1Id, 'Evt A', eventTypes.student);
      await eventsService.createEvent(class1Id, 'Evt B', eventTypes.teacher);
      await eventsService.createEvent(class2Id, 'Evt C', eventTypes.all);

      // Also create an event in school2 (should NOT be affected)
      await eventsService.createEvent(class3Id, 'Evt D (Other School)', eventTypes.student);

      // Grab all event IDs
      const allEvents = await executeQuery<RowDataPacket[]>(
        'SELECT event_id, event_name FROM events ORDER BY event_id',
      );
      event1Id = allEvents.find((e) => e['event_name'] === 'Evt A')!['event_id'] as number;
      event2Id = allEvents.find((e) => e['event_name'] === 'Evt B')!['event_id'] as number;
      event3Id = allEvents.find((e) => e['event_name'] === 'Evt C')!['event_id'] as number;
    });

    it('should create occurrences for today for ALL events across user-accessible classes in the school', async () => {
      const eventIds = await eventsService.createSchoolOccurrences(
        account1.account_id!,
        school1Id,
      );

      // Should process events in class1 (Evt A, Evt B) and class2 (Evt C) = 3 events
      expect(eventIds).toHaveLength(3);
      expect(eventIds).toContain(event1Id);
      expect(eventIds).toContain(event2Id);
      expect(eventIds).toContain(event3Id);

      // Verify actual rows in DB
      const today = new Date().toISOString().slice(0, 10);
      for (const eid of [event1Id, event2Id, event3Id]) {
        const occs = await executeQuery<RowDataPacket[]>(
          'SELECT * FROM event_occurence WHERE event_id = ? AND occurence_date = ?',
          [eid, today],
        );
        expect(occs).toHaveLength(1);
      }
    });

    it('should NOT create occurrences for events in other schools', async () => {
      await eventsService.createSchoolOccurrences(account1.account_id!, school1Id);

      // Event D is in school2/class3 — no occurrence should exist
      const school2Events = await executeQuery<RowDataPacket[]>(
        'SELECT event_id FROM events WHERE class_id = ?',
        [class3Id],
      );
      expect(school2Events).toHaveLength(1);

      const today = new Date().toISOString().slice(0, 10);
      const occs = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM event_occurence WHERE event_id = ? AND occurence_date = ?',
        [school2Events[0]!['event_id'], today],
      );
      expect(occs).toHaveLength(0);
    });

    it('should be idempotent — calling twice on the same day does not duplicate (INSERT IGNORE)', async () => {
      await eventsService.createSchoolOccurrences(account1.account_id!, school1Id);
      await eventsService.createSchoolOccurrences(account1.account_id!, school1Id);

      const today = new Date().toISOString().slice(0, 10);
      const occs = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM event_occurence WHERE event_id = ? AND occurence_date = ?',
        [event1Id, today],
      );
      // Should still be exactly 1 row — INSERT IGNORE skips duplicates
      expect(occs).toHaveLength(1);
    });

    it('should return an empty array when user has no roles in the school', async () => {
      // account1 has no roles in school2
      const eventIds = await eventsService.createSchoolOccurrences(
        account1.account_id!,
        school2Id,
      );

      expect(eventIds).toEqual([]);
    });

    it('should return an empty array when the school has no events', async () => {
      // Create a new school with no events
      const newSchoolSeed = await seedTestData({
        schools: [{ school_name: 'Empty School' }],
      });
      const newSchoolId = newSchoolSeed.schoolIds[0]!;

      const newClassSeed = await seedTestData({
        classes: [{ class_name: 'Empty Class', school_id: newSchoolId }],
      });

      await seedTestData({
        roles: [
          {
            account_id: account1.account_id!,
            class_id: newClassSeed.classIds[0]!,
            role: 'leader',
            school_id: newSchoolId,
          },
        ],
      });

      const eventIds = await eventsService.createSchoolOccurrences(
        account1.account_id!,
        newSchoolId,
      );

      expect(eventIds).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // End-to-end: full event lifecycle
  // ---------------------------------------------------------------------------

  describe('end-to-end: event lifecycle', () => {
    it('should support create → add occurrences → delete last → update → delete', async () => {
      // 1. Create event
      await eventsService.createEvent(class1Id, 'Lifecycle Event', eventTypes.student);
      let { studentEvents } = await eventsService.getEvents(Roles.leader, class1Id);
      expect(studentEvents).toHaveLength(1);
      const eventId = studentEvents[0]!['event_id'] as number;

      // 2. Add occurrences
      await eventsService.createEventOccurrence(eventId, '2025-04-01');
      await eventsService.createEventOccurrence(eventId, '2025-04-08');
      await eventsService.createEventOccurrence(eventId, '2025-04-15');

      let occurrences = await eventsService.getEventOccurrences(eventId);
      expect(occurrences).toHaveLength(3);
      expect(occurrences[0]!['occurence_date']).toBe('2025-04-15'); // most recent first

      // 3. Delete last occurrence (2025-04-15)
      await eventsService.deleteLastEventOccurrence(eventId);
      occurrences = await eventsService.getEventOccurrences(eventId);
      expect(occurrences).toHaveLength(2);
      expect(occurrences[0]!['occurence_date']).toBe('2025-04-08');

      // 4. Update event name and type
      await eventsService.updateEvent(eventId, 'Updated Lifecycle', eventTypes.all);
      const afterUpdate = await eventsService.getEvents(Roles.leader, class1Id);
      expect(afterUpdate.studentEvents).toHaveLength(1);
      expect(afterUpdate.teacherEvents).toHaveLength(1);
      expect(afterUpdate.studentEvents[0]!['event_name']).toBe('Updated Lifecycle');

      // 5. Occurrences should still be intact after update
      occurrences = await eventsService.getEventOccurrences(eventId);
      expect(occurrences).toHaveLength(2);

      // 6. Delete the event — occurrences should cascade
      await eventsService.deleteEvent(eventId);
      const events = await eventsService.getEvents(Roles.leader, class1Id);
      expect(events.studentEvents).toHaveLength(0);
      expect(events.teacherEvents).toHaveLength(0);

      const orphanOccs = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM event_occurence WHERE event_id = ?',
        [eventId],
      );
      expect(orphanOccs).toHaveLength(0);
    });
  });
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function studentNames(events: RowDataPacket[]): string[] {
  return events.map((e) => e['event_name'] as string);
}