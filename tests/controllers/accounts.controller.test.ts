import { createAccount } from '../../src/controllers/accounts.controller';
import { expect, jest, describe, it, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import accountsService from '../../src/services/accounts.service';

jest.mock('../../src/services/accounts.service');

let mockedAccountService = accountsService as jest.Mocked<typeof accountsService>;

afterEach(() => {
  jest.clearAllMocks();
});

describe('Accounts Controller', () => {
  describe('createAccount', () => {
    it('should call createAccount with the correct parameters', async () => {
      const req = {
        body: {
          username: 'tony',
          password: 'password123',
          real_name: 'Tony Stark',
        },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
        get: jest.fn().mockReturnValue('test-agent'),
        res: {
          locals: { user: { sub: 1 } },
        },
      } as any as Request;
      const res = {
        json: jest.fn(),
      } as any as Response;

      await createAccount(req, res);

      expect(mockedAccountService.createAccount)
      .toHaveBeenCalledWith('tony', 'Tony Stark', 'password123');
    });
  });
});