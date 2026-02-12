import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before importing the service
jest.mock('../../src/services/database.service');

import reportsService from '../../src/services/reports.service';
import { executeQuery } from '../../src/services/database.service';

const mockedExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;

describe('Reports Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── getReportsAccess() ─────────────────────────────────────────────────

  describe('getReportsAccess()', () => {
    it('should return isManager true when user has manager role', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { role: 'manager', class_id: 10, school_id: 1, class_name: 'الصف الأول', school_name: 'مدرسة 1' },
      ] as any);

      const result = await reportsService.getReportsAccess(100);

      expect(result.isManager).toBe(true);
      expect(result.managedSchools).toEqual([{ school_id: 1, school_name: 'مدرسة 1' }]);
    });

    it('should return isLeader true when user has leader role', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { role: 'leader', class_id: 10, school_id: 1, class_name: 'الصف الأول', school_name: 'مدرسة 1' },
      ] as any);

      const result = await reportsService.getReportsAccess(100);

      expect(result.isLeader).toBe(true);
      expect(result.leaderClasses).toEqual([
        { class_id: 10, class_name: 'الصف الأول', school_name: 'مدرسة 1' },
      ]);
    });

    it('should return isTeacher true when user has teacher role', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { role: 'teacher', class_id: 20, school_id: 2, class_name: 'الصف الثاني', school_name: 'مدرسة 2' },
      ] as any);

      const result = await reportsService.getReportsAccess(100);

      expect(result.isTeacher).toBe(true);
      expect(result.teacherClasses).toEqual([
        { class_id: 20, class_name: 'الصف الثاني', school_name: 'مدرسة 2' },
      ]);
    });

    it('should deduplicate managed schools', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { role: 'manager', class_id: 10, school_id: 1, class_name: 'الصف الأول', school_name: 'مدرسة 1' },
        { role: 'manager', class_id: 20, school_id: 1, class_name: 'الصف الثاني', school_name: 'مدرسة 1' },
      ] as any);

      const result = await reportsService.getReportsAccess(100);

      expect(result.managedSchools).toHaveLength(1);
      expect(result.managedSchools[0]!.school_id).toBe(1);
    });

    it('should deduplicate leader classes', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { role: 'leader', class_id: 10, school_id: 1, class_name: 'الصف الأول', school_name: 'مدرسة 1' },
        { role: 'leader', class_id: 10, school_id: 1, class_name: 'الصف الأول', school_name: 'مدرسة 1' },
      ] as any);

      const result = await reportsService.getReportsAccess(100);

      expect(result.leaderClasses).toHaveLength(1);
    });

    it('should deduplicate teacher classes', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { role: 'teacher', class_id: 10, school_id: 1, class_name: 'الصف الأول', school_name: 'مدرسة 1' },
        { role: 'teacher', class_id: 10, school_id: 1, class_name: 'الصف الأول', school_name: 'مدرسة 1' },
      ] as any);

      const result = await reportsService.getReportsAccess(100);

      expect(result.teacherClasses).toHaveLength(1);
    });

    it('should include manager classes in leaderClasses (managers can access leader reports)', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { role: 'manager', class_id: 10, school_id: 1, class_name: 'الصف الأول', school_name: 'مدرسة 1' },
      ] as any);

      const result = await reportsService.getReportsAccess(100);

      expect(result.leaderClasses).toHaveLength(1);
      expect(result.leaderClasses[0]!.class_id).toBe(10);
    });

    it('should return empty arrays when user has no roles', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await reportsService.getReportsAccess(100);

      expect(result.isManager).toBe(false);
      expect(result.isLeader).toBe(false);
      expect(result.isTeacher).toBe(false);
      expect(result.managedSchools).toEqual([]);
      expect(result.leaderClasses).toEqual([]);
      expect(result.teacherClasses).toEqual([]);
    });

    it('should handle user with all three role types', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { role: 'manager', class_id: 10, school_id: 1, class_name: 'الصف الأول', school_name: 'مدرسة 1' },
        { role: 'leader', class_id: 20, school_id: 2, class_name: 'الصف الثاني', school_name: 'مدرسة 2' },
        { role: 'teacher', class_id: 30, school_id: 3, class_name: 'الصف الثالث', school_name: 'مدرسة 3' },
      ] as any);

      const result = await reportsService.getReportsAccess(100);

      expect(result.isManager).toBe(true);
      expect(result.isLeader).toBe(true);
      expect(result.isTeacher).toBe(true);
      expect(result.managedSchools).toHaveLength(1);
      // leaderClasses includes manager class + leader class = 2
      expect(result.leaderClasses).toHaveLength(2);
      expect(result.teacherClasses).toHaveLength(1);
    });

    it('should pass accountId to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getReportsAccess(42);

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42]);
    });

    it('should query roles with joined classes and schools', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getReportsAccess(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('roles');
      expect(queryStr).toContain('classes');
      expect(queryStr).toContain('schools');
      expect(queryStr).toContain('account_id');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(reportsService.getReportsAccess(1)).rejects.toThrow('DB error');
    });
  });

  // ─── getLeaderEventReport() ─────────────────────────────────────────────

  describe('getLeaderEventReport()', () => {
    it('should return attendance stats for the last 5 occurrences', async () => {
      const mockResults = [
        { occurence_date: '15/1', attended: 8, total: 10 },
        { occurence_date: '8/1', attended: 7, total: 10 },
        { occurence_date: '1/1', attended: 9, total: 10 },
      ];
      mockedExecuteQuery.mockResolvedValueOnce(mockResults as any);

      const result = await reportsService.getLeaderEventReport('5', 'student', '2025-01-15');

      expect(result).toEqual(mockResults);
    });

    it('should pass date, eventId, and eventType to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getLeaderEventReport('5', 'student', '2025-01-15');

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual(['2025-01-15', '5', 'student']);
    });

    it('should use LIMIT 5 in the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getLeaderEventReport('5', 'student', '2025-01-15');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('limit 5');
    });

    it('should order by date DESC', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getLeaderEventReport('5', 'student', '2025-01-15');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr.toLowerCase()).toContain('order by');
      expect(queryStr.toLowerCase()).toContain('desc');
    });

    it('should filter by occurence_date <= date', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getLeaderEventReport('5', 'student', '2025-01-15');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('occurence_date');
      expect(queryStr).toContain('<=');
    });

    it('should join events, event_occurence, person_class, and attendance', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getLeaderEventReport('5', 'student', '2025-01-15');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('events');
      expect(queryStr).toContain('event_occurence');
      expect(queryStr).toContain('person_class');
      expect(queryStr).toContain('attendance');
    });

    it('should filter by person_class.type matching eventType', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getLeaderEventReport('5', 'teacher', '2025-01-15');

      // eventType is passed as parameter, used in person_class.type filter
      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toContain('teacher');
    });

    it('should return empty array when no occurrences', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await reportsService.getLeaderEventReport('5', 'student', '2025-01-15');

      expect(result).toEqual([]);
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(
        reportsService.getLeaderEventReport('5', 'student', '2025-01-15'),
      ).rejects.toThrow('DB error');
    });
  });

  // ─── getTeacherEventReport() ────────────────────────────────────────────

  describe('getTeacherEventReport()', () => {
    it('should return attendance stats for the last 5 occurrences', async () => {
      const mockResults = [
        { occurence_date: '15/1', attended: 6, total: 10 },
        { occurence_date: '8/1', attended: 8, total: 10 },
      ];
      mockedExecuteQuery.mockResolvedValueOnce(mockResults as any);

      const result = await reportsService.getTeacherEventReport('5', '2025-01-15');

      expect(result).toEqual(mockResults);
    });

    it('should pass date and eventId to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getTeacherEventReport('5', '2025-01-15');

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual(['2025-01-15', '5']);
    });

    it('should always filter by student person type (hardcoded)', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getTeacherEventReport('5', '2025-01-15');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain("person_class.type = 'student'");
    });

    it('should use LIMIT 5 in the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getTeacherEventReport('5', '2025-01-15');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('limit 5');
    });

    it('should return empty array when no occurrences', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await reportsService.getTeacherEventReport('5', '2025-01-15');

      expect(result).toEqual([]);
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(
        reportsService.getTeacherEventReport('5', '2025-01-15'),
      ).rejects.toThrow('DB error');
    });
  });

  // ─── getManagarialReports() ─────────────────────────────────────────────

  describe('getManagarialReports()', () => {
    it('should return overAllStats for each managed school', async () => {
      // First call: getSchoolsManagedByUser query
      mockedExecuteQuery.mockResolvedValueOnce([
        { school_id: 1, school_name: 'مدرسة 1' },
      ] as any);
      // Second call: getSchoolOverAllStats for school 1
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_name: 'حضور', type: 'student', attended: 8, total: 10 },
      ] as any);

      const result = await reportsService.getManagarialReports(100, '2025-01-15');

      expect(result).toHaveProperty('overAllStats');
      expect((result as any).overAllStats).toHaveLength(1);
      expect((result as any).overAllStats[0].school_id).toBe(1);
      expect((result as any).overAllStats[0].school_name).toBe('مدرسة 1');
    });

    it('should return Err(FORBIDDEN) when user manages no schools', async () => {
      // getSchoolsManagedByUser returns empty → Err(FORBIDDEN)
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await reportsService.getManagarialReports(100, '2025-01-15');

      // Result is an Err with FORBIDDEN status
      expect(result).toBeDefined();
      expect((result as any).isErr()).toBe(true);
    });

    it('should aggregate stats by event name', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { school_id: 1, school_name: 'مدرسة 1' },
      ] as any);
      // getSchoolOverAllStats returns multiple rows for same event
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_name: 'حضور', type: 'student', attended: 8, total: 10 },
        { event_name: 'حضور', type: 'teacher', attended: 3, total: 5 },
        { event_name: 'اجتماع', type: 'student', attended: 9, total: 10 },
      ] as any);

      const result = await reportsService.getManagarialReports(100, '2025-01-15');

      const stats = (result as any).overAllStats[0].stats;
      // Two distinct event names: 'حضور' and 'اجتماع'
      expect(stats).toHaveLength(2);
      // 'حضور' should have 2 stat entries (student + teacher)
      const attendanceEvent = stats.find((s: any) => s.event_name === 'حضور');
      expect(attendanceEvent.stats).toHaveLength(2);
    });

    it('should handle multiple managed schools', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { school_id: 1, school_name: 'مدرسة 1' },
        { school_id: 2, school_name: 'مدرسة 2' },
      ] as any);
      // Stats for school 1
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_name: 'حضور', type: 'student', attended: 8, total: 10 },
      ] as any);
      // Stats for school 2
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_name: 'حضور', type: 'student', attended: 5, total: 10 },
      ] as any);

      const result = await reportsService.getManagarialReports(100, '2025-01-15');

      expect((result as any).overAllStats).toHaveLength(2);
    });

    it('should pass accountId to the schools query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getManagarialReports(42, '2025-01-15');

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42]);
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(
        reportsService.getManagarialReports(100, '2025-01-15'),
      ).rejects.toThrow('DB error');
    });
  });

  // ─── getClassAttendanceSummary() ────────────────────────────────────────

  describe('getClassAttendanceSummary()', () => {
    it('should return per-event breakdown for a class on a given date', async () => {
      // First call: main attendance query
      mockedExecuteQuery.mockResolvedValueOnce([
        {
          event_id: 1, event_name: 'حضور', event_type: 'student',
          person_type: 'student', event_occurence_id: 100,
          occurence_date: '2025-01-15', total: 10, attended: 8,
        },
      ] as any);
      // Second call: class info query
      mockedExecuteQuery.mockResolvedValueOnce([
        { class_id: 10, class_name: 'الصف الأول', school_name: 'مدرسة 1' },
      ] as any);

      const result = await reportsService.getClassAttendanceSummary(10, '2025-01-15');

      expect(result.class_id).toBe(10);
      expect(result.class_name).toBe('الصف الأول');
      expect(result.school_name).toBe('مدرسة 1');
      expect(result.date).toBe('2025-01-15');
      expect(result.events).toHaveLength(1);
      expect(result.events[0]!.event_id).toBe(1);
      expect(result.events[0]!.has_occurrence).toBe(true);
    });

    it('should calculate absent and rate in breakdown', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        {
          event_id: 1, event_name: 'حضور', event_type: 'student',
          person_type: 'student', event_occurence_id: 100,
          occurence_date: '2025-01-15', total: 10, attended: 8,
        },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { class_id: 10, class_name: 'الصف', school_name: 'مدرسة' },
      ] as any);

      const result = await reportsService.getClassAttendanceSummary(10, '2025-01-15');

      const breakdown = result.events[0]!.breakdown[0]!;
      expect(breakdown.total).toBe(10);
      expect(breakdown.attended).toBe(8);
      expect(breakdown.absent).toBe(2);
      expect(breakdown.rate).toBe(80);
    });

    it('should set has_occurrence to false when event_occurence_id is null', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        {
          event_id: 1, event_name: 'حضور', event_type: 'student',
          person_type: 'student', event_occurence_id: null,
          occurence_date: null, total: 10, attended: 0,
        },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { class_id: 10, class_name: 'الصف', school_name: 'مدرسة' },
      ] as any);

      const result = await reportsService.getClassAttendanceSummary(10, '2025-01-15');

      expect(result.events[0]!.has_occurrence).toBe(false);
    });

    it('should aggregate multiple person types under same event', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        {
          event_id: 1, event_name: 'اجتماع', event_type: 'all',
          person_type: 'student', event_occurence_id: 100,
          occurence_date: '2025-01-15', total: 10, attended: 8,
        },
        {
          event_id: 1, event_name: 'اجتماع', event_type: 'all',
          person_type: 'teacher', event_occurence_id: 100,
          occurence_date: '2025-01-15', total: 5, attended: 4,
        },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { class_id: 10, class_name: 'الصف', school_name: 'مدرسة' },
      ] as any);

      const result = await reportsService.getClassAttendanceSummary(10, '2025-01-15');

      expect(result.events).toHaveLength(1);
      expect(result.events[0]!.breakdown).toHaveLength(2);
    });

    it('should return empty events array when no results', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { class_id: 10, class_name: 'الصف', school_name: 'مدرسة' },
      ] as any);

      const result = await reportsService.getClassAttendanceSummary(10, '2025-01-15');

      expect(result.events).toEqual([]);
    });

    it('should handle rate of 0 when total is 0', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        {
          event_id: 1, event_name: 'حضور', event_type: 'student',
          person_type: 'student', event_occurence_id: 100,
          occurence_date: '2025-01-15', total: 0, attended: 0,
        },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { class_id: 10, class_name: 'الصف', school_name: 'مدرسة' },
      ] as any);

      const result = await reportsService.getClassAttendanceSummary(10, '2025-01-15');

      expect(result.events[0]!.breakdown[0]!.rate).toBe(0);
    });

    it('should pass classId and date to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getClassAttendanceSummary(42, '2025-06-01');

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42, '2025-06-01']);
    });

    it('should default class_name and school_name to empty string when class not found', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any); // no class info

      const result = await reportsService.getClassAttendanceSummary(999, '2025-01-15');

      expect(result.class_name).toBe('');
      expect(result.school_name).toBe('');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(
        reportsService.getClassAttendanceSummary(10, '2025-01-15'),
      ).rejects.toThrow('DB error');
    });
  });

  // ─── getEventAttendanceTrends() ─────────────────────────────────────────

  describe('getEventAttendanceTrends()', () => {
    it('should return trend data with per-occurrence stats', async () => {
      // First call: trend data
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_occurence_id: 3, occurence_date: '2025-01-15', display_date: '15/1', total: 10, attended: 8 },
        { event_occurence_id: 2, occurence_date: '2025-01-08', display_date: '8/1', total: 10, attended: 7 },
      ] as any);
      // Second call: event info
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 5, event_name: 'حضور', event_type: 'student', class_id: 10, class_name: 'الصف الأول' },
      ] as any);

      const result = await reportsService.getEventAttendanceTrends(5, 'student');

      expect(result.event_id).toBe(5);
      expect(result.event_name).toBe('حضور');
      expect(result.person_type).toBe('student');
      // Occurrences are reversed (chronological order)
      expect(result.occurrences).toHaveLength(2);
      expect(result.occurrences[0]!.occurence_date).toBe('2025-01-08');
      expect(result.occurrences[1]!.occurence_date).toBe('2025-01-15');
    });

    it('should calculate summary statistics', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_occurence_id: 3, occurence_date: '2025-01-15', display_date: '15/1', total: 10, attended: 8 },
        { event_occurence_id: 2, occurence_date: '2025-01-08', display_date: '8/1', total: 10, attended: 6 },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 5, event_name: 'حضور', event_type: 'student', class_id: 10, class_name: 'الصف' },
      ] as any);

      const result = await reportsService.getEventAttendanceTrends(5, 'student');

      expect(result.summary.total_occurrences).toBe(2);
      // rates: 80, 60 → avg = 70
      expect(result.summary.average_rate).toBe(70);
      expect(result.summary.highest_rate).toBe(80);
      expect(result.summary.lowest_rate).toBe(60);
    });

    it('should compute absent and rate per occurrence', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_occurence_id: 1, occurence_date: '2025-01-15', display_date: '15/1', total: 10, attended: 7 },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 5, event_name: 'حضور', event_type: 'student', class_id: 10, class_name: 'الصف' },
      ] as any);

      const result = await reportsService.getEventAttendanceTrends(5, 'student');

      expect(result.occurrences[0]!.total).toBe(10);
      expect(result.occurrences[0]!.attended).toBe(7);
      expect(result.occurrences[0]!.absent).toBe(3);
      expect(result.occurrences[0]!.rate).toBe(70);
    });

    it('should handle zero occurrences gracefully', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 5, event_name: 'حضور', event_type: 'student', class_id: 10, class_name: 'الصف' },
      ] as any);

      const result = await reportsService.getEventAttendanceTrends(5, 'student');

      expect(result.occurrences).toEqual([]);
      expect(result.summary.total_occurrences).toBe(0);
      expect(result.summary.average_rate).toBe(0);
      expect(result.summary.highest_rate).toBe(0);
      expect(result.summary.lowest_rate).toBe(0);
    });

    it('should handle rate of 0 when total is 0', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_occurence_id: 1, occurence_date: '2025-01-15', display_date: '15/1', total: 0, attended: 0 },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 5, event_name: 'حضور', event_type: 'student', class_id: 10, class_name: 'الصف' },
      ] as any);

      const result = await reportsService.getEventAttendanceTrends(5, 'student');

      expect(result.occurrences[0]!.rate).toBe(0);
    });

    it('should pass eventId and personType to the trend query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getEventAttendanceTrends(42, 'teacher');

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42, 'teacher']);
    });

    it('should default to limit of 10', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getEventAttendanceTrends(5, 'student');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('LIMIT 10');
    });

    it('should use custom limit when provided', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getEventAttendanceTrends(5, 'student', 20);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('LIMIT 20');
    });

    it('should default event info fields to empty when event not found', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any); // no event info

      const result = await reportsService.getEventAttendanceTrends(999, 'student');

      expect(result.event_name).toBe('');
      expect(result.event_type).toBe('');
      expect(result.class_id).toBe(0);
      expect(result.class_name).toBe('');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(
        reportsService.getEventAttendanceTrends(5, 'student'),
      ).rejects.toThrow('DB error');
    });
  });

  // ─── getAbsentees() ─────────────────────────────────────────────────────

  describe('getAbsentees()', () => {
    it('should return absent students and teachers separately', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { person_id: 1, person_name: 'أحمد', person_type: 'student', phone_numbers: '0101', district_name: 'المنطقة' },
        { person_id: 2, person_name: 'محمد', person_type: 'student', phone_numbers: '0102', district_name: 'المنطقة' },
        { person_id: 3, person_name: 'سعيد', person_type: 'teacher', phone_numbers: '0103', district_name: 'المنطقة' },
      ] as any);

      const result = await reportsService.getAbsentees(10, 5, '2025-01-15');

      expect(result.students).toHaveLength(2);
      expect(result.teachers).toHaveLength(1);
      expect(result.total_absent_students).toBe(2);
      expect(result.total_absent_teachers).toBe(1);
    });

    it('should return class_id, event_id, and date in the result', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await reportsService.getAbsentees(10, 5, '2025-01-15');

      expect(result.class_id).toBe(10);
      expect(result.event_id).toBe(5);
      expect(result.date).toBe('2025-01-15');
    });

    it('should pass eventId, date, classId to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getAbsentees(10, 5, '2025-01-15');

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([5, '2025-01-15', 10]);
    });

    it('should filter for absent persons using WHERE a.person_id IS NULL', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getAbsentees(10, 5, '2025-01-15');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('a.person_id IS NULL');
    });

    it('should return empty arrays when no one is absent', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await reportsService.getAbsentees(10, 5, '2025-01-15');

      expect(result.students).toEqual([]);
      expect(result.teachers).toEqual([]);
      expect(result.total_absent_students).toBe(0);
      expect(result.total_absent_teachers).toBe(0);
    });

    it('should map student fields correctly', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { person_id: 1, person_name: 'أحمد', person_type: 'student', phone_numbers: '0101, 0102', district_name: 'المنطقة الأولى' },
      ] as any);

      const result = await reportsService.getAbsentees(10, 5, '2025-01-15');

      expect(result.students[0]).toEqual({
        person_id: 1,
        person_name: 'أحمد',
        phone_numbers: '0101, 0102',
        district_name: 'المنطقة الأولى',
      });
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(
        reportsService.getAbsentees(10, 5, '2025-01-15'),
      ).rejects.toThrow('DB error');
    });
  });

  // ─── getPersonAttendanceHistory() ───────────────────────────────────────

  describe('getPersonAttendanceHistory()', () => {
    it('should return null when person not found', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any); // personInfo empty

      const result = await reportsService.getPersonAttendanceHistory(9999, 'student');

      expect(result).toBeNull();
    });

    it('should return person info with overall attendance stats', async () => {
      // personInfo
      mockedExecuteQuery.mockResolvedValueOnce([
        { person_id: 7, person_name: 'أحمد' },
      ] as any);
      // events
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 1, event_name: 'حضور', event_type: 'student', class_id: 10, class_name: 'الصف' },
      ] as any);
      // history for event 1
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_occurence_id: 1, occurence_date: '2025-01-08', display_date: '8/1', attended: 1 },
        { event_occurence_id: 2, occurence_date: '2025-01-15', display_date: '15/1', attended: 0 },
      ] as any);

      const result = await reportsService.getPersonAttendanceHistory(7, 'student');

      expect(result!.person_id).toBe(7);
      expect(result!.person_name).toBe('أحمد');
      expect(result!.person_type).toBe('student');
      expect(result!.overall.total_occurrences).toBe(2);
      expect(result!.overall.attended).toBe(1);
      expect(result!.overall.absent).toBe(1);
      expect(result!.overall.rate).toBe(50);
    });

    it('should return event histories with per-event rate', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { person_id: 7, person_name: 'أحمد' },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 1, event_name: 'حضور', event_type: 'student', class_id: 10, class_name: 'الصف' },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_occurence_id: 1, occurence_date: '2025-01-08', display_date: '8/1', attended: 1 },
        { event_occurence_id: 2, occurence_date: '2025-01-15', display_date: '15/1', attended: 1 },
        { event_occurence_id: 3, occurence_date: '2025-01-22', display_date: '22/1', attended: 0 },
      ] as any);

      const result = await reportsService.getPersonAttendanceHistory(7, 'student');

      const eventHistory = result!.events[0]!;
      expect(eventHistory.event_id).toBe(1);
      expect(eventHistory.total_occurrences).toBe(3);
      expect(eventHistory.attended_count).toBe(2);
      expect(eventHistory.rate).toBe(67); // Math.round(2/3 * 100) = 67
    });

    it('should return recent occurrences in chronological order', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { person_id: 7, person_name: 'أحمد' },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 1, event_name: 'حضور', event_type: 'student', class_id: 10, class_name: 'الصف' },
      ] as any);
      // DB returns DESC order
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_occurence_id: 2, occurence_date: '2025-01-15', display_date: '15/1', attended: 0 },
        { event_occurence_id: 1, occurence_date: '2025-01-08', display_date: '8/1', attended: 1 },
      ] as any);

      const result = await reportsService.getPersonAttendanceHistory(7, 'student');

      // reversed to chronological: 8/1 first, then 15/1
      expect(result!.events[0]!.recent[0]!.occurence_date).toBe('2025-01-08');
      expect(result!.events[0]!.recent[0]!.attended).toBe(true);
      expect(result!.events[0]!.recent[1]!.occurence_date).toBe('2025-01-15');
      expect(result!.events[0]!.recent[1]!.attended).toBe(false);
    });

    it('should handle multiple events for same person', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { person_id: 7, person_name: 'أحمد' },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_id: 1, event_name: 'حضور', event_type: 'student', class_id: 10, class_name: 'الصف' },
        { event_id: 2, event_name: 'اجتماع', event_type: 'all', class_id: 10, class_name: 'الصف' },
      ] as any);
      // history for event 1
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_occurence_id: 1, occurence_date: '2025-01-15', display_date: '15/1', attended: 1 },
      ] as any);
      // history for event 2
      mockedExecuteQuery.mockResolvedValueOnce([
        { event_occurence_id: 2, occurence_date: '2025-01-15', display_date: '15/1', attended: 0 },
      ] as any);

      const result = await reportsService.getPersonAttendanceHistory(7, 'student');

      expect(result!.events).toHaveLength(2);
      expect(result!.overall.total_occurrences).toBe(2);
      expect(result!.overall.attended).toBe(1);
      expect(result!.overall.rate).toBe(50);
    });

    it('should handle person with no events', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { person_id: 7, person_name: 'أحمد' },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any); // no events

      const result = await reportsService.getPersonAttendanceHistory(7, 'student');

      expect(result!.events).toEqual([]);
      expect(result!.overall.total_occurrences).toBe(0);
      expect(result!.overall.attended).toBe(0);
      expect(result!.overall.rate).toBe(0);
    });

    it('should pass personId to the person info query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getPersonAttendanceHistory(42, 'student');

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42]);
    });

    it('should pass personId and personType to the events query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { person_id: 7, person_name: 'أحمد' },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getPersonAttendanceHistory(7, 'teacher');

      const params = mockedExecuteQuery.mock.calls[1]![1];
      expect(params).toEqual([7, 'teacher', 'teacher']);
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(
        reportsService.getPersonAttendanceHistory(7, 'student'),
      ).rejects.toThrow('DB error');
    });
  });

  // ─── getClassAvailableDates() ───────────────────────────────────────────

  describe('getClassAvailableDates()', () => {
    it('should return dates with occurrences for the class', async () => {
      const mockDates = [
        { date: '2025-01-15', display_date: '15/1/2025' },
        { date: '2025-01-08', display_date: '8/1/2025' },
      ];
      mockedExecuteQuery.mockResolvedValueOnce(mockDates as any);

      const result = await reportsService.getClassAvailableDates(10);

      expect(result).toEqual(mockDates);
    });

    it('should pass classId to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getClassAvailableDates(42);

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42]);
    });

    it('should order by date DESC', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getClassAvailableDates(10);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('ORDER BY');
      expect(queryStr).toContain('DESC');
    });

    it('should default to limit of 30', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getClassAvailableDates(10);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('LIMIT 30');
    });

    it('should use custom limit when provided', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getClassAvailableDates(10, 50);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('LIMIT 50');
    });

    it('should group by occurence_date', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getClassAvailableDates(10);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('GROUP BY');
    });

    it('should return empty array when no dates', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await reportsService.getClassAvailableDates(999);

      expect(result).toEqual([]);
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(reportsService.getClassAvailableDates(10)).rejects.toThrow('DB error');
    });
  });

  // ─── getChronicAbsentees() ──────────────────────────────────────────────

  describe('getChronicAbsentees()', () => {
    it('should return chronic absentees with computed rate', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        {
          person_id: 1, person_name: 'أحمد', event_id: 5, event_name: 'حضور',
          total_occurrences: 10, attended_count: 3, phone_numbers: '0101',
        },
      ] as any);

      const result = await reportsService.getChronicAbsentees(10, 'student');

      expect(result).toHaveLength(1);
      expect(result[0]!.person_id).toBe(1);
      expect(result[0]!.total_occurrences).toBe(10);
      expect(result[0]!.attended_count).toBe(3);
      expect(result[0]!.rate).toBe(30);
      expect(result[0]!.phone_numbers).toBe('0101');
    });

    it('should pass classId (3x), personType (2x), and threshold to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getChronicAbsentees(10, 'student', 50, 5);

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([10, 10, 'student', 'student', 10, 50]);
    });

    it('should default threshold to 50%', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getChronicAbsentees(10, 'student');

      const params = mockedExecuteQuery.mock.calls[0]![1];
      // threshold is the last param
      expect(params![params!.length - 1]).toBe(50);
    });

    it('should return empty array when no chronic absentees', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await reportsService.getChronicAbsentees(10, 'student');

      expect(result).toEqual([]);
    });

    it('should handle rate of 0 when total_occurrences is 0', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        {
          person_id: 1, person_name: 'أحمد', event_id: 5, event_name: 'حضور',
          total_occurrences: 0, attended_count: 0, phone_numbers: null,
        },
      ] as any);

      const result = await reportsService.getChronicAbsentees(10, 'student');

      expect(result[0]!.rate).toBe(0);
    });

    it('should use HAVING to filter by attendance threshold', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getChronicAbsentees(10, 'student', 50);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('HAVING');
      expect(queryStr).toContain('total_occurrences > 0');
    });

    it('should order by attendance rate ascending', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getChronicAbsentees(10, 'student');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('ORDER BY');
      expect(queryStr).toContain('ASC');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(
        reportsService.getChronicAbsentees(10, 'student'),
      ).rejects.toThrow('DB error');
    });
  });

  // ─── getSchoolClassComparison() ─────────────────────────────────────────

  describe('getSchoolClassComparison()', () => {
    it('should return per-class event breakdown for a school', async () => {
      // First call: comparison data
      mockedExecuteQuery.mockResolvedValueOnce([
        { class_id: 10, class_name: 'الصف الأول', event_id: 1, event_name: 'حضور', person_type: 'student', total: 10, attended: 8 },
        { class_id: 10, class_name: 'الصف الأول', event_id: 1, event_name: 'حضور', person_type: 'teacher', total: 3, attended: 3 },
        { class_id: 20, class_name: 'الصف الثاني', event_id: 1, event_name: 'حضور', person_type: 'student', total: 12, attended: 10 },
      ] as any);
      // Second call: school info
      mockedExecuteQuery.mockResolvedValueOnce([
        { school_id: 1, school_name: 'مدرسة 1' },
      ] as any);

      const result = await reportsService.getSchoolClassComparison(1, '2025-01-15');

      expect(result.school_id).toBe(1);
      expect(result.school_name).toBe('مدرسة 1');
      expect(result.date).toBe('2025-01-15');
      expect(result.classes).toHaveLength(2);
    });

    it('should aggregate events per class', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { class_id: 10, class_name: 'الصف', event_id: 1, event_name: 'حضور', person_type: 'student', total: 10, attended: 8 },
        { class_id: 10, class_name: 'الصف', event_id: 2, event_name: 'اجتماع', person_type: 'student', total: 10, attended: 9 },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { school_id: 1, school_name: 'مدرسة' },
      ] as any);

      const result = await reportsService.getSchoolClassComparison(1, '2025-01-15');

      expect(result.classes).toHaveLength(1);
      expect(result.classes[0]!.events).toHaveLength(2);
    });

    it('should calculate rate per person_type per event', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { class_id: 10, class_name: 'الصف', event_id: 1, event_name: 'حضور', person_type: 'student', total: 10, attended: 8 },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { school_id: 1, school_name: 'مدرسة' },
      ] as any);

      const result = await reportsService.getSchoolClassComparison(1, '2025-01-15');

      const breakdown = result.classes[0]!.events[0]!.breakdown[0]!;
      expect(breakdown.total).toBe(10);
      expect(breakdown.attended).toBe(8);
      expect(breakdown.rate).toBe(80);
    });

    it('should handle rate of 0 when total is 0', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { class_id: 10, class_name: 'الصف', event_id: 1, event_name: 'حضور', person_type: 'student', total: 0, attended: 0 },
      ] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { school_id: 1, school_name: 'مدرسة' },
      ] as any);

      const result = await reportsService.getSchoolClassComparison(1, '2025-01-15');

      expect(result.classes[0]!.events[0]!.breakdown[0]!.rate).toBe(0);
    });

    it('should return empty classes when no results', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([
        { school_id: 1, school_name: 'مدرسة' },
      ] as any);

      const result = await reportsService.getSchoolClassComparison(1, '2025-01-15');

      expect(result.classes).toEqual([]);
    });

    it('should pass date and schoolId to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getSchoolClassComparison(5, '2025-06-01');

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual(['2025-06-01', 5]);
    });

    it('should default school_name to empty string when school not found', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);
      mockedExecuteQuery.mockResolvedValueOnce([] as any); // no school info

      const result = await reportsService.getSchoolClassComparison(999, '2025-01-15');

      expect(result.school_name).toBe('');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(
        reportsService.getSchoolClassComparison(1, '2025-01-15'),
      ).rejects.toThrow('DB error');
    });
  });

  // ─── getUserClassRole() ─────────────────────────────────────────────────

  describe('getUserClassRole()', () => {
    it('should return "manager" when user has manager role', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([{ role: 'manager' }] as any);

      const result = await reportsService.getUserClassRole(100, 10);

      expect(result).toBe('manager');
    });

    it('should return "leader" when user has leader role', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([{ role: 'leader' }] as any);

      const result = await reportsService.getUserClassRole(100, 10);

      expect(result).toBe('leader');
    });

    it('should return "teacher" when user has teacher role', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([{ role: 'teacher' }] as any);

      const result = await reportsService.getUserClassRole(100, 10);

      expect(result).toBe('teacher');
    });

    it('should return "manager" when user has both manager and teacher roles (highest priority)', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { role: 'teacher' },
        { role: 'manager' },
      ] as any);

      const result = await reportsService.getUserClassRole(100, 10);

      expect(result).toBe('manager');
    });

    it('should return "leader" when user has both leader and teacher roles', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([
        { role: 'teacher' },
        { role: 'leader' },
      ] as any);

      const result = await reportsService.getUserClassRole(100, 10);

      expect(result).toBe('leader');
    });

    it('should return null when user has no roles for the class', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await reportsService.getUserClassRole(100, 10);

      expect(result).toBeNull();
    });

    it('should pass accountId and classId to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getUserClassRole(42, 99);

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42, 99]);
    });

    it('should query roles table', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getUserClassRole(1, 1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('roles');
      expect(queryStr).toContain('account_id');
      expect(queryStr).toContain('class_id');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(reportsService.getUserClassRole(1, 1)).rejects.toThrow('DB error');
    });
  });

  // ─── isSchoolManager() ─────────────────────────────────────────────────

  describe('isSchoolManager()', () => {
    it('should return true when user is a manager for the school', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([{ role: 'manager' }] as any);

      const result = await reportsService.isSchoolManager(100, 1);

      expect(result).toBe(true);
    });

    it('should return false when user is not a manager for the school', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await reportsService.isSchoolManager(100, 1);

      expect(result).toBe(false);
    });

    it('should pass accountId and schoolId to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.isSchoolManager(42, 5);

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42, 5]);
    });

    it('should filter by role = manager in the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.isSchoolManager(1, 1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain("role = 'manager'");
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(reportsService.isSchoolManager(1, 1)).rejects.toThrow('DB error');
    });
  });

  // ─── getUserAvailableDates() ────────────────────────────────────────────

  describe('getUserAvailableDates()', () => {
    it('should return dates from all classes the user has roles in', async () => {
      const mockDates = [
        { date: '2025-01-15', display_date: '15/1/2025' },
        { date: '2025-01-08', display_date: '8/1/2025' },
      ];
      mockedExecuteQuery.mockResolvedValueOnce(mockDates as any);

      const result = await reportsService.getUserAvailableDates(100);

      expect(result).toEqual(mockDates);
    });

    it('should pass accountId to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getUserAvailableDates(42);

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42]);
    });

    it('should join event_occurence, events, and roles tables', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getUserAvailableDates(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('event_occurence');
      expect(queryStr).toContain('events');
      expect(queryStr).toContain('roles');
    });

    it('should order by date DESC', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getUserAvailableDates(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('ORDER BY');
      expect(queryStr).toContain('DESC');
    });

    it('should group by occurence_date to avoid duplicates', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await reportsService.getUserAvailableDates(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('GROUP BY');
    });

    it('should return empty array when no dates available', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await reportsService.getUserAvailableDates(999);

      expect(result).toEqual([]);
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(reportsService.getUserAvailableDates(1)).rejects.toThrow('DB error');
    });
  });
});