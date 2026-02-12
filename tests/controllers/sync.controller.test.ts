import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../src/services/classes.service');
jest.mock('../../src/services/data-versions.service');

import { getTimestamps } from '../../src/controllers/sync.controller';
import classesService from '../../src/services/classes.service';
import dataVersionsService from '../../src/services/data-versions.service';
import { StatusCodes } from 'http-status-codes';

const mockedClassesService = classesService as jest.Mocked<typeof classesService>;
const mockedDataVersionsService = dataVersionsService as jest.Mocked<typeof dataVersionsService>;

function createMockRes(userId: number = 100) {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    locals: {
      user: { sub: userId, username: 'testuser' },
    },
  } as any;
}

function createMockNext() {
  return jest.fn() as any;
}

describe('Sync Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getTimestamps()', () => {
    it('should get user classes and return timestamps with 200', async () => {
      const mockSchools = [
        {
          school_id: 1,
          school_name: 'مدرسة 1',
          role: 'leader',
          classes: [
            { class_id: 10, class_name: 'الصف الأول' },
            { class_id: 20, class_name: 'الصف الثاني' },
          ],
        },
      ];
      const mockTimestamps = {
        class_10_students: '2025-01-15T10:00:00.000Z',
        class_10_teachers: '2025-01-15T10:00:00.000Z',
        class_20_students: '2025-01-15T10:00:00.000Z',
        class_20_teachers: '2025-01-15T10:00:00.000Z',
      };
      mockedClassesService.getUserJoinedSchoolsClasses.mockResolvedValueOnce(mockSchools as any);
      mockedDataVersionsService.getTimestampsForUser.mockResolvedValueOnce(mockTimestamps as any);

      const req = {} as any;
      const res = createMockRes(100);
      const next = createMockNext();

      await getTimestamps(req, res, next);

      expect(mockedClassesService.getUserJoinedSchoolsClasses).toHaveBeenCalledWith(100);
      expect(mockedDataVersionsService.getTimestampsForUser).toHaveBeenCalledWith([10, 20]);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: mockTimestamps });
    });

    it('should extract user ID from res.locals.user.sub', async () => {
      mockedClassesService.getUserJoinedSchoolsClasses.mockResolvedValueOnce([] as any);
      mockedDataVersionsService.getTimestampsForUser.mockResolvedValueOnce({} as any);

      const req = {} as any;
      const res = createMockRes(42);
      const next = createMockNext();

      await getTimestamps(req, res, next);

      expect(mockedClassesService.getUserJoinedSchoolsClasses).toHaveBeenCalledWith(42);
    });

    it('should flatten classIds from multiple schools', async () => {
      const mockSchools = [
        {
          school_id: 1,
          school_name: 'مدرسة 1',
          role: 'leader',
          classes: [
            { class_id: 10, class_name: 'الصف الأول' },
          ],
        },
        {
          school_id: 2,
          school_name: 'مدرسة 2',
          role: 'teacher',
          classes: [
            { class_id: 20, class_name: 'الصف الثاني' },
            { class_id: 30, class_name: 'الصف الثالث' },
          ],
        },
      ];
      mockedClassesService.getUserJoinedSchoolsClasses.mockResolvedValueOnce(mockSchools as any);
      mockedDataVersionsService.getTimestampsForUser.mockResolvedValueOnce({} as any);

      const req = {} as any;
      const res = createMockRes();
      const next = createMockNext();

      await getTimestamps(req, res, next);

      expect(mockedDataVersionsService.getTimestampsForUser).toHaveBeenCalledWith([10, 20, 30]);
    });

    it('should handle user with no classes (empty schools array)', async () => {
      mockedClassesService.getUserJoinedSchoolsClasses.mockResolvedValueOnce([] as any);
      mockedDataVersionsService.getTimestampsForUser.mockResolvedValueOnce({} as any);

      const req = {} as any;
      const res = createMockRes();
      const next = createMockNext();

      await getTimestamps(req, res, next);

      expect(mockedDataVersionsService.getTimestampsForUser).toHaveBeenCalledWith([]);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
      expect(res.json).toHaveBeenCalledWith({ success: true, data: {} });
    });

    it('should handle schools with empty classes arrays', async () => {
      const mockSchools = [
        {
          school_id: 1,
          school_name: 'مدرسة فارغة',
          role: 'manager',
          classes: [],
        },
      ];
      mockedClassesService.getUserJoinedSchoolsClasses.mockResolvedValueOnce(mockSchools as any);
      mockedDataVersionsService.getTimestampsForUser.mockResolvedValueOnce({} as any);

      const req = {} as any;
      const res = createMockRes();
      const next = createMockNext();

      await getTimestamps(req, res, next);

      expect(mockedDataVersionsService.getTimestampsForUser).toHaveBeenCalledWith([]);
      expect(res.status).toHaveBeenCalledWith(StatusCodes.OK);
    });

    it('should return the timestamps object from the data-versions service', async () => {
      const mockSchools = [
        {
          school_id: 1,
          school_name: 'مدرسة',
          role: 'leader',
          classes: [{ class_id: 10, class_name: 'الصف' }],
        },
      ];
      const expectedTimestamps = {
        class_10_students: '2025-06-01T12:00:00.000Z',
        class_10_teachers: '2025-06-01T12:30:00.000Z',
        class_10_events: '2025-06-01T11:00:00.000Z',
        event_1_occurrences: '2025-06-01T13:00:00.000Z',
      };
      mockedClassesService.getUserJoinedSchoolsClasses.mockResolvedValueOnce(mockSchools as any);
      mockedDataVersionsService.getTimestampsForUser.mockResolvedValueOnce(expectedTimestamps as any);

      const req = {} as any;
      const res = createMockRes();
      const next = createMockNext();

      await getTimestamps(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expectedTimestamps,
      });
    });

    it('should call getUserJoinedSchoolsClasses before getTimestampsForUser', async () => {
      const callOrder: string[] = [];
      mockedClassesService.getUserJoinedSchoolsClasses.mockImplementation(async () => {
        callOrder.push('getUserJoinedSchoolsClasses');
        return [] as any;
      });
      mockedDataVersionsService.getTimestampsForUser.mockImplementation(async () => {
        callOrder.push('getTimestampsForUser');
        return {} as any;
      });

      const req = {} as any;
      const res = createMockRes();
      const next = createMockNext();

      await getTimestamps(req, res, next);

      expect(callOrder).toEqual(['getUserJoinedSchoolsClasses', 'getTimestampsForUser']);
    });

    it('should always respond with success: true in the JSON body', async () => {
      mockedClassesService.getUserJoinedSchoolsClasses.mockResolvedValueOnce([] as any);
      mockedDataVersionsService.getTimestampsForUser.mockResolvedValueOnce({} as any);

      const req = {} as any;
      const res = createMockRes();
      const next = createMockNext();

      await getTimestamps(req, res, next);

      const jsonArg = (res.json as jest.Mock).mock.calls[0]![0] as any;
      expect(jsonArg.success).toBe(true);
    });
  });
});