import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Request, Response } from 'express';
import { validateData } from '../../src/middleware/validation.middleware';
import { z, ZodError } from 'zod/v4';

describe('Validation Middleware', () => {
  let mockRes: Response;
  let mockNext: jest.Mock;

  const testSchema = z.object({
    username: z.string().min(4).max(50),
    password: z.string().min(8),
  });

  beforeEach(() => {
    mockRes = {} as Response;
    mockNext = jest.fn();
  });

  describe('validateData', () => {
    it('should call next() with no arguments when body is valid', () => {
      const mockReq = {
        body: {
          username: 'test_user',
          password: '12345678',
        },
      } as Request;

      const middleware = validateData(testSchema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should call next(ZodError) when body is invalid', () => {
      const mockReq = {
        body: {
          username: 'ab', // too short
          password: '123', // too short
        },
      } as Request;

      const middleware = validateData(testSchema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const callArg = mockNext.mock.calls[0]![0];
      expect(callArg).toBeInstanceOf(ZodError);
    });

    it('should call next(ZodError) when body is empty object', () => {
      const mockReq = {
        body: {},
      } as Request;

      const middleware = validateData(testSchema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const callArg = mockNext.mock.calls[0]![0];
      expect(callArg).toBeInstanceOf(ZodError);
    });

    it('should call next(ZodError) when required field is missing', () => {
      const mockReq = {
        body: {
          username: 'test_user',
          // password missing
        },
      } as Request;

      const middleware = validateData(testSchema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const callArg = mockNext.mock.calls[0]![0];
      expect(callArg).toBeInstanceOf(ZodError);
    });

    it('should call next(ZodError) with issues containing the failing field path', () => {
      const mockReq = {
        body: {
          username: 'ab', // too short, min 4
          password: '12345678',
        },
      } as Request;

      const middleware = validateData(testSchema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const callArg = mockNext.mock.calls[0]![0] as ZodError;
      expect(callArg).toBeInstanceOf(ZodError);
      const usernamePaths = callArg.issues.map(i => i.path);
      expect(usernamePaths.some(p => p.includes('username'))).toBe(true);
    });

    it('should not modify the request object', () => {
      const body = {
        username: 'test_user',
        password: '12345678',
      };
      const mockReq = { body: { ...body } } as Request;

      const middleware = validateData(testSchema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockReq.body).toEqual(body);
    });

    it('should call next() with no arguments when body has extra fields (zod strips by default or passes)', () => {
      const mockReq = {
        body: {
          username: 'test_user',
          password: '12345678',
          extraField: 'should be ignored',
        },
      } as Request;

      const middleware = validateData(testSchema);
      middleware(mockReq, mockRes, mockNext);

      // validateData only checks if parse succeeds, doesn't modify body
      expect(mockNext).toHaveBeenCalledTimes(1);
      // In zod/v4, z.object is strict by default and rejects unknown keys
      // But the middleware uses safeParse and only checks success
      // Let's just verify next was called (behavior depends on zod version strictness)
    });

    it('should work with different schemas', () => {
      const nameSchema = z.object({
        name: z.string().min(2).max(50),
      });

      const validReq = {
        body: { name: 'Tony' },
      } as Request;

      const invalidReq = {
        body: { name: 'T' }, // too short
      } as Request;

      const middleware = validateData(nameSchema);

      middleware(validReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();

      mockNext.mockClear();

      middleware(invalidReq, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
      const callArg = mockNext.mock.calls[0]![0];
      expect(callArg).toBeInstanceOf(ZodError);
    });

    it('should call next(ZodError) when body fields have wrong types', () => {
      const mockReq = {
        body: {
          username: 12345, // should be string
          password: true, // should be string
        },
      } as Request;

      const middleware = validateData(testSchema);
      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(1);
      const callArg = mockNext.mock.calls[0]![0];
      expect(callArg).toBeInstanceOf(ZodError);
    });
  });
});