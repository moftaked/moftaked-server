import { expect, jest, describe, it, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { signIn } from '../../src/controllers/auth.controller';
import authService from '../../src/services/auth.service';

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

      const next = jest.fn();
      await signIn(req, res, next);

      expect(authService.signIn).toHaveBeenCalledWith('testuser', 'testpass');
    });

    it('should catch errors thrown from service', async () => {
      mockedAuthService.signIn.mockRejectedValue(new Error('Sign in failed'));
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

      const next = jest.fn();
      await signIn(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      expect(res.status).not.toHaveBeenCalled();
      expect(mockedAuthService.signIn).toHaveBeenCalledWith('testuser', 'testpass');
    });
  });
});