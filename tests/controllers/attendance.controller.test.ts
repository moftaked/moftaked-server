import { expect, jest, describe, it, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { patchAttendance } from '../../src/controllers/attendance.controller';
import attendanceService from '../../src/services/attendance.service';
import { PatchAttendanceDto } from '../../src/schemas/attendance.schemas';
const createHttpError = require('http-errors');

jest.mock('../../src/services/attendance.service');

let mockedAttendanceService = attendanceService as jest.Mocked<typeof attendanceService>;

afterEach(() => {
  jest.clearAllMocks();
});

describe('Attendance Controller', () => {
  describe('patchAttendance', () => {
    it('should call patchAttendance with the correct parameters', async () => {
      (['teacher', 'student'] as ['teacher', 'student']).forEach(async (type) => {
        const handler = patchAttendance(type);
        const req = {
          body: {
            attended: [1, 2, 3],
            absent: [4, 5],
            type,
          } as PatchAttendanceDto,
          params: {
            eventOccurrenceId: '12'
          }
        } as any as Request;
        const res = {
          json: jest.fn(),
        } as any as Response;

        const next = jest.fn();
        await handler(req, res, next);

        expect(mockedAttendanceService.patchAttendance)
        .toHaveBeenCalledWith([1, 2, 3], [4, 5], 12, type);
      });
    });

    it('should return 400 if eventOccurrenceId is not a number', async () => {
      const handler = patchAttendance('student');
      const req = {
        body: {
          attended: [1, 2, 3],
          absent: [4, 5],
        } as PatchAttendanceDto,
        params: {
          eventOccurrenceId: 'invalid'
        }
      } as any as Request;
      const res = {
        json: jest.fn(),
      } as any as Response;

      const next = jest.fn();
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(createHttpError(400, 'Event occurrence ID is required'));
      expect(mockedAttendanceService.patchAttendance).not.toHaveBeenCalled();
    });
  });
});
