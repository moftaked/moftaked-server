import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before importing the service
jest.mock('../../src/services/database.service');
jest.mock('bcrypt');
jest.mock('generate-password');

import accountsService from '../../src/services/accounts.service';
import { getConnection } from '../../src/services/database.service';
import bcrypt from 'bcrypt';
import { generate } from 'generate-password';

const mockedGetConnection = getConnection as jest.MockedFunction<typeof getConnection>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedGenerate = generate as jest.MockedFunction<typeof generate>;

function createMockConnection() {
  const mockConnection = {
    beginTransaction: jest.fn().mockResolvedValue(undefined as never),
    commit: jest.fn().mockResolvedValue(undefined as never),
    rollback: jest.fn().mockResolvedValue(undefined as never),
    release: jest.fn(),
    query: jest.fn(),
    execute: jest.fn(),
  };
  return mockConnection;
}

describe('Accounts Service', () => {
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = createMockConnection();
    mockedGetConnection.mockResolvedValue(mockConnection as any);
    (mockedBcrypt.hash as jest.Mock).mockResolvedValue('$2b$10$hashed_password' as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createAccount()', () => {
    it('should hash the provided password and insert the account', async () => {
      mockConnection.query.mockResolvedValue([{ insertId: 42 }] as never);

      const result = await accountsService.createAccount('tony', 'Tony George', 'aA1bcdef');

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('aA1bcdef', 10);
      expect(mockConnection.query).toHaveBeenCalledWith(
        'insert into accounts(username, password, real_name) values (?, ?, ?);',
        ['tony', '$2b$10$hashed_password', 'Tony George'],
      );
      expect(result).toEqual({ userId: 42, password: 'aA1bcdef' });
    });

    it('should generate a random password when none is provided', async () => {
      mockedGenerate.mockReturnValue('GenPass1' as any);
      mockConnection.query.mockResolvedValue([{ insertId: 55 }] as never);

      const result = await accountsService.createAccount('john', 'John Doe');

      expect(mockedGenerate).toHaveBeenCalledWith({
        length: 12,
        numbers: true,
        uppercase: true,
        lowercase: true,
        symbols: '!@#$%^&*(),.?":{}|<>',
        strict: true,
      });
      expect(mockedBcrypt.hash).toHaveBeenCalledWith('GenPass1', 10);
      expect(result).toEqual({ userId: 55, password: 'GenPass1' });
    });

    it('should return the userId from the insert result and the cleartext password', async () => {
      mockConnection.query.mockResolvedValue([{ insertId: 100 }] as never);

      const result = await accountsService.createAccount('admin', 'Admin User', 'Passw0rd');

      expect(result.userId).toBe(100);
      expect(result.password).toBe('Passw0rd');
    });

    it('should begin a transaction before inserting', async () => {
      mockConnection.query.mockResolvedValue([{ insertId: 1 }] as never);

      await accountsService.createAccount('test', 'Test', 'aA1bcdef');

      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      // beginTransaction should be called before query
      const beginOrder = mockConnection.beginTransaction.mock.invocationCallOrder[0];
      const queryOrder = mockConnection.query.mock.invocationCallOrder[0];
      expect(beginOrder).toBeLessThan(queryOrder!);
    });

    it('should commit the transaction on success', async () => {
      mockConnection.query.mockResolvedValue([{ insertId: 1 }] as never);

      await accountsService.createAccount('test', 'Test', 'aA1bcdef');

      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });

    it('should rollback and rethrow on DB error', async () => {
      const dbError = new Error('Duplicate entry');
      mockConnection.query.mockRejectedValue(dbError as never);

      await expect(
        accountsService.createAccount('duplicate', 'Dup User', 'aA1bcdef'),
      ).rejects.toThrow('Duplicate entry');

      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    it('should release the connection after successful creation', async () => {
      mockConnection.query.mockResolvedValue([{ insertId: 1 }] as never);

      await accountsService.createAccount('test', 'Test', 'aA1bcdef');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should release the connection even after an error', async () => {
      mockConnection.query.mockRejectedValue(new Error('fail') as never);

      await expect(
        accountsService.createAccount('test', 'Test', 'aA1bcdef'),
      ).rejects.toThrow();

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should hash with bcrypt salt rounds of 10', async () => {
      mockConnection.query.mockResolvedValue([{ insertId: 1 }] as never);

      await accountsService.createAccount('test', 'Test', 'MyPass1x');

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('MyPass1x', 10);
    });

    it('should not call generate-password when password is provided', async () => {
      mockConnection.query.mockResolvedValue([{ insertId: 1 }] as never);

      await accountsService.createAccount('test', 'Test', 'Explicit1');

      expect(mockedGenerate).not.toHaveBeenCalled();
    });
  });

  describe('getAccountId()', () => {
    it('should return account_id for an existing user', async () => {
      mockConnection.execute.mockResolvedValue([
        [{ account_id: 77, length: 1 }],
      ] as never);

      // getAccountId calls getConnection internally when no connection is passed
      const result = await accountsService.getAccountId('tony');

      expect(result).toBe(77);
    });

    it('should query with the correct username', async () => {
      mockConnection.execute.mockResolvedValue([
        [{ account_id: 1, length: 1 }],
      ] as never);

      await accountsService.getAccountId('george');

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'select account_id from accounts where username = ?',
        ['george'],
      );
    });

    it('should throw when user is not found (empty results)', async () => {
      // rows.length !== 1 triggers error. Empty array means length is 0.
      const emptyRows: any[] = [];
      Object.defineProperty(emptyRows, 'length', { value: 0 });
      mockConnection.execute.mockResolvedValue([emptyRows] as never);

      await expect(
        accountsService.getAccountId('nonexistent'),
      ).rejects.toThrow('user not found');
    });

    it('should use the provided connection when given one', async () => {
      const externalConnection = createMockConnection();
      externalConnection.execute.mockResolvedValue([
        [{ account_id: 99, length: 1 }],
      ] as never);

      const result = await accountsService.getAccountId('tony', externalConnection as any);

      // Should NOT call getConnection since an external connection was provided
      // The execute should be called on the external connection
      expect(externalConnection.execute).toHaveBeenCalledWith(
        'select account_id from accounts where username = ?',
        ['tony'],
      );
      expect(result).toBe(99);
    });

    it('should call getConnection when no connection is provided', async () => {
      mockConnection.execute.mockResolvedValue([
        [{ account_id: 1, length: 1 }],
      ] as never);

      await accountsService.getAccountId('tony');

      expect(mockedGetConnection).toHaveBeenCalledTimes(1);
    });
  });
});