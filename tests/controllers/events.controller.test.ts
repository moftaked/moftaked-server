import { createEvent, createEventOccurrence, deleteEvent, deleteLastEventOccurrence, getEvents } from '../../src/controllers/events.controller';
import { expect, jest, describe, it, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import rolesService from '../../src/services/roles.service';
import eventsService from '../../src/services/events.service';
import { Roles } from '../../src/enums/roles.enum';
import { StatusCodes } from 'http-status-codes';
import { eventTypes } from '../../src/enums/eventTypes.enum';
const createHttpError = require('http-errors');

jest.mock('../../src/services/roles.service');
jest.mock('../../src/services/events.service');

let mockedRolesService = rolesService as jest.Mocked<typeof rolesService>;
let mockedEventsService = eventsService as jest.Mocked<typeof eventsService>;

afterEach(() => {
  jest.clearAllMocks();
});

describe('Events Controller', () => {
  describe('getEvents', () => {
    it('should call eventsService.getEvents with the correct parameters', async () => {
      mockedRolesService.getHighestRole.mockResolvedValue(Roles.teacher);
      const req = {
        params: {
          classId: '1',
        },
        user: {
          sub: 'user-id',
        },
      } as any as Request;

      const res = {
        locals: {
          user: {
            sub: 'user-id',
          },
        },
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      const next = jest.fn();

      await getEvents(req, res, next);

      expect(mockedRolesService.getHighestRole).toHaveBeenCalled();
      expect(mockedEventsService.getEvents).toHaveBeenCalledWith(Roles.teacher, 1);
    });

    it("shouldn't proceed if user is not assigned to requested class", async () => {
      mockedRolesService.getHighestRole.mockResolvedValue(undefined);
      const req = {
        params: {
          classId: '1',
        },
      } as any as Request;

      const res = {
        locals: {
          user: {
            sub: 'user-id',
          },
        },
      } as unknown as Response;

      const next = jest.fn();

      await getEvents(req, res, next);

      expect(mockedRolesService.getHighestRole).toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(createHttpError(403, 'You do not have permission to access this resource'));
      expect(mockedEventsService.getEvents).not.toHaveBeenCalled();
    });

    it('should return 400 error for invalid class ID', async () => {
      const req = {
        params: {
          classId: 'invalid',
        },
      } as any as Request;

      const res = {
        locals: {
          user: {
            sub: 'user-id',
          },
        },
      } as unknown as Response;

      const next = jest.fn();

      await getEvents(req, res, next);

      expect(mockedRolesService.getHighestRole).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid class ID'));
    });
  });

  describe('createEvent', () => {
    it('should call eventsService.createEvent with the correct parameters', async () => {
      const req = {
        body: {
          classId: 1,
          eventName: 'New Event',
          type: eventTypes.student,
        },
      } as any as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await createEvent(req, res);

      expect(mockedEventsService.createEvent).toHaveBeenCalledWith(1, 'New Event', eventTypes.student);
    });
  });

  describe('deleteEvent', () => {
    it('should call eventsService.deleteEvent with the correct parameters', async () => {
      const req = {
        params: {
          eventId: '1',
        },
      } as any as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      const next = jest.fn();

      await deleteEvent(req, res, next);

      expect(mockedEventsService.deleteEvent).toHaveBeenCalledWith(1);
    });

    it('should return 400 error for invalid event ID', async () => {
      const req = {
        params: {
          eventId: 'invalid',
        },
      } as any as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      const next = jest.fn();

      await deleteEvent(req, res, next);

      expect(mockedEventsService.deleteEvent).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid event ID'));
    });
  });

  describe('createEventOccurrence', () => {
    it('should call eventsService.createEventOccurrence with the correct parameters', async () => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-07-20T10:30:00Z'));
      const req = {
        body: {
          eventId: 1,
        },
      } as any as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await createEventOccurrence(req, res);

      expect(mockedEventsService.createEventOccurrence).toHaveBeenCalledWith(1, '2025-07-20');
    });
  });

  describe('deleteLastEventOccurrence', () => {
    it('should call eventsService.deleteLastEventOccurrence with the correct parameters', async () => {
      const req = {
        body: {
          eventId: 1,
        },
      } as any as Request;

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await deleteLastEventOccurrence(req, res);

      expect(mockedEventsService.deleteLastEventOccurrence).toHaveBeenCalledWith(1);
    });
  });
});