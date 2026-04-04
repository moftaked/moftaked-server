import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before importing the service
jest.mock('../../src/services/database.service');
jest.mock('../../src/services/data-versions.service');

import eventsService from '../../src/services/events.service';
import { executeQuery, getConnection } from '../../src/services/database.service';
import dataVersionsService from '../../src/services/data-versions.service';
import { Roles } from '../../src/enums/roles.enum';
import { eventTypes } from '../../src/enums/eventTypes.enum';

const mockedExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
const mockedGetConnection = getConnection as jest.MockedFunction<typeof getConnection>;
const mockedDataVersionsService = dataVersionsService as jest.Mocked<typeof dataVersionsService>;

function createMockConnection() {
  const mockConnection = {
    beginTransaction: jest.fn().mockResolvedValue(undefined as never),
    commit: jest.fn().mockResolvedValue(undefined as never),
    rollback: jest.fn().mockResolvedValue(undefined as never),
    release: jest.fn(),
    query: jest.fn().mockResolvedValue([{ affectedRows: 0 }] as never),
    execute: jest.fn().mockResolvedValue([{ affectedRows: 0 }] as never),
  };
  return mockConnection;
}

describe('Events Service', () => {
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = createMockConnection();
    mockedGetConnection.mockResolvedValue(mockConnection as any);
    mockedDataVersionsService.touch.mockReturnValue(Promise.resolve() as any);
    mockedDataVersionsService.touchClassEvents.mockReturnValue(Promise.resolve() as any);
    mockedDataVersionsService.touchEventOccurrences.mockReturnValue(Promise.resolve() as any);
    mockedDataVersionsService.eventOccurrencesKey.mockImplementation(
      (id: number) => `event_${id}_occurrences`,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── getEvents() ────────────────────────────────────────────────────────

  describe('getEvents()', () => {
    it('should return studentEvents and teacherEvents for a leader/manager role', async () => {
      const mockEvents = [
        { event_id: 1, event_name: 'حضور', type: 'student' },
        { event_id: 2, event_name: 'حضور معلمين', type: 'teacher' },
        { event_id: 3, event_name: 'اجتماع عام', type: 'all' },
      ];
      mockedExecuteQuery.mockResolvedValueOnce(mockEvents as any);

      const result = await eventsService.getEvents(Roles.leader, 10);

      expect(result.studentEvents).toEqual([
        { event_id: 1, event_name: 'حضور', type: 'student' },
        { event_id: 3, event_name: 'اجتماع عام', type: 'all' },
      ]);
      expect(result.teacherEvents).toEqual([
        { event_id: 2, event_name: 'حضور معلمين', type: 'teacher' },
        { event_id: 3, event_name: 'اجتماع عام', type: 'all' },
      ]);
    });

    it('should filter out teacher-only events when userType is teacher', async () => {
      const mockEvents = [
        { event_id: 1, event_name: 'حضور', type: 'student' },
        { event_id: 3, event_name: 'اجتماع عام', type: 'all' },
      ];
      mockedExecuteQuery.mockResolvedValueOnce(mockEvents as any);

      const result = await eventsService.getEvents(Roles.teacher, 10);

      // Teacher should only see student + all events (teacher-only events filtered by SQL)
      expect(result.studentEvents).toEqual([
        { event_id: 1, event_name: 'حضور', type: 'student' },
        { event_id: 3, event_name: 'اجتماع عام', type: 'all' },
      ]);
      expect(result.teacherEvents).toEqual([
        { event_id: 3, event_name: 'اجتماع عام', type: 'all' },
      ]);
    });

    it('should add SQL filter for teacher role to exclude teacher-only events', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await eventsService.getEvents(Roles.teacher, 10);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain("type = 'student'");
      expect(queryStr).toContain("type = 'all'");
    });

    it('should NOT add type filter for leader role', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await eventsService.getEvents(Roles.leader, 10);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).not.toContain("type = 'student' OR type = 'all'");
    });

    it('should NOT add type filter for manager role', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await eventsService.getEvents(Roles.manager, 10);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).not.toContain("type = 'student' OR type = 'all'");
    });

    it('should pass classId to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await eventsService.getEvents(Roles.leader, 42);

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42]);
    });

    it('should place "all" type events in both studentEvents and teacherEvents', async () => {
      const mockEvents = [
        { event_id: 3, event_name: 'اجتماع عام', type: 'all' },
      ];
      mockedExecuteQuery.mockResolvedValueOnce(mockEvents as any);

      const result = await eventsService.getEvents(Roles.leader, 10);

      expect(result.studentEvents).toHaveLength(1);
      expect(result.teacherEvents).toHaveLength(1);
      expect(result.studentEvents[0]).toBe(result.teacherEvents[0]);
    });

    it('should return empty arrays when no events exist', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await eventsService.getEvents(Roles.leader, 10);

      expect(result.studentEvents).toEqual([]);
      expect(result.teacherEvents).toEqual([]);
    });

    it('should separate student and teacher events correctly', async () => {
      const mockEvents = [
        { event_id: 1, event_name: 'طلاب', type: 'student' },
        { event_id: 2, event_name: 'معلمين', type: 'teacher' },
      ];
      mockedExecuteQuery.mockResolvedValueOnce(mockEvents as any);

      const result = await eventsService.getEvents(Roles.manager, 10);

      expect(result.studentEvents).toEqual([
        { event_id: 1, event_name: 'طلاب', type: 'student' },
      ]);
      expect(result.teacherEvents).toEqual([
        { event_id: 2, event_name: 'معلمين', type: 'teacher' },
      ]);
    });

    it('should query events table with class_id filter', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await eventsService.getEvents(Roles.leader, 10);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('events');
      expect(queryStr).toContain('class_id');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(eventsService.getEvents(Roles.leader, 10)).rejects.toThrow('DB error');
    });
  });

  // ─── createEvent() ──────────────────────────────────────────────────────

  describe('createEvent()', () => {
    it('should insert a new event with classId, eventName, and type', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);

      await eventsService.createEvent(10, 'حضور الطلاب', eventTypes.student);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('INSERT INTO events');
      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([10, 'حضور الطلاب', 'student']);
    });

    it('should touch class events version after creating event', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);

      await eventsService.createEvent(10, 'حضور', eventTypes.all);

      expect(mockedDataVersionsService.touchClassEvents).toHaveBeenCalledWith(10);
    });

    it('should not throw if touchClassEvents rejects (caught with .catch)', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);
      mockedDataVersionsService.touchClassEvents.mockReturnValue(
        Promise.reject(new Error('touch error')) as any,
      );

      await expect(
        eventsService.createEvent(10, 'حضور', eventTypes.student),
      ).resolves.toBeUndefined();
    });

    it('should propagate DB errors from the insert', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(
        eventsService.createEvent(10, 'حضور', eventTypes.student),
      ).rejects.toThrow('DB error');
    });

    it('should accept eventTypes.teacher as type', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);

      await eventsService.createEvent(5, 'حضور معلمين', eventTypes.teacher);

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([5, 'حضور معلمين', 'teacher']);
    });

    it('should accept eventTypes.all as type', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);

      await eventsService.createEvent(5, 'اجتماع', eventTypes.all);

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([5, 'اجتماع', 'all']);
    });
  });

  // ─── updateEvent() ──────────────────────────────────────────────────────

  describe('updateEvent()', () => {
    it('should look up the class_id for the event first', async () => {
      mockedExecuteQuery
        .mockResolvedValueOnce([{ class_id: 10 }] as any) // SELECT class_id
        .mockResolvedValueOnce({} as any); // UPDATE

      await eventsService.updateEvent(1, 'حضور جديد', eventTypes.student);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(2);
      const selectQuery = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(selectQuery).toContain('SELECT class_id FROM events');
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual([1]);
    });

    it('should update event_name and type for the given eventId', async () => {
      mockedExecuteQuery
        .mockResolvedValueOnce([{ class_id: 10 }] as any)
        .mockResolvedValueOnce({} as any);

      await eventsService.updateEvent(5, 'اسم جديد', eventTypes.teacher);

      const updateQuery = mockedExecuteQuery.mock.calls[1]![0] as string;
      expect(updateQuery).toContain('UPDATE events');
      expect(updateQuery).toContain('event_name');
      expect(updateQuery).toContain('type');
      expect(mockedExecuteQuery.mock.calls[1]![1]).toEqual(['اسم جديد', 'teacher', 5]);
    });

    it('should touch class events version after updating if class_id found', async () => {
      mockedExecuteQuery
        .mockResolvedValueOnce([{ class_id: 10 }] as any)
        .mockResolvedValueOnce({} as any);

      await eventsService.updateEvent(1, 'حضور', eventTypes.student);

      expect(mockedDataVersionsService.touchClassEvents).toHaveBeenCalledWith(10);
    });

    it('should NOT touch class events version when event not found (no rows)', async () => {
      mockedExecuteQuery
        .mockResolvedValueOnce([] as any) // no rows — event not found
        .mockResolvedValueOnce({} as any);

      await eventsService.updateEvent(999, 'حضور', eventTypes.student);

      expect(mockedDataVersionsService.touchClassEvents).not.toHaveBeenCalled();
    });

    it('should not throw if touchClassEvents rejects (caught with .catch)', async () => {
      mockedExecuteQuery
        .mockResolvedValueOnce([{ class_id: 10 }] as any)
        .mockResolvedValueOnce({} as any);
      mockedDataVersionsService.touchClassEvents.mockReturnValue(
        Promise.reject(new Error('touch fail')) as any,
      );

      await expect(
        eventsService.updateEvent(1, 'حضور', eventTypes.student),
      ).resolves.toBeUndefined();
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(
        eventsService.updateEvent(1, 'حضور', eventTypes.student),
      ).rejects.toThrow('DB error');
    });
  });

  // ─── deleteEvent() ──────────────────────────────────────────────────────

  describe('deleteEvent()', () => {
    it('should look up the class_id before deleting', async () => {
      mockedExecuteQuery
        .mockResolvedValueOnce([{ class_id: 10 }] as any) // SELECT
        .mockResolvedValueOnce({} as any); // DELETE

      await eventsService.deleteEvent(5);

      const selectQuery = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(selectQuery).toContain('SELECT class_id FROM events');
      expect(mockedExecuteQuery.mock.calls[0]![1]).toEqual([5]);
    });

    it('should delete the event by eventId', async () => {
      mockedExecuteQuery
        .mockResolvedValueOnce([{ class_id: 10 }] as any)
        .mockResolvedValueOnce({} as any);

      await eventsService.deleteEvent(5);

      const deleteQuery = mockedExecuteQuery.mock.calls[1]![0] as string;
      expect(deleteQuery).toContain('DELETE FROM events');
      expect(mockedExecuteQuery.mock.calls[1]![1]).toEqual([5]);
    });

    it('should touch class events version after deleting if class_id found', async () => {
      mockedExecuteQuery
        .mockResolvedValueOnce([{ class_id: 10 }] as any)
        .mockResolvedValueOnce({} as any);

      await eventsService.deleteEvent(5);

      expect(mockedDataVersionsService.touchClassEvents).toHaveBeenCalledWith(10);
    });

    it('should NOT touch class events version when event not found', async () => {
      mockedExecuteQuery
        .mockResolvedValueOnce([] as any) // no class_id found
        .mockResolvedValueOnce({} as any);

      await eventsService.deleteEvent(999);

      expect(mockedDataVersionsService.touchClassEvents).not.toHaveBeenCalled();
    });

    it('should not throw if touchClassEvents rejects (caught with .catch)', async () => {
      mockedExecuteQuery
        .mockResolvedValueOnce([{ class_id: 10 }] as any)
        .mockResolvedValueOnce({} as any);
      mockedDataVersionsService.touchClassEvents.mockReturnValue(
        Promise.reject(new Error('touch fail')) as any,
      );

      await expect(eventsService.deleteEvent(5)).resolves.toBeUndefined();
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(eventsService.deleteEvent(5)).rejects.toThrow('DB error');
    });

    it('should make exactly 2 queries (SELECT + DELETE)', async () => {
      mockedExecuteQuery
        .mockResolvedValueOnce([{ class_id: 10 }] as any)
        .mockResolvedValueOnce({} as any);

      await eventsService.deleteEvent(5);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(2);
    });
  });

  // ─── createEventOccurrence() ────────────────────────────────────────────

  describe('createEventOccurrence()', () => {
    it('should insert a new occurrence with eventId and date', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);

      await eventsService.createEventOccurrence(5, '2025-01-15');

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('INSERT INTO event_occurence');
      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([5, '2025-01-15']);
    });

    it('should touch event occurrences version after insert', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);

      await eventsService.createEventOccurrence(5, '2025-01-15');

      expect(mockedDataVersionsService.touchEventOccurrences).toHaveBeenCalledWith(5);
    });

    it('should not throw if touchEventOccurrences rejects (caught with .catch)', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);
      mockedDataVersionsService.touchEventOccurrences.mockReturnValue(
        Promise.reject(new Error('touch fail')) as any,
      );

      await expect(
        eventsService.createEventOccurrence(5, '2025-01-15'),
      ).resolves.toBeUndefined();
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(
        eventsService.createEventOccurrence(5, '2025-01-15'),
      ).rejects.toThrow('DB error');
    });
  });

  // ─── deleteLastEventOccurrence() ────────────────────────────────────────

  describe('deleteLastEventOccurrence()', () => {
    it('should delete the last occurrence using ORDER BY DESC LIMIT 1', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);

      await eventsService.deleteLastEventOccurrence(5);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('DELETE FROM event_occurence');
      expect(queryStr).toContain('ORDER BY occurence_date DESC');
      expect(queryStr).toContain('LIMIT 1');
    });

    it('should pass eventId to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);

      await eventsService.deleteLastEventOccurrence(42);

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42]);
    });

    it('should touch event occurrences version after delete', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);

      await eventsService.deleteLastEventOccurrence(5);

      expect(mockedDataVersionsService.touchEventOccurrences).toHaveBeenCalledWith(5);
    });

    it('should filter by event_id', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);

      await eventsService.deleteLastEventOccurrence(5);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('event_id');
    });

    it('should not throw if touchEventOccurrences rejects (caught with .catch)', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);
      mockedDataVersionsService.touchEventOccurrences.mockReturnValue(
        Promise.reject(new Error('touch fail')) as any,
      );

      await expect(
        eventsService.deleteLastEventOccurrence(5),
      ).resolves.toBeUndefined();
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(eventsService.deleteLastEventOccurrence(5)).rejects.toThrow('DB error');
    });
  });

  // ─── getEventOccurrences() ──────────────────────────────────────────────

  describe('getEventOccurrences()', () => {
    it('should return occurrences ordered by date DESC', async () => {
      const mockOccurrences = [
        { event_occurence_id: 3, occurence_date: '2025-01-15' },
        { event_occurence_id: 2, occurence_date: '2025-01-08' },
        { event_occurence_id: 1, occurence_date: '2025-01-01' },
      ];
      mockedExecuteQuery.mockResolvedValueOnce(mockOccurrences as any);

      const result = await eventsService.getEventOccurrences(5);

      expect(result).toEqual(mockOccurrences);
    });

    it('should pass eventId to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await eventsService.getEventOccurrences(42);

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42]);
    });

    it('should query with ORDER BY occurence_date DESC', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await eventsService.getEventOccurrences(5);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('ORDER BY occurence_date DESC');
    });

    it('should format date using DATE_FORMAT', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await eventsService.getEventOccurrences(5);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('DATE_FORMAT');
      expect(queryStr).toContain('%Y-%m-%d');
    });

    it('should select event_occurence_id and occurence_date', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await eventsService.getEventOccurrences(5);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('event_occurence_id');
      expect(queryStr).toContain('occurence_date');
    });

    it('should return empty array when no occurrences exist', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await eventsService.getEventOccurrences(999);

      expect(result).toEqual([]);
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(eventsService.getEventOccurrences(5)).rejects.toThrow('DB error');
    });
  });

  // ─── createSchoolOccurrences() ──────────────────────────────────────────

  describe('createSchoolOccurrences()', () => {
    it('should find all events across all classes the user has roles in for the school', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 1 },
        { event_id: 2 },
        { event_id: 3 },
      ] as any);

      await eventsService.createSchoolOccurrences(100, 5);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('events');
      expect(queryStr).toContain('classes');
      expect(queryStr).toContain('roles');
      expect(queryStr).toContain('account_id');
      expect(queryStr).toContain('school_id');
      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([100, 5]);
    });

    it('should return empty array when no events exist', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await eventsService.createSchoolOccurrences(100, 5);

      expect(result).toEqual([]);
      // Should not get a connection or execute anything
      expect(mockedGetConnection).not.toHaveBeenCalled();
    });

    it('should use INSERT IGNORE for safe duplicate handling', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 1 },
        { event_id: 2 },
      ] as any);

      await eventsService.createSchoolOccurrences(100, 5);

      const executeCall = mockConnection.execute.mock.calls[0]!;
      const insertQuery = executeCall[0] as string;
      expect(insertQuery).toContain('INSERT IGNORE');
    });

    it('should create placeholders for each event with today date', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 10 },
        { event_id: 20 },
        { event_id: 30 },
      ] as any);

      await eventsService.createSchoolOccurrences(100, 5);

      const executeCall = mockConnection.execute.mock.calls[0]!;
      const insertQuery = executeCall[0] as string;
      // 3 events = 3 value groups
      expect(insertQuery).toContain('(?, ?)');
      const params = executeCall[1] as any[];
      // Each event has [eventId, today], so 6 params total
      expect(params).toHaveLength(6);
      expect(params[0]).toBe(10);
      expect(params[2]).toBe(20);
      expect(params[4]).toBe(30);
      // All dates should be the same (today)
      expect(params[1]).toBe(params[3]);
      expect(params[3]).toBe(params[5]);
    });

    it('should use a transaction for the bulk insert', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([{ event_id: 1 }] as any);

      await eventsService.createSchoolOccurrences(100, 5);

      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);

      const beginOrder = mockConnection.beginTransaction.mock.invocationCallOrder[0]!;
      const executeOrder = mockConnection.execute.mock.invocationCallOrder[0]!;
      const commitOrder = mockConnection.commit.mock.invocationCallOrder[0]!;
      expect(beginOrder).toBeLessThan(executeOrder);
      expect(executeOrder).toBeLessThan(commitOrder);
    });

    it('should rollback and rethrow on DB error during insert', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([{ event_id: 1 }] as any);
      mockConnection.execute.mockRejectedValueOnce(new Error('Insert failed') as never);

      await expect(
        eventsService.createSchoolOccurrences(100, 5),
      ).rejects.toThrow('Insert failed');
      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    });

    it('should release the connection after success', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([{ event_id: 1 }] as any);

      await eventsService.createSchoolOccurrences(100, 5);

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should release the connection after error', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([{ event_id: 1 }] as any);
      mockConnection.execute.mockRejectedValueOnce(new Error('fail') as never);

      await expect(eventsService.createSchoolOccurrences(100, 5)).rejects.toThrow();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should return the list of event IDs that were processed', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 10 },
        { event_id: 20 },
        { event_id: 30 },
      ] as any);

      const result = await eventsService.createSchoolOccurrences(100, 5);

      expect(result).toEqual([10, 20, 30]);
    });

    it('should touch data version timestamps for every affected event', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 10 },
        { event_id: 20 },
      ] as any);

      await eventsService.createSchoolOccurrences(100, 5);

      expect(mockedDataVersionsService.eventOccurrencesKey).toHaveBeenCalledWith(10);
      expect(mockedDataVersionsService.eventOccurrencesKey).toHaveBeenCalledWith(20);
      expect(mockedDataVersionsService.touch).toHaveBeenCalledWith(
        'event_10_occurrences',
        'event_20_occurrences',
      );
    });

    it('should not throw if touch rejects (caught with .catch)', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([{ event_id: 1 }] as any);
      mockedDataVersionsService.touch.mockReturnValue(
        Promise.reject(new Error('touch fail')) as any,
      );

      await expect(
        eventsService.createSchoolOccurrences(100, 5),
      ).resolves.toEqual([1]);
    });

    it('should use DISTINCT when selecting events', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await eventsService.createSchoolOccurrences(100, 5);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('DISTINCT');
    });

    it('should use today date in yyyy-mm-dd format for occurrences', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([{ event_id: 1 }] as any);

      await eventsService.createSchoolOccurrences(100, 5);

      const executeCall = mockConnection.execute.mock.calls[0]!;
      const params = executeCall[1] as any[];
      const dateParam = params[1] as string;
      // Should match yyyy-mm-dd format
      expect(dateParam).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should join events with classes and roles tables', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await eventsService.createSchoolOccurrences(100, 5);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('INNER JOIN classes');
      expect(queryStr).toContain('INNER JOIN roles');
    });
  });
});