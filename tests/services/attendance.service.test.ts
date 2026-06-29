import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before importing the service
jest.mock('../../src/services/database.service');
jest.mock('../../src/services/data-versions.service');

import attendanceService from '../../src/services/attendance.service';
import { executeQuery, getConnection } from '../../src/services/database.service';
import dataVersionsService from '../../src/services/data-versions.service';

const mockedExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
const mockedGetConnection = getConnection as jest.MockedFunction<typeof getConnection>;
const mockedDataVersionsService = dataVersionsService as jest.Mocked<typeof dataVersionsService>;

function createMockConnection() {
  const mockConnection = {
    beginTransaction: jest.fn().mockResolvedValue(undefined as never),
    commit: jest.fn().mockResolvedValue(undefined as never),
    rollback: jest.fn().mockResolvedValue(undefined as never),
    release: jest.fn(),
    query: jest.fn(),
    execute: jest.fn(),
  };
  return mockConnection;
}

describe('Attendance Service', () => {
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = createMockConnection();
    mockedGetConnection.mockResolvedValue(mockConnection as any);
    mockedDataVersionsService.touchOccurrenceAttendance.mockReturnValue(Promise.resolve() as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getAttendance()', () => {
    it('should return attendance list and date for a given occurrence and type', async () => {
      const mockAttendance = [
        { person_id: 1, person_name: 'أحمد', attended: 1 },
        { person_id: 2, person_name: 'يوسف', attended: 0 },
        { person_id: 3, person_name: 'مينا', attended: 1 },
      ];
      const mockDate = [{ occurence_date: '2025-01-15' }];

      // First call: attendance query
      mockedExecuteQuery.mockResolvedValueOnce(mockAttendance as any);
      // Second call: date query
      mockedExecuteQuery.mockResolvedValueOnce(mockDate as any);

      const result = await attendanceService.getAttendance(100, 'student');

      expect(result).toEqual({
        attendance: mockAttendance,
        date: mockDate,
      });
    });

    it('should pass the correct type and occurrenceId to the attendance query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await attendanceService.getAttendance(42, 'student');

      const [queryStr, params] = mockedExecuteQuery.mock.calls[0]!;
      expect(queryStr).toContain('event_occurence_id');
      expect(queryStr).toContain('person_class.type');
      expect(params).toEqual(['student', 42]);
    });

    it('should pass the correct occurrenceId to the date query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await attendanceService.getAttendance(55, 'teacher');

      const [queryStr, params] = mockedExecuteQuery.mock.calls[1]!;
      expect(queryStr).toContain('occurence_date');
      expect(queryStr).toContain('event_occurence_id');
      expect(params).toEqual([55]);
    });

    it('should filter by type "student"', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await attendanceService.getAttendance(1, 'student');

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params![0]).toBe('student');
    });

    it('should filter by type "teacher"', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await attendanceService.getAttendance(1, 'teacher');

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params![0]).toBe('teacher');
    });

    it('should return empty attendance array when no persons are in the class', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([{ occurence_date: '2025-01-15' }] as any);

      const result = await attendanceService.getAttendance(1, 'student');

      expect(result.attendance).toEqual([]);
    });

    it('should join persons, events, person_class, event_occurence, and attendance tables', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await attendanceService.getAttendance(1, 'student');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('persons');
      expect(queryStr).toContain('events');
      expect(queryStr).toContain('person_class');
      expect(queryStr).toContain('event_occurence');
      expect(queryStr).toContain('attendance');
    });

    it('should order attendance by person_name', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await attendanceService.getAttendance(1, 'student');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('order by persons.person_name');
    });

    it('should use left join on attendance to mark absent persons as 0', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await attendanceService.getAttendance(1, 'student');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('left join attendance');
      expect(queryStr).toContain('if(attendance.person_id is null, 0, 1)');
    });

    it('should make exactly 2 queries (attendance + date)', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await attendanceService.getAttendance(1, 'student');

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(2);
    });

    it('should propagate DB errors from the attendance query', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(
        attendanceService.getAttendance(1, 'student'),
      ).rejects.toThrow('DB error');
    });

    it('should propagate DB errors from the date query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockRejectedValueOnce(new Error('Date query failed') as never);

      await expect(
        attendanceService.getAttendance(1, 'student'),
      ).rejects.toThrow('Date query failed');
    });
  });

  describe('isLatestOccurrence()', () => {
    it('should return true when the occurrence is the latest for its event', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { latest_id: 100 },
      ] as any);

      const result = await attendanceService.isLatestOccurrence(100);

      expect(result).toBe(true);
    });

    it('should return false when the occurrence is not the latest', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { latest_id: 200 },
      ] as any);

      const result = await attendanceService.isLatestOccurrence(100);

      expect(result).toBe(false);
    });

    it('should return false when the occurrence does not exist (empty result)', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      const result = await attendanceService.isLatestOccurrence(999);

      expect(result).toBe(false);
    });

    it('should pass the occurrenceId to the query', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await attendanceService.isLatestOccurrence(77);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([77]);
    });

    it('should query for the latest occurrence grouped by event_id', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await attendanceService.isLatestOccurrence(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('max(occurence_date)');
      expect(queryStr).toContain('group by event_id');
    });

    it('should use LIMIT 1 in the query', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await attendanceService.isLatestOccurrence(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('limit 1');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValue(new Error('Connection lost') as never);

      await expect(
        attendanceService.isLatestOccurrence(1),
      ).rejects.toThrow('Connection lost');
    });

    it('should return false when rows[0] is undefined', async () => {
      // An array with length > 0 but first element is undefined/falsy
      const sparseResult: any[] = [];
      Object.defineProperty(sparseResult, 'length', { value: 1 });
      mockedExecuteQuery.mockResolvedValue(sparseResult as any);

      const result = await attendanceService.isLatestOccurrence(1);

      expect(result).toBe(false);
    });
  });

  describe('patchAttendance()', () => {
    // For patchAttendance, isLatestOccurrence is called internally using executeQuery
    // So we need to mock executeQuery to handle the isLatestOccurrence check first

    function mockIsLatestTrue(occurrenceId: number) {
      // isLatestOccurrence query returns the occurrence as latest
      mockedExecuteQuery.mockResolvedValueOnce([
        { latest_id: occurrenceId },
      ] as any);
    }

    function mockIsLatestFalse(occurrenceId: number) {
      // isLatestOccurrence query returns a different ID as latest
      mockedExecuteQuery.mockResolvedValueOnce([
        { latest_id: occurrenceId + 999 },
      ] as any);
    }

    it('should throw EDIT_NOT_LATEST when occurrence is not the latest', async () => {
      mockIsLatestFalse(100);

      await expect(
        attendanceService.patchAttendance([1], [2], 100, 'student'),
      ).rejects.toThrow('EDIT_NOT_LATEST');
    });

    it('should not get a connection or begin transaction if not latest', async () => {
      mockIsLatestFalse(100);

      await expect(
        attendanceService.patchAttendance([1], [2], 100, 'student'),
      ).rejects.toThrow('EDIT_NOT_LATEST');

      expect(mockedGetConnection).not.toHaveBeenCalled();
    });

    it('should insert attendance for attended persons when latest', async () => {
      mockIsLatestTrue(100);
      // getConnection returns mockConnection
      // connection.execute for class_id lookup
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance([1, 2], undefined, 100, 'student');

      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);

      // 1 class_id + 2 attended (INSERT IGNORE + DELETE attendance_absence each)
      expect(mockConnection.execute).toHaveBeenCalledTimes(5);
    });

    it('should delete attendance for absent persons when latest', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance(undefined, [3, 4], 100, 'student');

      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);

      // 1 execute for class_id + 2 executes for absent (DELETE)
      expect(mockConnection.execute).toHaveBeenCalledTimes(3);
    });

    it('should handle both attended and absent in the same call', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance([1, 2], [3], 100, 'student');

      // 1 class_id + 2 attended (INSERT IGNORE + DELETE attendance_absence each) + 1 absent DELETE = 6
      expect(mockConnection.execute).toHaveBeenCalledTimes(6);
    });

    it('should use INSERT IGNORE for attended persons', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance([1], undefined, 100, 'student');

      // The second execute call (after class_id lookup) should be the INSERT
      const insertCall = mockConnection.execute.mock.calls[1]!;
      const insertQuery = insertCall[0] as string;
      expect(insertQuery).toContain('insert ignore into');
      expect(insertQuery).toContain('attendance');
    });

    it('should use DELETE for absent persons', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance(undefined, [3], 100, 'student');

      // The second execute call (after class_id lookup) should be the DELETE
      const deleteCall = mockConnection.execute.mock.calls[1]!;
      const deleteQuery = deleteCall[0] as string;
      expect(deleteQuery).toContain('delete from attendance');
    });

    it('should verify person belongs to class before inserting attendance', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance([7], undefined, 100, 'student');

      const insertCall = mockConnection.execute.mock.calls[1]!;
      const insertQuery = insertCall[0] as string;
      // The INSERT uses a subquery to check person_class membership
      expect(insertQuery).toContain('person_class');
      expect(insertQuery).toContain('class_id');
      expect(insertQuery).toContain('type');
      // Should pass personId, occurrenceId, personId, classId, type
      expect(insertCall[1]).toEqual([7, 100, 7, 5, 'student']);
    });

    it('should pass correct params for absent DELETE', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance(undefined, [8], 100, 'teacher');

      const deleteCall = mockConnection.execute.mock.calls[1]!;
      expect(deleteCall[1]).toEqual([8, 100]);
    });

    it('should touch data version for the occurrence after success', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance([1], undefined, 100, 'student');

      expect(mockedDataVersionsService.touchOccurrenceAttendance).toHaveBeenCalledWith(100, 'student');
    });

    it('should touch data version with type "teacher" for teacher attendance', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance([1], undefined, 100, 'teacher');

      expect(mockedDataVersionsService.touchOccurrenceAttendance).toHaveBeenCalledWith(100, 'teacher');
    });

    it('should not throw if touchOccurrenceAttendance rejects (caught with .catch)', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);
      mockedDataVersionsService.touchOccurrenceAttendance.mockReturnValue(
        Promise.reject(new Error('version error')) as any,
      );

      // Should not throw because the promise rejection is caught with .catch(() => {})
      await expect(
        attendanceService.patchAttendance([1], undefined, 100, 'student'),
      ).resolves.not.toThrow();
    });

    it('should look up the class_id from the event_occurence', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 42 }]] as never);

      await attendanceService.patchAttendance([1], undefined, 100, 'student');

      // First execute is the class_id lookup
      const classLookupCall = mockConnection.execute.mock.calls[0]!;
      const classLookupQuery = classLookupCall[0] as string;
      expect(classLookupQuery).toContain('class_id');
      expect(classLookupQuery).toContain('event_occurence');
      expect(classLookupQuery).toContain('events');
      expect(classLookupCall[1]).toEqual([100]);
    });

    it('should handle empty attended and absent arrays (no inserts or deletes)', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance(undefined, undefined, 100, 'student');

      // Only the class_id lookup execute should happen
      expect(mockConnection.execute).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });

    it('should release the connection after successful patch', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance([1], [2], 100, 'student');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should begin a transaction before any inserts or deletes', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance([1], undefined, 100, 'student');

      const beginOrder = mockConnection.beginTransaction.mock.invocationCallOrder[0];
      const executeOrder = mockConnection.execute.mock.invocationCallOrder[0];
      expect(beginOrder).toBeLessThan(executeOrder!);
    });

    it('should commit the transaction after all operations', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance([1, 2], [3], 100, 'student');

      // commit should be called after all executes
      const commitOrder = mockConnection.commit.mock.invocationCallOrder[0];
      const lastExecuteOrder = mockConnection.execute.mock.invocationCallOrder[
        mockConnection.execute.mock.invocationCallOrder.length - 1
      ];
      expect(commitOrder).toBeGreaterThan(lastExecuteOrder!);
    });

    it('should process multiple attended persons individually (one INSERT per person)', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance([1, 2, 3], undefined, 100, 'student');

      // 1 class_id lookup + 3 attended (INSERT IGNORE + DELETE attendance_absence each)
      expect(mockConnection.execute).toHaveBeenCalledTimes(7);

      // Verify each INSERT is for a different person (calls at indices 1, 3, 5)
      const expectedPersonIds = [1, 2, 3];
      for (let i = 0; i < 3; i++) {
        const call = mockConnection.execute.mock.calls[1 + i * 2]!;
        const params = call[1] as number[];
        expect(params[0]).toBe(expectedPersonIds[i]); // personId
        expect(params[1]).toBe(100); // occurrenceId
      }
    });

    it('should process multiple absent persons individually (one DELETE per person)', async () => {
      mockIsLatestTrue(100);
      mockConnection.execute.mockResolvedValue([[{ class_id: 5 }]] as never);

      await attendanceService.patchAttendance(undefined, [10, 20, 30], 100, 'teacher');

      // 1 class_id lookup + 3 individual DELETEs
      expect(mockConnection.execute).toHaveBeenCalledTimes(4);

      // Verify each DELETE is for a different person
      for (let i = 1; i <= 3; i++) {
        const call = mockConnection.execute.mock.calls[i]!;
        const params = call[1] as number[];
        expect(params[0]).toBe([10, 20, 30][i - 1]); // personId
        expect(params[1]).toBe(100); // occurrenceId
      }
    });

    it('should handle classId=0 when no class is found for the occurrence', async () => {
      mockIsLatestTrue(100);
      // Return empty result for class_id lookup
      mockConnection.execute.mockResolvedValue([[]] as never);

      await attendanceService.patchAttendance([1], undefined, 100, 'student');

      // The INSERT should use classId=0 since no class was found
      const insertCall = mockConnection.execute.mock.calls[1]!;
      const params = insertCall[1] as any[];
      expect(params[3]).toBe(0); // classId defaults to 0
    });
  });
});