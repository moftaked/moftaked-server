import { expect, jest, describe, it, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { signIn } from '../../src/controllers/auth.controller';
import authService from '../../src/services/auth.service';
import { Err, Ok } from 'result2';
import { StatusCodes } from 'http-status-codes';

jest.mock('../../src/services/auth.service');

let mockedAuthService = authService as jest.Mocked<typeof authService>;

afterEach(() => {
  jest.clearAllMocks();
});

describe('Auth Controller', () => {
  describe('signIn', () => {
    it('should call signIn with the correct parameters', async () => {
      const req = {
        body: {
          username: 'testuser',
          password: 'testpass',
        },
      } as any as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as any as Response;
      mockedAuthService.signIn.mockResolvedValue(Ok({
        access_token: 'mock_token',
        user_id: 123,
        roles: '["user"]',
      }));
      const next = jest.fn();
      await signIn(req, res, next);

      expect(authService.signIn).toHaveBeenCalledWith('testuser', 'testpass');
    });

    it('should catch errors thrown from service', async () => {
      mockedAuthService.signIn.mockResolvedValue(Err(StatusCodes.UNAUTHORIZED));
      const req = {
        body: {
          username: 'testuser',
          password: 'testpass',
        },
      } as any as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
        json: jest.fn(),
      } as any as Response;

      const next = jest.fn();
      await signIn(req, res, next);
      expect(next).toHaveBeenCalledWith(StatusCodes.UNAUTHORIZED);
      expect(res.status).not.toHaveBeenCalled();
      expect(mockedAuthService.signIn).toHaveBeenCalledWith('testuser', 'testpass');
    });
  });
});