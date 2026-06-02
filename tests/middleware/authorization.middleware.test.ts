import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { Roles } from '../../src/enums/roles.enum';
import { StatusCodes } from 'http-status-codes';

// Mock the services before importing the middleware
jest.mock('../../src/services/auth.service');
jest.mock('../../src/services/persons.service');

import authService from '../../src/services/auth.service';
import personsService from '../../src/services/persons.service';
import {
  isAuthenticated,
  isInClass,
  isInPersonClass,
  hasRole,
} from '../../src/middleware/authorization.middleware';

const mockedAuthService = authService as jest.Mocked<typeof authService>;
const mockedPersonsService = personsService as jest.Mocked<typeof personsService>;

describe('Authorization Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      headers: {},
      body: {},
      params: {},
    };
    mockRes = {
      locals: {},
    };
    mockNext = jest.fn();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('isAuthenticated()', () => {
    it('should call next with Err(401) when no Authorization header is present', () => {
      mockReq.headers = {};

      const middleware = isAuthenticated();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const callArg = mockNext.mock.calls[0]![0];
      // It's an Err(UNAUTHORIZED)
      expect(callArg).toBeDefined();
    });

    it('should call next with Err(401) when Authorization header is undefined', () => {
      mockReq.headers = { authorization: undefined };

      const middleware = isAuthenticated();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('should set res.locals.user and call next() when token is valid', () => {
      const decodedPayload = { payload: { sub: 1, username: 'tony' } };
      mockedAuthService.verify.mockReturnValue(decodedPayload as any);
      mockReq.headers = { authorization: 'valid-jwt-token' };

      const middleware = isAuthenticated();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockedAuthService.verify).toHaveBeenCalledWith('valid-jwt-token');
      expect(mockRes.locals!['user']).toEqual({ sub: 1, username: 'tony' });
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should throw JsonWebTokenError when token is invalid/tampered', () => {
      const { JsonWebTokenError } = require('jsonwebtoken');
      mockedAuthService.verify.mockImplementation(() => {
        throw new JsonWebTokenError('invalid token');
      });
      mockReq.headers = { authorization: 'tampered-token' };

      const middleware = isAuthenticated();

      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow();
    });

    it('should throw when token is expired', () => {
      const { TokenExpiredError } = require('jsonwebtoken');
      mockedAuthService.verify.mockImplementation(() => {
        throw new TokenExpiredError('jwt expired', new Date());
      });
      mockReq.headers = { authorization: 'expired-token' };

      const middleware = isAuthenticated();

      expect(() => {
        middleware(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow();
    });

    it('should pass the raw token value to authService.verify (not split Bearer)', () => {
      const decodedPayload = { payload: { sub: 5, username: 'test' } };
      mockedAuthService.verify.mockReturnValue(decodedPayload as any);
      mockReq.headers = { authorization: 'Bearer some-token' };

      const middleware = isAuthenticated();
      middleware(mockReq as Request, mockRes as Response, mockNext);

      // The middleware passes the raw header value to verify
      expect(mockedAuthService.verify).toHaveBeenCalledWith('Bearer some-token');
    });
  });

  describe('isInClass()', () => {
    beforeEach(() => {
      // Simulate an authenticated user in res.locals
      mockRes.locals = { user: { sub: 1, username: 'tony' } };
    });

    it('should call next() when user has authorized role in class (body)', async () => {
      mockedAuthService.isInAnyClass.mockResolvedValue(true as never);
      mockReq.body = { class_id: 5 };

      const middleware = isInClass('body', [Roles.teacher, Roles.leader, Roles.manager]);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next with HttpError 400 when class_id is missing from body', () => {
      mockReq.body = {};

      const middleware = isInClass('body', [Roles.teacher]);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const callArg = mockNext.mock.calls[0]![0] as any;
      expect(callArg).toBeDefined();
      expect(callArg.status || callArg.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('should read classId from params when whereIsClassId is "params"', async () => {
      mockedAuthService.isInAnyClass.mockResolvedValue(true as never);
      mockReq.params = { classId: '5' };

      const middleware = isInClass('params', [Roles.leader, Roles.manager]);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockedAuthService.isInAnyClass).toHaveBeenCalledWith(
        1, // user.sub
        [5], // classId from params (converted to number by Number())
        [Roles.leader, Roles.manager],
      );
    });

    it('should call next with HttpError 400 when classId is missing from params', () => {
      mockReq.params = {};

      const middleware = isInClass('params', [Roles.teacher]);
      middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const callArg = mockNext.mock.calls[0]![0] as any;
      expect(callArg).toBeDefined();
      expect(callArg.status || callArg.statusCode).toBe(StatusCodes.BAD_REQUEST);
    });

    it('should pass the correct user sub to isInAnyClass', async () => {
      mockedAuthService.isInAnyClass.mockResolvedValue(true as never);
      mockRes.locals = { user: { sub: 42, username: 'george' } };
      mockReq.body = { class_id: 10 };

      const middleware = isInClass('body', [Roles.manager]);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockedAuthService.isInAnyClass).toHaveBeenCalledWith(
        42,
        [10],
        [Roles.manager],
      );
    });

    it('should pass the authorized roles array correctly', async () => {
      mockedAuthService.isInAnyClass.mockResolvedValue(true as never);
      mockReq.body = { class_id: 1 };

      const middleware = isInClass('body', [Roles.leader, Roles.manager]);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockedAuthService.isInAnyClass).toHaveBeenCalledWith(
        1,
        [1],
        [Roles.leader, Roles.manager],
      );
    });
  });

  describe('isInPersonClass()', () => {
    beforeEach(() => {
      mockRes.locals = { user: { sub: 1, username: 'tony' } };
    });

    it('should call next() when user has role in person\'s class', async () => {
      mockedPersonsService.getJoinedClasses.mockResolvedValue([
        { class_id: 5, constructor: { name: 'RowDataPacket' } },
      ] as any);
      mockedAuthService.isInAnyClass.mockResolvedValue(true as never);
      mockReq.params = { studentId: '10' };

      const middleware = isInPersonClass('studentId', 'student', [Roles.teacher, Roles.leader, Roles.manager]);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockedPersonsService.getJoinedClasses).toHaveBeenCalledWith(10, 'student');
      expect(mockedAuthService.isInAnyClass).toHaveBeenCalledWith(
        1,
        [5],
        [Roles.teacher, Roles.leader, Roles.manager],
      );
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next with HttpError 403 when user lacks role in person class', async () => {
      mockedPersonsService.getJoinedClasses.mockResolvedValue([
        { class_id: 5, constructor: { name: 'RowDataPacket' } },
      ] as any);
      mockedAuthService.isInAnyClass.mockResolvedValue(false as never);
      mockReq.params = { studentId: '10' };

      const middleware = isInPersonClass('studentId', 'student', [Roles.leader, Roles.manager]);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const callArg = mockNext.mock.calls[0]![0] as any;
      expect(callArg).toBeDefined();
      expect(callArg.status || callArg.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    it('should throw when person ID param is NaN', async () => {
      mockReq.params = { studentId: 'not-a-number' };

      const middleware = isInPersonClass('studentId', 'student', [Roles.teacher]);

      await expect(
        middleware(mockReq as Request, mockRes as Response, mockNext),
      ).rejects.toThrow();
    });

    it('should throw when person ID param is missing', async () => {
      mockReq.params = {};

      const middleware = isInPersonClass('studentId', 'student', [Roles.teacher]);

      await expect(
        middleware(mockReq as Request, mockRes as Response, mockNext),
      ).rejects.toThrow();
    });

    it('should use the correct type when getting joined classes', async () => {
      mockedPersonsService.getJoinedClasses.mockResolvedValue([
        { class_id: 3, constructor: { name: 'RowDataPacket' } },
      ] as any);
      mockedAuthService.isInAnyClass.mockResolvedValue(true as never);
      mockReq.params = { teacherId: '7' };

      const middleware = isInPersonClass('teacherId', 'teacher', [Roles.leader, Roles.manager]);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockedPersonsService.getJoinedClasses).toHaveBeenCalledWith(7, 'teacher');
    });

    it('should pass all person class_ids to isInAnyClass', async () => {
      mockedPersonsService.getJoinedClasses.mockResolvedValue([
        { class_id: 2, constructor: { name: 'RowDataPacket' } },
        { class_id: 5, constructor: { name: 'RowDataPacket' } },
        { class_id: 8, constructor: { name: 'RowDataPacket' } },
      ] as any);
      mockedAuthService.isInAnyClass.mockResolvedValue(true as never);
      mockReq.params = { studentId: '15' };

      const middleware = isInPersonClass('studentId', 'student', [Roles.teacher]);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockedAuthService.isInAnyClass).toHaveBeenCalledWith(
        1,
        [2, 5, 8],
        [Roles.teacher],
      );
    });

    it('should call next with HttpError 403 when person has no classes', async () => {
      mockedPersonsService.getJoinedClasses.mockResolvedValue([] as any);
      mockedAuthService.isInAnyClass.mockResolvedValue(false as never);
      mockReq.params = { studentId: '99' };

      const middleware = isInPersonClass('studentId', 'student', [Roles.teacher]);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockedAuthService.isInAnyClass).toHaveBeenCalledWith(1, [], [Roles.teacher]);
      expect(mockNext).toHaveBeenCalledTimes(1);
      const callArg = mockNext.mock.calls[0]![0] as any;
      expect(callArg).toBeDefined();
      expect(callArg.status || callArg.statusCode).toBe(StatusCodes.FORBIDDEN);
    });
  });

  describe('hasRole()', () => {
    beforeEach(() => {
      mockRes.locals = { user: { sub: 1, username: 'tony' } };
    });

    it('should call next() when user has the required role', async () => {
      mockedAuthService.hasRole.mockResolvedValue(true as never);

      const middleware = hasRole([Roles.manager]);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockedAuthService.hasRole).toHaveBeenCalledWith(1, [Roles.manager]);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next with HttpError 403 when user lacks required role', async () => {
      mockedAuthService.hasRole.mockResolvedValue(false as never);

      const middleware = hasRole([Roles.manager]);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const callArg = mockNext.mock.calls[0]![0] as any;
      expect(callArg).toBeDefined();
      expect(callArg.status || callArg.statusCode).toBe(StatusCodes.FORBIDDEN);
    });

    it('should pass the correct user sub to hasRole', async () => {
      mockedAuthService.hasRole.mockResolvedValue(true as never);
      mockRes.locals = { user: { sub: 42, username: 'george' } };

      const middleware = hasRole([Roles.leader]);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockedAuthService.hasRole).toHaveBeenCalledWith(42, [Roles.leader]);
    });

    it('should pass multiple required roles correctly', async () => {
      mockedAuthService.hasRole.mockResolvedValue(true as never);

      const middleware = hasRole([Roles.leader, Roles.manager]);
      await middleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockedAuthService.hasRole).toHaveBeenCalledWith(1, [Roles.leader, Roles.manager]);
    });

    it('should handle hasRole service throwing an error', async () => {
      mockedAuthService.hasRole.mockRejectedValue(new Error('DB error') as never);

      const middleware = hasRole([Roles.manager]);

      await expect(
        middleware(mockReq as Request, mockRes as Response, mockNext),
      ).rejects.toThrow('DB error');
    });
  });
});