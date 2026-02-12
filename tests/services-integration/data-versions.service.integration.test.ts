import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  createTestDatabase,
  dropTestDatabase,
  truncateAllTables,
  seedTestData,
} from '../helpers/test-db';
import dataVersionsService from '../../src/services/data-versions.service';

describe('Data Versions Service — DB Integration', () => {
  beforeAll(async () => {
    await createTestDatabase();
  });

  afterAll(async () => {
    await dropTestDatabase();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  describe('ensureTable()', () => {
    it('should create the data_versions table if it does not exist (idempotent)', async () => {
      // The table already exists from schema.sql, but ensureTable uses
      // CREATE TABLE IF NOT EXISTS — so calling it again should not throw.
      await expect(dataVersionsService.ensureTable()).resolves.not.toThrow();
    });

    it('should be callable multiple times without error', async () => {
      await dataVersionsService.ensureTable();
      await dataVersionsService.ensureTable();
      await dataVersionsService.ensureTable();
      // No error means idempotency works
    });
  });

  describe('touch()', () => {
    it('should insert a single key with a timestamp', async () => {
      await dataVersionsService.touch('test_key');

      const timestamps = await dataVersionsService.getTimestamps(['test_key']);
      expect(timestamps).toHaveProperty('test_key');
      expect(typeof timestamps['test_key']).toBe('string');
      // Should be a valid ISO date string
      expect(new Date(timestamps['test_key']!).getTime()).not.toBeNaN();
    });

    it('should insert multiple keys in a single call', async () => {
      await dataVersionsService.touch('key_a', 'key_b', 'key_c');

      const timestamps = await dataVersionsService.getTimestamps(['key_a', 'key_b', 'key_c']);
      expect(Object.keys(timestamps)).toHaveLength(3);
      expect(timestamps).toHaveProperty('key_a');
      expect(timestamps).toHaveProperty('key_b');
      expect(timestamps).toHaveProperty('key_c');
    });

    it('should update the timestamp when touching an existing key again', async () => {
      await dataVersionsService.touch('update_key');
      const first = await dataVersionsService.getTimestamps(['update_key']);
      const firstTs = new Date(first['update_key']!).getTime();

      // Small delay to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 50));

      await dataVersionsService.touch('update_key');
      const second = await dataVersionsService.getTimestamps(['update_key']);
      const secondTs = new Date(second['update_key']!).getTime();

      expect(secondTs).toBeGreaterThanOrEqual(firstTs);
    });

    it('should be a no-op when called with zero keys', async () => {
      // touch() with no arguments should not throw
      await expect(dataVersionsService.touch()).resolves.not.toThrow();
    });
  });

  describe('convenience touch helpers', () => {
    it('touchClassStudents() should touch the correct key', async () => {
      await dataVersionsService.touchClassStudents(42);

      const timestamps = await dataVersionsService.getTimestamps(['class_42_students']);
      expect(timestamps).toHaveProperty('class_42_students');
    });

    it('touchClassTeachers() should touch the correct key', async () => {
      await dataVersionsService.touchClassTeachers(7);

      const timestamps = await dataVersionsService.getTimestamps(['class_7_teachers']);
      expect(timestamps).toHaveProperty('class_7_teachers');
    });

    it('touchClassEvents() should touch the correct key', async () => {
      await dataVersionsService.touchClassEvents(15);

      const timestamps = await dataVersionsService.getTimestamps(['class_15_events']);
      expect(timestamps).toHaveProperty('class_15_events');
    });

    it('touchEventOccurrences() should touch the correct key', async () => {
      await dataVersionsService.touchEventOccurrences(99);

      const timestamps = await dataVersionsService.getTimestamps(['event_99_occurrences']);
      expect(timestamps).toHaveProperty('event_99_occurrences');
    });

    it('touchOccurrenceAttendance() with type should touch a type-specific key', async () => {
      await dataVersionsService.touchOccurrenceAttendance(10, 'student');

      const timestamps = await dataVersionsService.getTimestamps(['occurrence_10_attendance_student']);
      expect(timestamps).toHaveProperty('occurrence_10_attendance_student');
    });

    it('touchOccurrenceAttendance() without type should touch both student and teacher keys', async () => {
      await dataVersionsService.touchOccurrenceAttendance(20);

      const timestamps = await dataVersionsService.getTimestamps([
        'occurrence_20_attendance_student',
        'occurrence_20_attendance_teacher',
      ]);
      expect(timestamps).toHaveProperty('occurrence_20_attendance_student');
      expect(timestamps).toHaveProperty('occurrence_20_attendance_teacher');
    });

    it('touchDistricts() should touch the districts key', async () => {
      await dataVersionsService.touchDistricts();

      const timestamps = await dataVersionsService.getTimestamps(['districts']);
      expect(timestamps).toHaveProperty('districts');
    });

    it('touchClasses() should touch the classes key', async () => {
      await dataVersionsService.touchClasses();

      const timestamps = await dataVersionsService.getTimestamps(['classes']);
      expect(timestamps).toHaveProperty('classes');
    });
  });

  describe('getTimestamps()', () => {
    it('should return an empty object when given an empty array', async () => {
      const result = await dataVersionsService.getTimestamps([]);
      expect(result).toEqual({});
    });

    it('should return only keys that have been touched', async () => {
      await dataVersionsService.touch('exists_key');

      const timestamps = await dataVersionsService.getTimestamps(['exists_key', 'missing_key']);
      expect(timestamps).toHaveProperty('exists_key');
      expect(timestamps).not.toHaveProperty('missing_key');
    });

    it('should return ISO date strings', async () => {
      await dataVersionsService.touch('iso_test');

      const timestamps = await dataVersionsService.getTimestamps(['iso_test']);
      const ts = timestamps['iso_test']!;

      // Should match ISO 8601 format
      expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should return timestamps for all requested keys that exist', async () => {
      await dataVersionsService.touch('multi_1', 'multi_2', 'multi_3');

      const timestamps = await dataVersionsService.getTimestamps(['multi_1', 'multi_2', 'multi_3']);
      expect(Object.keys(timestamps)).toHaveLength(3);
    });
  });

  describe('getTimestampsForUser()', () => {
    it('should return empty object when classIds is empty', async () => {
      const result = await dataVersionsService.getTimestampsForUser([]);
      expect(result).toEqual({});
    });

    it('should build the full key set from classes, events, and occurrences', async () => {
      // Seed real data: school -> class -> event -> occurrence
      const seed = await seedTestData({
        schools: [{ school_name: 'Test School' }],
        districts: [{ district_name: 'Test District' }],
        classes: [],
        events: [],
        eventOccurrences: [],
      });

      // Create class linked to the school
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Class A', school_id: seed.schoolIds[0]! }],
      });
      const classId = classSeeds.classIds[0]!;

      // Create event linked to the class
      const eventSeeds = await seedTestData({
        events: [{ class_id: classId, event_name: 'Attendance', type: 'student' }],
      });
      const eventId = eventSeeds.eventIds[0]!;

      // Create occurrence for the event
      const occSeeds = await seedTestData({
        eventOccurrences: [{ event_id: eventId, occurence_date: '2025-01-15' }],
      });
      const occId = occSeeds.eventOccurrenceIds[0]!;

      // Touch the expected keys so they appear in getTimestamps
      await dataVersionsService.touch(
        'classes',
        'districts',
        dataVersionsService.classStudentsKey(classId),
        dataVersionsService.classTeachersKey(classId),
        dataVersionsService.classEventsKey(classId),
        dataVersionsService.eventOccurrencesKey(eventId),
        dataVersionsService.occurrenceAttendanceKey(occId, 'student'),
        dataVersionsService.occurrenceAttendanceKey(occId, 'teacher'),
      );

      const result = await dataVersionsService.getTimestampsForUser([classId]);

      // Should include the global keys
      expect(result).toHaveProperty('classes');
      expect(result).toHaveProperty('districts');

      // Should include class-level keys
      expect(result).toHaveProperty(`class_${classId}_students`);
      expect(result).toHaveProperty(`class_${classId}_teachers`);
      expect(result).toHaveProperty(`class_${classId}_events`);

      // Should include event-level keys
      expect(result).toHaveProperty(`event_${eventId}_occurrences`);

      // Should include occurrence-level keys
      expect(result).toHaveProperty(`occurrence_${occId}_attendance_student`);
      expect(result).toHaveProperty(`occurrence_${occId}_attendance_teacher`);
    });

    it('should return only existing timestamps (untouched keys are absent)', async () => {
      const seed = await seedTestData({
        schools: [{ school_name: 'School' }],
        districts: [{ district_name: 'District' }],
      });

      const classSeeds = await seedTestData({
        classes: [{ class_name: 'ClassB', school_id: seed.schoolIds[0]! }],
      });
      const classId = classSeeds.classIds[0]!;

      // Don't touch any keys — getTimestampsForUser should return empty
      // (keys are queried but none exist in data_versions)
      const result = await dataVersionsService.getTimestampsForUser([classId]);

      // All values should be absent because nothing was touched
      expect(Object.keys(result)).toHaveLength(0);
    });

    it('should handle multiple classes with events and occurrences', async () => {
      const seed = await seedTestData({
        schools: [{ school_name: 'Multi School' }],
        districts: [{ district_name: 'Multi District' }],
      });

      const classSeeds = await seedTestData({
        classes: [
          { class_name: 'Class 1', school_id: seed.schoolIds[0]! },
          { class_name: 'Class 2', school_id: seed.schoolIds[0]! },
        ],
      });
      const classId1 = classSeeds.classIds[0]!;
      const classId2 = classSeeds.classIds[1]!;

      const eventSeeds = await seedTestData({
        events: [
          { class_id: classId1, event_name: 'Event A', type: 'all' },
          { class_id: classId2, event_name: 'Event B', type: 'student' },
        ],
      });

      // Touch class-level keys
      await dataVersionsService.touch(
        'classes',
        'districts',
        dataVersionsService.classStudentsKey(classId1),
        dataVersionsService.classTeachersKey(classId1),
        dataVersionsService.classEventsKey(classId1),
        dataVersionsService.classStudentsKey(classId2),
        dataVersionsService.classTeachersKey(classId2),
        dataVersionsService.classEventsKey(classId2),
        dataVersionsService.eventOccurrencesKey(eventSeeds.eventIds[0]!),
        dataVersionsService.eventOccurrencesKey(eventSeeds.eventIds[1]!),
      );

      const result = await dataVersionsService.getTimestampsForUser([classId1, classId2]);

      expect(result).toHaveProperty('classes');
      expect(result).toHaveProperty('districts');
      expect(result).toHaveProperty(`class_${classId1}_students`);
      expect(result).toHaveProperty(`class_${classId2}_students`);
      expect(result).toHaveProperty(`event_${eventSeeds.eventIds[0]!}_occurrences`);
      expect(result).toHaveProperty(`event_${eventSeeds.eventIds[1]!}_occurrences`);
    });
  });

  describe('key builder functions', () => {
    it('classStudentsKey() should produce "class_{id}_students"', () => {
      expect(dataVersionsService.classStudentsKey(1)).toBe('class_1_students');
      expect(dataVersionsService.classStudentsKey(999)).toBe('class_999_students');
    });

    it('classTeachersKey() should produce "class_{id}_teachers"', () => {
      expect(dataVersionsService.classTeachersKey(5)).toBe('class_5_teachers');
    });

    it('classEventsKey() should produce "class_{id}_events"', () => {
      expect(dataVersionsService.classEventsKey(10)).toBe('class_10_events');
    });

    it('eventOccurrencesKey() should produce "event_{id}_occurrences"', () => {
      expect(dataVersionsService.eventOccurrencesKey(42)).toBe('event_42_occurrences');
    });

    it('occurrenceAttendanceKey() with type should produce "occurrence_{id}_attendance_{type}"', () => {
      expect(dataVersionsService.occurrenceAttendanceKey(7, 'student')).toBe('occurrence_7_attendance_student');
      expect(dataVersionsService.occurrenceAttendanceKey(7, 'teacher')).toBe('occurrence_7_attendance_teacher');
    });

    it('occurrenceAttendanceKey() without type should produce "occurrence_{id}_attendance"', () => {
      expect(dataVersionsService.occurrenceAttendanceKey(7)).toBe('occurrence_7_attendance');
    });

    it('DISTRICTS_KEY constant should be "districts"', () => {
      expect(dataVersionsService.DISTRICTS_KEY).toBe('districts');
    });

    it('CLASSES_KEY constant should be "classes"', () => {
      expect(dataVersionsService.CLASSES_KEY).toBe('classes');
    });
  });
});