import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { NextFunction } from 'express';

jest.mock('../../src/services/reports.service');

import {
  getReportsAccess,
  getManagarialReports,
  getLeaderEventReport,
  getTeacherEventReport,
  getClassAttendanceSummary,
  getClassAvailableDates,
  getEventAttendanceTrends,
  getAbsentees,
  getPersonAttendanceHistory,
  getRangedAbsentees,
  getSchoolClassComparison,
  getUserAvailableDates,
} from '../../src/controllers/reports.controller';
import reportsService from '../../src/services/reports.service';
import { Err } from 'result2';
import { StatusCodes } from 'http-status-codes';

const mockedReportsService = reportsService as jest.Mocked<typeof reportsService>;

function createMockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: {
      user: { sub: 100, username: 'testuser' },
    },
  } as any;
}

function createMockNext() {
  return jest.fn() as unknown as NextFunction;
}

describe('Reports Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── getReportsAccess ───────────────────────────────────────────────────

  describe('getReportsAccess()', () => {
    it('should call service with user ID from res.locals and return 200', async () => {
      const mockAccess = {
        isManager: true,
        isLeader: false,
        isTeacher: false,
        managedSchools: [{ school_id: 1, school_name: 'خدمة 1' }],
        leaderClasses: [],
        teacherClasses: [],
      };
      mockedReportsService.getReportsAccess.mockResolvedValueOnce(mockAccess);

      const req = {} as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getReportsAccess as any)(req, res, next);

      expect(mockedReportsService.getReportsAccess).toHaveBeenCalledWith(100);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockAccess });
      expect(next).not.toHaveBeenCalled();
    });

    it('should forward service errors to next', async () => {
      const error = new Error('DB error');
      mockedReportsService.getReportsAccess.mockRejectedValueOnce(error);

      const req = {} as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getReportsAccess as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // ─── getManagarialReports ───────────────────────────────────────────────

  describe('getManagarialReports()', () => {
    it('should use query date and return 200 with data', async () => {
      const mockData = { overAllStats: [] };
      mockedReportsService.getManagarialReports.mockResolvedValueOnce(mockData as any);

      const req = { query: { date: '2025-01-15' } } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getManagarialReports as any)(req, res, next);

      expect(mockedReportsService.getManagarialReports).toHaveBeenCalledWith(100, '2025-01-15');
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it('should default to today when no date query provided', async () => {
      const today = new Date().toISOString().slice(0, 10);
      const mockData = { overAllStats: [] };
      mockedReportsService.getManagarialReports.mockResolvedValueOnce(mockData as any);

      const req = { query: {} } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getManagarialReports as any)(req, res, next);

      expect(mockedReportsService.getManagarialReports).toHaveBeenCalledWith(100, today);
    });

    it('should forward Result error to next when service returns Err', async () => {
      const result = Err(StatusCodes.FORBIDDEN);
      mockedReportsService.getManagarialReports.mockResolvedValueOnce(result as any);

      const req = { query: { date: '2025-01-15' } } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getManagarialReports as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(result);
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should forward thrown errors to next', async () => {
      const error = new Error('DB error');
      mockedReportsService.getManagarialReports.mockRejectedValueOnce(error);

      const req = { query: { date: '2025-01-15' } } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getManagarialReports as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ─── getLeaderEventReport ──────────────────────────────────────────────

  describe('getLeaderEventReport()', () => {
    it('should parse eventId and type from params and return 200', async () => {
      const mockData = [{ occurence_date: '15/1', attended: 8, total: 10 }];
      mockedReportsService.getLeaderEventReport.mockResolvedValueOnce(mockData as any);

      const req = {
        params: { eventId: '5', type: 'student' },
        query: { date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getLeaderEventReport as any)(req, res, next);

      expect(mockedReportsService.getLeaderEventReport).toHaveBeenCalledWith(
        '5', 'student', '2025-01-15',
      );
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it('should default to today when no date query provided', async () => {
      const today = new Date().toISOString().slice(0, 10);
      mockedReportsService.getLeaderEventReport.mockResolvedValueOnce([] as any);

      const req = {
        params: { eventId: '5', type: 'student' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getLeaderEventReport as any)(req, res, next);

      expect(mockedReportsService.getLeaderEventReport).toHaveBeenCalledWith(
        '5', 'student', today,
      );
    });

    it('should forward errors to next', async () => {
      const error = new Error('DB error');
      mockedReportsService.getLeaderEventReport.mockRejectedValueOnce(error);

      const req = {
        params: { eventId: '5', type: 'student' },
        query: { date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getLeaderEventReport as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ─── getTeacherEventReport ─────────────────────────────────────────────

  describe('getTeacherEventReport()', () => {
    it('should parse eventId from params and return 200', async () => {
      const mockData = [{ occurence_date: '15/1', attended: 6, total: 10 }];
      mockedReportsService.getTeacherEventReport.mockResolvedValueOnce(mockData as any);

      const req = {
        params: { eventId: '5' },
        query: { date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getTeacherEventReport as any)(req, res, next);

      expect(mockedReportsService.getTeacherEventReport).toHaveBeenCalledWith(
        '5', '2025-01-15',
      );
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it('should default to today when no date query', async () => {
      const today = new Date().toISOString().slice(0, 10);
      mockedReportsService.getTeacherEventReport.mockResolvedValueOnce([] as any);

      const req = {
        params: { eventId: '5' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getTeacherEventReport as any)(req, res, next);

      expect(mockedReportsService.getTeacherEventReport).toHaveBeenCalledWith('5', today);
    });

    it('should forward errors to next', async () => {
      const error = new Error('DB error');
      mockedReportsService.getTeacherEventReport.mockRejectedValueOnce(error);

      const req = {
        params: { eventId: '5' },
        query: { date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getTeacherEventReport as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ─── getClassAttendanceSummary ─────────────────────────────────────────

  describe('getClassAttendanceSummary()', () => {
    it('should return 200 with data when user has access', async () => {
      mockedReportsService.getUserClassRole.mockResolvedValueOnce('leader');
      const mockData = { class_id: 10, events: [] };
      mockedReportsService.getClassAttendanceSummary.mockResolvedValueOnce(mockData as any);

      const req = {
        params: { classId: '10' },
        query: { date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getClassAttendanceSummary as any)(req, res, next);

      expect(mockedReportsService.getUserClassRole).toHaveBeenCalledWith(100, 10);
      expect(mockedReportsService.getClassAttendanceSummary).toHaveBeenCalledWith(10, '2025-01-15', 'leader');
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData, role: 'leader' });
    });

    it('should call next with 400 when classId is invalid (NaN)', async () => {
      const req = {
        params: { classId: 'abc' },
        query: { date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getClassAttendanceSummary as any)(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('should call next with 403 when user has no role for the class', async () => {
      mockedReportsService.getUserClassRole.mockResolvedValueOnce(null);

      const req = {
        params: { classId: '10' },
        query: { date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getClassAttendanceSummary as any)(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('should default to today when no date query', async () => {
      const today = new Date().toISOString().slice(0, 10);
      mockedReportsService.getUserClassRole.mockResolvedValueOnce('teacher');
      mockedReportsService.getClassAttendanceSummary.mockResolvedValueOnce({} as any);

      const req = {
        params: { classId: '10' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getClassAttendanceSummary as any)(req, res, next);

      expect(mockedReportsService.getClassAttendanceSummary).toHaveBeenCalledWith(10, today, 'teacher');
    });

    it('should forward service errors to next', async () => {
      const error = new Error('DB error');
      mockedReportsService.getUserClassRole.mockRejectedValueOnce(error);

      const req = {
        params: { classId: '10' },
        query: { date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getClassAttendanceSummary as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ─── getClassAvailableDates ────────────────────────────────────────────

  describe('getClassAvailableDates()', () => {
    it('should return 200 with dates when user has access', async () => {
      mockedReportsService.getUserClassRole.mockResolvedValueOnce('leader');
      const mockDates = [{ date: '2025-01-15', display_date: '15/1/2025' }];
      mockedReportsService.getClassAvailableDates.mockResolvedValueOnce(mockDates as any);

      const req = {
        params: { classId: '10' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getClassAvailableDates as any)(req, res, next);

      expect(mockedReportsService.getUserClassRole).toHaveBeenCalledWith(100, 10);
      expect(mockedReportsService.getClassAvailableDates).toHaveBeenCalledWith(10, 30);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it('should call next with 400 when classId is invalid', async () => {
      const req = {
        params: { classId: 'abc' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getClassAvailableDates as any)(req, res, next);

      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('should call next with 403 when no role', async () => {
      mockedReportsService.getUserClassRole.mockResolvedValueOnce(null);

      const req = {
        params: { classId: '10' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getClassAvailableDates as any)(req, res, next);

      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('should use default limit of 30', async () => {
      mockedReportsService.getUserClassRole.mockResolvedValueOnce('manager');
      mockedReportsService.getClassAvailableDates.mockResolvedValueOnce([] as any);

      const req = {
        params: { classId: '10' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getClassAvailableDates as any)(req, res, next);

      expect(mockedReportsService.getClassAvailableDates).toHaveBeenCalledWith(10, 30);
    });

    it('should use custom limit from query', async () => {
      mockedReportsService.getUserClassRole.mockResolvedValueOnce('manager');
      mockedReportsService.getClassAvailableDates.mockResolvedValueOnce([] as any);

      const req = {
        params: { classId: '10' },
        query: { limit: '50' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getClassAvailableDates as any)(req, res, next);

      expect(mockedReportsService.getClassAvailableDates).toHaveBeenCalledWith(10, 50);
    });

    it('should forward service errors to next', async () => {
      const error = new Error('DB error');
      mockedReportsService.getUserClassRole.mockRejectedValueOnce(error);

      const req = {
        params: { classId: '10' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getClassAvailableDates as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ─── getEventAttendanceTrends ──────────────────────────────────────────

  describe('getEventAttendanceTrends()', () => {
    it('should return 200 with trends data', async () => {
      const mockData = {
        event_id: 5,
        event_name: 'حضور',
        class_id: 10,
        occurrences: [],
        summary: {},
      };
      mockedReportsService.getEventAttendanceTrends.mockResolvedValueOnce(mockData as any);
      mockedReportsService.getUserClassRole.mockResolvedValueOnce('leader');

      const req = {
        params: { eventId: '5' },
        query: { type: 'student', limit: '10' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getEventAttendanceTrends as any)(req, res, next);

      expect(mockedReportsService.getEventAttendanceTrends).toHaveBeenCalledWith(5, 'student', 10);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it('should call next with 400 when eventId is invalid', async () => {
      const req = {
        params: { eventId: 'abc' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getEventAttendanceTrends as any)(req, res, next);

      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('should call next with 403 when user has no role for the class', async () => {
      const mockData = {
        event_id: 5,
        class_id: 10,
        occurrences: [],
        summary: {},
      };
      mockedReportsService.getEventAttendanceTrends.mockResolvedValueOnce(mockData as any);
      mockedReportsService.getUserClassRole.mockResolvedValueOnce(null);

      const req = {
        params: { eventId: '5' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getEventAttendanceTrends as any)(req, res, next);

      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('should default type to "student" and limit to 10', async () => {
      const mockData = { event_id: 5, class_id: 10, occurrences: [], summary: {} };
      mockedReportsService.getEventAttendanceTrends.mockResolvedValueOnce(mockData as any);
      mockedReportsService.getUserClassRole.mockResolvedValueOnce('leader');

      const req = {
        params: { eventId: '5' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getEventAttendanceTrends as any)(req, res, next);

      expect(mockedReportsService.getEventAttendanceTrends).toHaveBeenCalledWith(5, 'student', 10);
    });

    it('should forward service errors to next', async () => {
      const error = new Error('DB error');
      mockedReportsService.getEventAttendanceTrends.mockRejectedValueOnce(error);

      const req = {
        params: { eventId: '5' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getEventAttendanceTrends as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ─── getAbsentees ──────────────────────────────────────────────────────

  describe('getAbsentees()', () => {
    it('should return 200 with absentees data for leader', async () => {
      mockedReportsService.getUserClassRole.mockResolvedValueOnce('leader');
      const mockData = { students: [], teachers: [], total_absent_students: 0, total_absent_teachers: 0 };
      mockedReportsService.getAbsentees.mockResolvedValueOnce(mockData as any);

      const req = {
        params: { classId: '10' },
        query: { eventId: '5', date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getAbsentees as any)(req, res, next);

      expect(mockedReportsService.getUserClassRole).toHaveBeenCalledWith(100, 10);
      expect(mockedReportsService.getAbsentees).toHaveBeenCalledWith(10, 5, '2025-01-15');
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it('should call next with 400 when classId is invalid', async () => {
      const req = {
        params: { classId: 'abc' },
        query: { eventId: '5', date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getAbsentees as any)(req, res, next);

      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('should call next with 400 when eventId is invalid', async () => {
      const req = {
        params: { classId: '10' },
        query: { eventId: 'abc', date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getAbsentees as any)(req, res, next);

      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('should return 200 for teacher with empty teacher data', async () => {
      mockedReportsService.getUserClassRole.mockResolvedValueOnce('teacher');
      const mockData = { students: [{ person_id: 1, person_name: 'أحمد' }], teachers: [{ person_id: 2, person_name: 'خالد' }], total_absent_students: 1, total_absent_teachers: 1 };
      mockedReportsService.getAbsentees.mockResolvedValueOnce(mockData as any);

      const req = {
        params: { classId: '10' },
        query: { eventId: '5', date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getAbsentees as any)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          students: [{ person_id: 1, person_name: 'أحمد' }],
          teachers: [],
          total_absent_students: 1,
          total_absent_teachers: 0,
        },
      });
    });

    it('should call next with 403 when user has no role', async () => {
      mockedReportsService.getUserClassRole.mockResolvedValueOnce(null);

      const req = {
        params: { classId: '10' },
        query: { eventId: '5', date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getAbsentees as any)(req, res, next);

      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('should allow manager role to view absentees', async () => {
      mockedReportsService.getUserClassRole.mockResolvedValueOnce('manager');
      mockedReportsService.getAbsentees.mockResolvedValueOnce({} as any);

      const req = {
        params: { classId: '10' },
        query: { eventId: '5', date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getAbsentees as any)(req, res, next);

      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it('should default to today when no date query', async () => {
      const today = new Date().toISOString().slice(0, 10);
      mockedReportsService.getUserClassRole.mockResolvedValueOnce('leader');
      mockedReportsService.getAbsentees.mockResolvedValueOnce({} as any);

      const req = {
        params: { classId: '10' },
        query: { eventId: '5' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getAbsentees as any)(req, res, next);

      expect(mockedReportsService.getAbsentees).toHaveBeenCalledWith(10, 5, today);
    });

    it('should forward service errors to next', async () => {
      const error = new Error('DB error');
      mockedReportsService.getUserClassRole.mockRejectedValueOnce(error);

      const req = {
        params: { classId: '10' },
        query: { eventId: '5', date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getAbsentees as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ─── getPersonAttendanceHistory ────────────────────────────────────────

  describe('getPersonAttendanceHistory()', () => {
    beforeEach(() => {
      mockedReportsService.getUserPersonRole.mockResolvedValue('teacher' as never);
    });

    it('should return 200 with history data', async () => {
      const mockData = {
        person_id: 7,
        person_name: 'أحمد',
        overall: { total_occurrences: 10, attended: 8, absent: 2, rate: 80 },
        events: [],
      };
      mockedReportsService.getPersonAttendanceHistory.mockResolvedValueOnce(mockData as any);

      const req = {
        params: { personId: '7' },
        query: { type: 'student', limit: '20' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getPersonAttendanceHistory as any)(req, res, next);

      expect(mockedReportsService.getPersonAttendanceHistory).toHaveBeenCalledWith(7, 'student', 20, undefined, undefined);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it('should call next with 400 when personId is invalid', async () => {
      const req = {
        params: { personId: 'abc' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getPersonAttendanceHistory as any)(req, res, next);

      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('should call next with 403 when user has no access to the person', async () => {
      mockedReportsService.getUserPersonRole.mockReset();
      mockedReportsService.getUserPersonRole.mockResolvedValue(null as never);

      const req = {
        params: { personId: '9999' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getPersonAttendanceHistory as any)(req, res, next);

      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('should call next with 404 when person not found after access check passes', async () => {
      mockedReportsService.getPersonAttendanceHistory.mockResolvedValueOnce(null);

      const req = {
        params: { personId: '9999' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getPersonAttendanceHistory as any)(req, res, next);

      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.NOT_FOUND);
    });

    it('should default type to "student" and limit to 20', async () => {
      const mockData = { person_id: 7, events: [] };
      mockedReportsService.getPersonAttendanceHistory.mockResolvedValueOnce(mockData as any);

      const req = {
        params: { personId: '7' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getPersonAttendanceHistory as any)(req, res, next);

      expect(mockedReportsService.getPersonAttendanceHistory).toHaveBeenCalledWith(7, 'student', 20, undefined, undefined);
    });

    it('should forward service errors to next', async () => {
      const error = new Error('DB error');
      mockedReportsService.getPersonAttendanceHistory.mockRejectedValueOnce(error);

      const req = {
        params: { personId: '7' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getPersonAttendanceHistory as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ─── getRangedAbsentees ───────────────────────────────────────────────

  describe('getRangedAbsentees()', () => {
    it('should return 200 with chronic absentees for leader', async () => {
      mockedReportsService.getUserClassRole.mockResolvedValueOnce('leader');
      const mockData = [{ person_id: 1, person_name: 'أحمد', rate: 30 }];
      mockedReportsService.getRangedAbsentees.mockResolvedValueOnce(mockData as any);

      const req = {
        params: { classId: '10' },
        query: { type: 'student', last: '5' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getRangedAbsentees as any)(req, res, next);

      expect(mockedReportsService.getUserClassRole).toHaveBeenCalledWith(100, 10);
      expect(mockedReportsService.getRangedAbsentees).toHaveBeenCalledWith(10, 'student', undefined, undefined);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it('should call next with 400 when classId is invalid', async () => {
      const req = {
        params: { classId: 'abc' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getRangedAbsentees as any)(req, res, next);

      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('should return 200 for teacher with student type forced', async () => {
      mockedReportsService.getUserClassRole.mockResolvedValueOnce('teacher');
      const mockData = [{ person_id: 1, person_name: 'أحمد', rate: 30 }];
      mockedReportsService.getRangedAbsentees.mockResolvedValueOnce(mockData as any);

      const req = {
        params: { classId: '10' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getRangedAbsentees as any)(req, res, next);

      expect(mockedReportsService.getRangedAbsentees).toHaveBeenCalledWith(10, 'student', undefined, undefined);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
    });

    it('should call next with 403 when no role', async () => {
      mockedReportsService.getUserClassRole.mockResolvedValueOnce(null);

      const req = {
        params: { classId: '10' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getRangedAbsentees as any)(req, res, next);

      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('should default type to "student"', async () => {
      mockedReportsService.getUserClassRole.mockResolvedValueOnce('manager');
      mockedReportsService.getRangedAbsentees.mockResolvedValueOnce([] as any);

      const req = {
        params: { classId: '10' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getRangedAbsentees as any)(req, res, next);

      expect(mockedReportsService.getRangedAbsentees).toHaveBeenCalledWith(10, 'student', undefined, undefined);
    });

    it('should forward service errors to next', async () => {
      const error = new Error('DB error');
      mockedReportsService.getUserClassRole.mockRejectedValueOnce(error);

      const req = {
        params: { classId: '10' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getRangedAbsentees as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ─── getSchoolClassComparison ──────────────────────────────────────────

  describe('getSchoolClassComparison()', () => {
    it('should return 200 with comparison data for manager', async () => {
      mockedReportsService.isSchoolManager.mockResolvedValueOnce(true);
      const mockData = { school_id: 1, classes: [] };
      mockedReportsService.getSchoolClassComparison.mockResolvedValueOnce(mockData as any);

      const req = {
        params: { schoolId: '1' },
        query: { date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getSchoolClassComparison as any)(req, res, next);

      expect(mockedReportsService.isSchoolManager).toHaveBeenCalledWith(100, 1);
      expect(mockedReportsService.getSchoolClassComparison).toHaveBeenCalledWith(1, '2025-01-15');
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it('should call next with 400 when schoolId is invalid', async () => {
      const req = {
        params: { schoolId: 'abc' },
        query: { date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getSchoolClassComparison as any)(req, res, next);

      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.BAD_REQUEST);
    });

    it('should call next with 403 when user is not manager', async () => {
      mockedReportsService.isSchoolManager.mockResolvedValueOnce(false);

      const req = {
        params: { schoolId: '1' },
        query: { date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getSchoolClassComparison as any)(req, res, next);

      const error = (next as jest.Mock).mock.calls[0]![0] as any;
      expect(error.statusCode || error.status).toBe(StatusCodes.FORBIDDEN);
    });

    it('should default to today when no date query', async () => {
      const today = new Date().toISOString().slice(0, 10);
      mockedReportsService.isSchoolManager.mockResolvedValueOnce(true);
      mockedReportsService.getSchoolClassComparison.mockResolvedValueOnce({} as any);

      const req = {
        params: { schoolId: '1' },
        query: {},
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getSchoolClassComparison as any)(req, res, next);

      expect(mockedReportsService.getSchoolClassComparison).toHaveBeenCalledWith(1, today);
    });

    it('should forward service errors to next', async () => {
      const error = new Error('DB error');
      mockedReportsService.isSchoolManager.mockRejectedValueOnce(error);

      const req = {
        params: { schoolId: '1' },
        query: { date: '2025-01-15' },
      } as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getSchoolClassComparison as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  // ─── getUserAvailableDates ─────────────────────────────────────────────

  describe('getUserAvailableDates()', () => {
    it('should call service with user ID and return 200', async () => {
      const mockDates = [
        { date: '2025-01-15', display_date: '15/1/2025' },
      ];
      mockedReportsService.getUserAvailableDates.mockResolvedValueOnce(mockDates as any);

      const req = {} as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getUserAvailableDates as any)(req, res, next);

      expect(mockedReportsService.getUserAvailableDates).toHaveBeenCalledWith(100);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockDates });
    });

    it('should forward service errors to next', async () => {
      const error = new Error('DB error');
      mockedReportsService.getUserAvailableDates.mockRejectedValueOnce(error);

      const req = {} as any;
      const res = createMockRes();
      const next = createMockNext();

      await (getUserAvailableDates as any)(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});