import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { handleError } from '../../src/middleware/errors.middleware';
import { StatusCodes } from 'http-status-codes';
import { ZodError } from 'zod/v4';
import { JsonWebTokenError } from 'jsonwebtoken';
import { Err } from 'result2';
import createHttpError from 'http-errors';

describe('Errors Middleware', () => {
  let mockReq: Request;
  let mockRes: Response;
  let mockNext: NextFunction;
  let statusFn: jest.Mock;
  let jsonFn: jest.Mock;
  let endFn: jest.Mock;

  beforeEach(() => {
    mockReq = {} as Request;
    jsonFn = jest.fn();
    endFn = jest.fn();
    statusFn = jest.fn().mockReturnValue({ json: jsonFn, end: endFn });
    mockRes = {
      status: statusFn,
      json: jsonFn,
      end: endFn,
    } as any as Response;
    mockNext = jest.fn();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('handleError', () => {
    // --- number errors ---

    it('should respond with status(number).end() when error is a number', () => {
      handleError(StatusCodes.NOT_FOUND as any, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(endFn).toHaveBeenCalled();
      expect(jsonFn).not.toHaveBeenCalled();
    });

    it('should respond with 401 when error is 401 number', () => {
      handleError(StatusCodes.UNAUTHORIZED as any, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
      expect(endFn).toHaveBeenCalled();
    });

    it('should respond with 403 when error is 403 number', () => {
      handleError(StatusCodes.FORBIDDEN as any, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
      expect(endFn).toHaveBeenCalled();
    });

    it('should respond with 500 when error is 500 number', () => {
      handleError(StatusCodes.INTERNAL_SERVER_ERROR as any, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(endFn).toHaveBeenCalled();
    });

    // --- HttpError errors ---

    it('should respond with status and message JSON when error is HttpError', () => {
      const httpError = createHttpError(StatusCodes.BAD_REQUEST, 'Invalid input');

      handleError(httpError, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(jsonFn).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid input',
      });
    });

    it('should handle HttpError with 403 status', () => {
      const httpError = createHttpError(StatusCodes.FORBIDDEN, 'Access denied');

      handleError(httpError, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
      expect(jsonFn).toHaveBeenCalledWith({
        success: false,
        message: 'Access denied',
      });
    });

    it('should handle HttpError with 404 status', () => {
      const httpError = createHttpError(StatusCodes.NOT_FOUND, 'Not found');

      handleError(httpError, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(jsonFn).toHaveBeenCalledWith({
        success: false,
        message: 'Not found',
      });
    });

    it('should handle HttpError with 500 status and custom message', () => {
      const httpError = createHttpError(StatusCodes.INTERNAL_SERVER_ERROR, 'Something went wrong');

      handleError(httpError, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(jsonFn).toHaveBeenCalledWith({
        success: false,
        message: 'Something went wrong',
      });
    });

    // --- ZodError errors ---

    it('should respond with 400 and issues details when error is ZodError', () => {
      const zodError = new ZodError([
        {
          code: 'too_small',
          minimum: 4,
          type: 'string',
          inclusive: true,
          message: 'String must contain at least 4 character(s)',
          path: ['username'],
        } as any,
      ]);

      handleError(zodError as any, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(jsonFn).toHaveBeenCalledWith({
        details: zodError.issues,
      });
    });

    it('should include all issues in ZodError response', () => {
      const zodError = new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['username'],
          message: 'Expected string, received number',
        } as any,
        {
          code: 'too_small',
          minimum: 8,
          type: 'string',
          inclusive: true,
          message: 'String must contain at least 8 character(s)',
          path: ['password'],
        } as any,
      ]);

      handleError(zodError as any, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.BAD_REQUEST);
      expect(jsonFn).toHaveBeenCalledWith({
        details: zodError.issues,
      });
      const callArg = jsonFn.mock.calls[0]![0] as any;
      expect(callArg.details).toHaveLength(2);
    });

    // --- JsonWebTokenError errors ---

    it('should respond with 401 when error is JsonWebTokenError', () => {
      const jwtError = new JsonWebTokenError('invalid token');

      handleError(jwtError, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
      expect(endFn).toHaveBeenCalled();
      expect(jsonFn).not.toHaveBeenCalled();
    });

    it('should respond with 401 when error is JsonWebTokenError with "jwt malformed" message', () => {
      const jwtError = new JsonWebTokenError('jwt malformed');

      handleError(jwtError, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
      expect(endFn).toHaveBeenCalled();
    });

    // --- Result (Err) errors ---

    it('should respond with the error status from Result Err', () => {
      const resultErr = Err(StatusCodes.NOT_FOUND);

      handleError(resultErr as any, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.NOT_FOUND);
      expect(endFn).toHaveBeenCalled();
      expect(jsonFn).not.toHaveBeenCalled();
    });

    it('should respond with 401 from Result Err', () => {
      const resultErr = Err(StatusCodes.UNAUTHORIZED);

      handleError(resultErr as any, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
      expect(endFn).toHaveBeenCalled();
    });

    it('should respond with 403 from Result Err', () => {
      const resultErr = Err(StatusCodes.FORBIDDEN);

      handleError(resultErr as any, mockReq, mockRes, mockNext);

      expect(statusFn).toHaveBeenCalledWith(StatusCodes.FORBIDDEN);
      expect(endFn).toHaveBeenCalled();
    });

    // --- Generic Error ---

    it('should respond with 500 and call console.error for generic Error', () => {
      const genericError = new Error('Something unexpected happened');

      handleError(genericError, mockReq, mockRes, mockNext);

      expect(console.error).toHaveBeenCalledWith(genericError);
      expect(statusFn).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(endFn).toHaveBeenCalled();
      expect(jsonFn).not.toHaveBeenCalled();
    });

    it('should respond with 500 for Error subclass that is not a known type', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }
      const customError = new CustomError('Custom failure');

      handleError(customError, mockReq, mockRes, mockNext);

      expect(console.error).toHaveBeenCalledWith(customError);
      expect(statusFn).toHaveBeenCalledWith(StatusCodes.INTERNAL_SERVER_ERROR);
      expect(endFn).toHaveBeenCalled();
    });

    it('should log the error to console.error for generic errors', () => {
      const error = new Error('DB connection lost');

      handleError(error, mockReq, mockRes, mockNext);

      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(error);
    });

    // --- Edge cases ---

    it('should not call next() — error middleware is the terminal handler', () => {
      handleError(new Error('test'), mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not call next() for number errors', () => {
      handleError(404 as any, mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not call next() for HttpError', () => {
      handleError(createHttpError(400, 'bad'), mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not call next() for ZodError', () => {
      const zodError = new ZodError([]);
      handleError(zodError as any, mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not call next() for JsonWebTokenError', () => {
      handleError(new JsonWebTokenError('bad'), mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not call next() for Result Err', () => {
      handleError(Err(500) as any, mockReq, mockRes, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should not call console.error for non-generic errors (number)', () => {
      handleError(404 as any, mockReq, mockRes, mockNext);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should not call console.error for HttpError', () => {
      handleError(createHttpError(400, 'test'), mockReq, mockRes, mockNext);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should not call console.error for ZodError', () => {
      const zodError = new ZodError([]);
      handleError(zodError as any, mockReq, mockRes, mockNext);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should not call console.error for JsonWebTokenError', () => {
      handleError(new JsonWebTokenError('bad'), mockReq, mockRes, mockNext);
      expect(console.error).not.toHaveBeenCalled();
    });

    it('should not call console.error for Result Err', () => {
      handleError(Err(401) as any, mockReq, mockRes, mockNext);
      expect(console.error).not.toHaveBeenCalled();
    });
  });
});