import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before importing the service
jest.mock('../../src/services/database.service');

import dataVersionsService from '../../src/services/data-versions.service';
import { executeQuery } from '../../src/services/database.service';

const mockedExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;

describe('Data Versions Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---- Key builder functions ----

  describe('Key Builders', () => {
    describe('classStudentsKey()', () => {
      it('should return "class_1_students" for classId 1', () => {
        expect(dataVersionsService.classStudentsKey(1)).toBe('class_1_students');
      });

      it('should return "class_42_students" for classId 42', () => {
        expect(dataVersionsService.classStudentsKey(42)).toBe('class_42_students');
      });

      it('should return "class_0_students" for classId 0', () => {
        expect(dataVersionsService.classStudentsKey(0)).toBe('class_0_students');
      });

      it('should return "class_999_students" for classId 999', () => {
        expect(dataVersionsService.classStudentsKey(999)).toBe('class_999_students');
      });
    });

    describe('classTeachersKey()', () => {
      it('should return "class_1_teachers" for classId 1', () => {
        expect(dataVersionsService.classTeachersKey(1)).toBe('class_1_teachers');
      });

      it('should return "class_42_teachers" for classId 42', () => {
        expect(dataVersionsService.classTeachersKey(42)).toBe('class_42_teachers');
      });

      it('should return "class_0_teachers" for classId 0', () => {
        expect(dataVersionsService.classTeachersKey(0)).toBe('class_0_teachers');
      });
    });

    describe('classEventsKey()', () => {
      it('should return "class_1_events" for classId 1', () => {
        expect(dataVersionsService.classEventsKey(1)).toBe('class_1_events');
      });

      it('should return "class_99_events" for classId 99', () => {
        expect(dataVersionsService.classEventsKey(99)).toBe('class_99_events');
      });
    });

    describe('eventOccurrencesKey()', () => {
      it('should return "event_1_occurrences" for eventId 1', () => {
        expect(dataVersionsService.eventOccurrencesKey(1)).toBe('event_1_occurrences');
      });

      it('should return "event_55_occurrences" for eventId 55', () => {
        expect(dataVersionsService.eventOccurrencesKey(55)).toBe('event_55_occurrences');
      });
    });

    describe('occurrenceAttendanceKey()', () => {
      it('should return "occurrence_1_attendance_student" with type "student"', () => {
        expect(dataVersionsService.occurrenceAttendanceKey(1, 'student')).toBe(
          'occurrence_1_attendance_student',
        );
      });

      it('should return "occurrence_1_attendance_teacher" with type "teacher"', () => {
        expect(dataVersionsService.occurrenceAttendanceKey(1, 'teacher')).toBe(
          'occurrence_1_attendance_teacher',
        );
      });

      it('should return "occurrence_5_attendance" without type', () => {
        expect(dataVersionsService.occurrenceAttendanceKey(5)).toBe(
          'occurrence_5_attendance',
        );
      });

      it('should return "occurrence_100_attendance_student" for large IDs', () => {
        expect(dataVersionsService.occurrenceAttendanceKey(100, 'student')).toBe(
          'occurrence_100_attendance_student',
        );
      });
    });

    describe('DISTRICTS_KEY', () => {
      it('should be "districts"', () => {
        expect(dataVersionsService.DISTRICTS_KEY).toBe('districts');
      });
    });

    describe('CLASSES_KEY', () => {
      it('should be "classes"', () => {
        expect(dataVersionsService.CLASSES_KEY).toBe('classes');
      });
    });
  });

  // ---- ensureTable ----

  describe('ensureTable()', () => {
    it('should execute CREATE TABLE IF NOT EXISTS query', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.ensureTable();

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('CREATE TABLE IF NOT EXISTS');
      expect(queryStr).toContain('data_versions');
      expect(queryStr).toContain('resource_key');
      expect(queryStr).toContain('last_updated');
    });

    it('should define resource_key as VARCHAR(120) NOT NULL PRIMARY KEY', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.ensureTable();

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('VARCHAR(120)');
      expect(queryStr).toContain('PRIMARY KEY');
    });

    it('should define last_updated as TIMESTAMP(3)', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.ensureTable();

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('TIMESTAMP(3)');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValue(new Error('DB down') as never);

      await expect(dataVersionsService.ensureTable()).rejects.toThrow('DB down');
    });
  });

  // ---- touch ----

  describe('touch()', () => {
    it('should upsert a single key with NOW(3)', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.touch('class_1_students');

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('INSERT INTO data_versions');
      expect(queryStr).toContain('ON DUPLICATE KEY UPDATE');
      expect(queryStr).toContain('NOW(3)');
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual(['class_1_students']);
    });

    it('should upsert multiple keys in a single multi-row statement', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.touch('key_a', 'key_b', 'key_c');

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      // Should have 3 value placeholders
      const matches = queryStr.match(/\(\?, NOW\(3\)\)/g);
      expect(matches).toHaveLength(3);
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual(['key_a', 'key_b', 'key_c']);
    });

    it('should be a no-op when no keys are provided (empty call)', async () => {
      await dataVersionsService.touch();

      expect(mockedExecuteQuery).not.toHaveBeenCalled();
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValue(new Error('Write error') as never);

      await expect(
        dataVersionsService.touch('class_1_students'),
      ).rejects.toThrow('Write error');
    });

    it('should handle a single key without extra commas in SQL', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.touch('districts');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      // Only one placeholder pair
      const matches = queryStr.match(/\(\?, NOW\(3\)\)/g);
      expect(matches).toHaveLength(1);
    });

    it('should handle two keys with correct comma separation', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.touch('key_1', 'key_2');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      const matches = queryStr.match(/\(\?, NOW\(3\)\)/g);
      expect(matches).toHaveLength(2);
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual(['key_1', 'key_2']);
    });
  });

  // ---- Convenience touch methods ----

  describe('touchClassStudents()', () => {
    it('should call touch with the correct key format', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.touchClassStudents(3);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual(['class_3_students']);
    });
  });

  describe('touchClassTeachers()', () => {
    it('should call touch with the correct key format', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.touchClassTeachers(7);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual(['class_7_teachers']);
    });
  });

  describe('touchClassEvents()', () => {
    it('should call touch with the correct key format', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.touchClassEvents(12);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual(['class_12_events']);
    });
  });

  describe('touchEventOccurrences()', () => {
    it('should call touch with the correct key format', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.touchEventOccurrences(20);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual(['event_20_occurrences']);
    });
  });

  describe('touchOccurrenceAttendance()', () => {
    it('should touch type-specific key when type is provided', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.touchOccurrenceAttendance(5, 'student');

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual([
        'occurrence_5_attendance_student',
      ]);
    });

    it('should touch teacher-specific key when type is "teacher"', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.touchOccurrenceAttendance(8, 'teacher');

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual([
        'occurrence_8_attendance_teacher',
      ]);
    });

    it('should touch both student and teacher keys when no type is provided', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.touchOccurrenceAttendance(10);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual([
        'occurrence_10_attendance_student',
        'occurrence_10_attendance_teacher',
      ]);
    });
  });

  describe('touchDistricts()', () => {
    it('should call touch with "districts" key', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.touchDistricts();

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual(['districts']);
    });
  });

  describe('touchClasses()', () => {
    it('should call touch with "classes" key', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await dataVersionsService.touchClasses();

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual(['classes']);
    });
  });

  // ---- getTimestamps ----

  describe('getTimestamps()', () => {
    it('should return a map of key → ISO timestamp string', async () => {
      const now = new Date('2025-01-15T10:30:00.123Z');
      mockedExecuteQuery.mockResolvedValue([
        { resource_key: 'class_1_students', last_updated: now },
        { resource_key: 'districts', last_updated: new Date('2025-01-14T08:00:00.000Z') },
      ] as any);

      const result = await dataVersionsService.getTimestamps([
        'class_1_students',
        'districts',
      ]);

      expect(result).toEqual({
        class_1_students: '2025-01-15T10:30:00.123Z',
        districts: '2025-01-14T08:00:00.000Z',
      });
    });

    it('should return empty object for empty keys array', async () => {
      const result = await dataVersionsService.getTimestamps([]);

      expect(result).toEqual({});
      expect(mockedExecuteQuery).not.toHaveBeenCalled();
    });

    it('should build correct SQL with IN clause placeholders', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await dataVersionsService.getTimestamps(['key_a', 'key_b', 'key_c']);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('SELECT');
      expect(queryStr).toContain('resource_key');
      expect(queryStr).toContain('last_updated');
      expect(queryStr).toContain('IN (?, ?, ?)');
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual(['key_a', 'key_b', 'key_c']);
    });

    it('should handle a single key', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { resource_key: 'classes', last_updated: new Date('2025-01-10T00:00:00.000Z') },
      ] as any);

      const result = await dataVersionsService.getTimestamps(['classes']);

      expect(result).toEqual({
        classes: '2025-01-10T00:00:00.000Z',
      });
      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('IN (?)');
    });

    it('should not include keys that have never been touched (absent from DB)', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { resource_key: 'class_1_students', last_updated: new Date('2025-01-15T10:00:00.000Z') },
      ] as any);

      const result = await dataVersionsService.getTimestamps([
        'class_1_students',
        'class_2_students', // this key not in DB
      ]);

      expect(result).toEqual({
        class_1_students: '2025-01-15T10:00:00.000Z',
      });
      expect(result).not.toHaveProperty('class_2_students');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValue(new Error('Read error') as never);

      await expect(
        dataVersionsService.getTimestamps(['key_1']),
      ).rejects.toThrow('Read error');
    });

    it('should return empty object when DB returns empty rows for valid keys', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      const result = await dataVersionsService.getTimestamps(['nonexistent_key']);

      expect(result).toEqual({});
    });
  });

  // ---- getTimestampsForUser ----

  describe('getTimestampsForUser()', () => {
    it('should return empty object when classIds is empty', async () => {
      const result = await dataVersionsService.getTimestampsForUser([]);

      expect(result).toEqual({});
      expect(mockedExecuteQuery).not.toHaveBeenCalled();
    });

    it('should fetch events for the given class IDs', async () => {
      // First call: get events for classes
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 10 },
        { event_id: 20 },
      ] as any);
      // Second call: get occurrences for events
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_occurence_id: 100 },
      ] as any);
      // Third call: getTimestamps
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await dataVersionsService.getTimestampsForUser([1, 2]);

      // First call should query events for classIds [1, 2]
      const firstCall = mockedExecuteQuery.mock.calls[0]!;
      const firstQuery = firstCall[0] as string;
      expect(firstQuery).toContain('SELECT event_id FROM events');
      expect(firstQuery).toContain('IN (?, ?)');
      expect(firstCall[1]).toEqual([1, 2]);
    });

    it('should build the full set of resource keys for classes, events, and occurrences', async () => {
      // Events for classes
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 10 },
      ] as any);
      // Occurrences for events
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_occurence_id: 100 },
      ] as any);
      // Person IDs for classes
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      // getTimestamps final query
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await dataVersionsService.getTimestampsForUser([1]);

      // The fourth call (getTimestamps) should include all the resource keys
      const fourthCall = mockedExecuteQuery.mock.calls[3]!;
      const keys = fourthCall[1] as string[];

      // Should include global keys
      expect(keys).toContain('classes');
      expect(keys).toContain('districts');
      // Should include class-level keys
      expect(keys).toContain('class_1_students');
      expect(keys).toContain('class_1_teachers');
      expect(keys).toContain('class_1_events');
      // Should include event-level keys
      expect(keys).toContain('event_10_occurrences');
      // Should include occurrence-level keys (both student and teacher)
      expect(keys).toContain('occurrence_100_attendance_student');
      expect(keys).toContain('occurrence_100_attendance_teacher');
    });

    it('should handle classes with no events', async () => {
      // No events
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      // Person IDs for classes
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      // getTimestamps query (no occurrence query since no events)
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await dataVersionsService.getTimestampsForUser([1]);

      // Should be 3 calls: events query + person query + timestamps query
      expect(mockedExecuteQuery).toHaveBeenCalledTimes(3);

      // The third call (getTimestamps) should only have class-level + global keys
      const thirdCall = mockedExecuteQuery.mock.calls[2]!;
      const keys = thirdCall[1] as string[];

      expect(keys).toContain('classes');
      expect(keys).toContain('districts');
      expect(keys).toContain('class_1_students');
      expect(keys).toContain('class_1_teachers');
      expect(keys).toContain('class_1_events');
      // Should NOT contain event or occurrence keys
      expect(keys.filter(k => k.startsWith('event_'))).toHaveLength(0);
      expect(keys.filter(k => k.startsWith('occurrence_'))).toHaveLength(0);
    });

    it('should handle events with no occurrences', async () => {
      // Events exist
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 10 },
      ] as any);
      // No occurrences
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      // Person IDs for classes
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      // getTimestamps query
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await dataVersionsService.getTimestampsForUser([1]);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(4);

      const fourthCall = mockedExecuteQuery.mock.calls[3]!;
      const keys = fourthCall[1] as string[];

      expect(keys).toContain('event_10_occurrences');
      // Should NOT contain occurrence keys
      expect(keys.filter(k => k.startsWith('occurrence_'))).toHaveLength(0);
    });

    it('should handle multiple classes with multiple events and occurrences', async () => {
      // Events for classes 1 and 2
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 10 },
        { event_id: 20 },
        { event_id: 30 },
      ] as any);
      // Occurrences for events 10, 20, 30
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_occurence_id: 100 },
        { event_occurence_id: 200 },
      ] as any);
      // Person IDs for classes
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      // getTimestamps query
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await dataVersionsService.getTimestampsForUser([1, 2]);

      const fourthCall = mockedExecuteQuery.mock.calls[3]!;
      const keys = fourthCall[1] as string[];

      // Global keys
      expect(keys).toContain('classes');
      expect(keys).toContain('districts');
      // Class 1 keys
      expect(keys).toContain('class_1_students');
      expect(keys).toContain('class_1_teachers');
      expect(keys).toContain('class_1_events');
      // Class 2 keys
      expect(keys).toContain('class_2_students');
      expect(keys).toContain('class_2_teachers');
      expect(keys).toContain('class_2_events');
      // Event keys
      expect(keys).toContain('event_10_occurrences');
      expect(keys).toContain('event_20_occurrences');
      expect(keys).toContain('event_30_occurrences');
      // Occurrence keys
      expect(keys).toContain('occurrence_100_attendance_student');
      expect(keys).toContain('occurrence_100_attendance_teacher');
      expect(keys).toContain('occurrence_200_attendance_student');
      expect(keys).toContain('occurrence_200_attendance_teacher');
    });

    it('should return the timestamps result from getTimestamps', async () => {
      const now = new Date('2025-01-15T12:00:00.000Z');

      // Events
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      // Person IDs for classes
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      // getTimestamps returns actual data
      mockedExecuteQuery.mockResolvedValueOnce([
        { resource_key: 'classes', last_updated: now },
        { resource_key: 'districts', last_updated: now },
        { resource_key: 'class_1_students', last_updated: now },
      ] as any);

      const result = await dataVersionsService.getTimestampsForUser([1]);

      expect(result).toHaveProperty('classes');
      expect(result).toHaveProperty('districts');
      expect(result).toHaveProperty('class_1_students');
      expect(result['classes']).toBe('2025-01-15T12:00:00.000Z');
    });

    it('should propagate DB errors from event query', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('Event query failed') as never);

      await expect(
        dataVersionsService.getTimestampsForUser([1]),
      ).rejects.toThrow('Event query failed');
    });

    it('should query occurrences using the latest date per event', async () => {
      // Events
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 10 },
      ] as any);
      // Occurrences query
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_occurence_id: 100 },
      ] as any);
      // Person IDs for classes
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      // getTimestamps
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await dataVersionsService.getTimestampsForUser([1]);

      const occurrenceCall = mockedExecuteQuery.mock.calls[1]!;
      const occurrenceQuery = occurrenceCall[0] as string;
      expect(occurrenceQuery).toContain('MAX(occurence_date)');
      expect(occurrenceQuery).toContain('event_occurence_id');
      expect(occurrenceCall[1]).toEqual([10]);
    });
  });
});