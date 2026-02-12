import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { Roles } from '../../src/enums/roles.enum';

// Mock dependencies before importing the service
jest.mock('../../src/services/database.service');
jest.mock('../../src/services/accounts.service');

import rolesService from '../../src/services/roles.service';
import { executeQuery, getConnection } from '../../src/services/database.service';
import accountsService from '../../src/services/accounts.service';

const mockedExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
const mockedGetConnection = getConnection as jest.MockedFunction<typeof getConnection>;
const mockedAccountsService = accountsService as jest.Mocked<typeof accountsService>;

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

describe('Roles Service', () => {
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = createMockConnection();
    mockedGetConnection.mockResolvedValue(mockConnection as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getRoles()', () => {
    it('should return all roles for an account', async () => {
      const mockRoles = [
        { class_id: 1, role: 'teacher', school_id: 1 },
        { class_id: 2, role: 'leader', school_id: 1 },
      ];
      mockedExecuteQuery.mockResolvedValue(mockRoles as any);

      const result = await rolesService.getRoles(42);

      expect(result).toEqual(mockRoles);
      expect(mockedExecuteQuery).toHaveBeenCalledWith(
        'select class_id, role, school_id from roles where account_id = ?',
        [42],
      );
    });

    it('should filter by classIds when provided', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await rolesService.getRoles(42, [1, 2, 3]);

      expect(mockedExecuteQuery).toHaveBeenCalledWith(
        'select class_id, role, school_id from roles where account_id = ? and class_id in (?, ?, ?)',
        [42, 1, 2, 3],
      );
    });

    it('should filter by schoolId when provided', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await rolesService.getRoles(42, undefined, 5);

      expect(mockedExecuteQuery).toHaveBeenCalledWith(
        'select class_id, role, school_id from roles where account_id = ? and school_id = ?',
        [42, 5],
      );
    });

    it('should filter by both classIds and schoolId when both provided', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await rolesService.getRoles(42, [1, 2], 5);

      expect(mockedExecuteQuery).toHaveBeenCalledWith(
        'select class_id, role, school_id from roles where account_id = ? and school_id = ? and class_id in (?, ?)',
        [42, 5, 1, 2],
      );
    });

    it('should return empty array when user has no roles', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      const result = await rolesService.getRoles(99);

      expect(result).toEqual([]);
    });

    it('should handle single classId in array', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await rolesService.getRoles(42, [7]);

      expect(mockedExecuteQuery).toHaveBeenCalledWith(
        'select class_id, role, school_id from roles where account_id = ? and class_id in (?)',
        [42, 7],
      );
    });
  });

  describe('getHighestRole()', () => {
    it('should return "manager" when user is a manager', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { class_id: 1, role: 'manager', school_id: 1 },
      ] as any);

      const result = await rolesService.getHighestRole(42);

      expect(result).toBe(Roles.manager);
    });

    it('should return "leader" when user is a leader but not manager', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { class_id: 1, role: 'leader', school_id: 1 },
      ] as any);

      const result = await rolesService.getHighestRole(42);

      expect(result).toBe(Roles.leader);
    });

    it('should return "teacher" when user is only a teacher', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { class_id: 1, role: 'teacher', school_id: 1 },
      ] as any);

      const result = await rolesService.getHighestRole(42);

      expect(result).toBe(Roles.teacher);
    });

    it('should return undefined when user has no roles', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      const result = await rolesService.getHighestRole(42);

      expect(result).toBeUndefined();
    });

    it('should return "manager" when user has both teacher and manager roles (priority)', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { class_id: 1, role: 'teacher', school_id: 1 },
        { class_id: 2, role: 'manager', school_id: 1 },
      ] as any);

      const result = await rolesService.getHighestRole(42);

      expect(result).toBe(Roles.manager);
    });

    it('should return "manager" when user has teacher, leader, and manager roles', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { class_id: 1, role: 'teacher', school_id: 1 },
        { class_id: 2, role: 'leader', school_id: 1 },
        { class_id: 3, role: 'manager', school_id: 2 },
      ] as any);

      const result = await rolesService.getHighestRole(42);

      expect(result).toBe(Roles.manager);
    });

    it('should return "leader" when user has both teacher and leader roles', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { class_id: 1, role: 'teacher', school_id: 1 },
        { class_id: 2, role: 'leader', school_id: 1 },
      ] as any);

      const result = await rolesService.getHighestRole(42);

      expect(result).toBe(Roles.leader);
    });

    it('should pass classId filter when provided', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { class_id: 5, role: 'teacher', school_id: 1 },
      ] as any);

      const result = await rolesService.getHighestRole(42, 5);

      expect(result).toBe(Roles.teacher);
      expect(mockedExecuteQuery).toHaveBeenCalledWith(
        'select class_id, role, school_id from roles where account_id = ? and class_id in (?)',
        [42, 5],
      );
    });

    it('should pass schoolId filter when provided', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { class_id: 1, role: 'leader', school_id: 3 },
      ] as any);

      const result = await rolesService.getHighestRole(42, undefined, 3);

      expect(result).toBe(Roles.leader);
      expect(mockedExecuteQuery).toHaveBeenCalledWith(
        'select class_id, role, school_id from roles where account_id = ? and school_id = ?',
        [42, 3],
      );
    });
  });

  describe('addRole()', () => {
    it('should insert a role with user ID (number) and link school_id from class', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }] as never);

      await rolesService.addRole(10, 5, Roles.teacher);

      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('insert into roles'),
        [10, 5, 'teacher', 5],
      );
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });

    it('should resolve username (string) to user ID first, then insert', async () => {
      mockedAccountsService.getAccountId.mockResolvedValue(77 as never);
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }] as never);

      await rolesService.addRole('tony', 5, Roles.leader);

      expect(mockedAccountsService.getAccountId).toHaveBeenCalledWith('tony', expect.anything());
      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('insert into roles'),
        [77, 5, 'leader', 5],
      );
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });

    it('should not call getAccountId when user is a number', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }] as never);

      await rolesService.addRole(10, 5, Roles.manager);

      expect(mockedAccountsService.getAccountId).not.toHaveBeenCalled();
    });

    it('should begin transaction before any operations', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }] as never);

      await rolesService.addRole(10, 5, Roles.teacher);

      const beginOrder = mockConnection.beginTransaction.mock.invocationCallOrder[0];
      const executeOrder = mockConnection.execute.mock.invocationCallOrder[0];
      expect(beginOrder).toBeLessThan(executeOrder!);
    });

    it('should rollback and rethrow on DB error during transaction', async () => {
      const dbError = new Error('Duplicate entry');
      mockConnection.execute.mockRejectedValue(dbError as never);

      await expect(
        rolesService.addRole(10, 5, Roles.teacher),
      ).rejects.toThrow('Duplicate entry');

      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    it('should release the connection after success', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }] as never);

      await rolesService.addRole(10, 5, Roles.teacher);

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should release the connection even after error', async () => {
      mockConnection.execute.mockRejectedValue(new Error('fail') as never);

      await expect(
        rolesService.addRole(10, 5, Roles.teacher),
      ).rejects.toThrow();

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should rollback when getAccountId throws for username', async () => {
      mockedAccountsService.getAccountId.mockRejectedValue(new Error('user not found') as never);

      await expect(
        rolesService.addRole('nonexistent', 5, Roles.teacher),
      ).rejects.toThrow('user not found');

      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).not.toHaveBeenCalled();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should pass the correct role enum value to the SQL query', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }] as never);

      await rolesService.addRole(10, 5, Roles.manager);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        expect.stringContaining('insert into roles'),
        [10, 5, 'manager', 5],
      );
    });

    it('should use the classId to look up school_id in the SQL (select school_id from classes)', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }] as never);

      await rolesService.addRole(10, 42, Roles.leader);

      const executeCalls = mockConnection.execute.mock.calls;
      const insertCall = executeCalls[0];
      // The SQL contains a subquery that selects school_id from classes where class_id = ?
      expect(insertCall![0]).toContain('school_id from classes where class_id');
      // The classId should appear twice: once for the role insert, once for the school lookup
      expect(insertCall![1]).toEqual([10, 42, 'leader', 42]);
    });
  });

  describe('deleteRole()', () => {
    it('should delete the role by roleId within a transaction', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }] as never);

      await rolesService.deleteRole(99);

      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.execute).toHaveBeenCalledWith(
        'delete from roles where role_id = ?',
        [99],
      );
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });

    it('should release the connection after deletion', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }] as never);

      await rolesService.deleteRole(99);

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should rollback and rethrow on DB error', async () => {
      const dbError = new Error('Foreign key constraint');
      mockConnection.execute.mockRejectedValue(dbError as never);

      await expect(
        rolesService.deleteRole(99),
      ).rejects.toThrow('Foreign key constraint');

      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    it('should release the connection even after error', async () => {
      mockConnection.execute.mockRejectedValue(new Error('fail') as never);

      await expect(
        rolesService.deleteRole(99),
      ).rejects.toThrow();

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should pass the correct roleId to the delete query', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }] as never);

      await rolesService.deleteRole(777);

      expect(mockConnection.execute).toHaveBeenCalledWith(
        'delete from roles where role_id = ?',
        [777],
      );
    });

    it('should begin transaction before executing delete', async () => {
      mockConnection.execute.mockResolvedValue([{ affectedRows: 1 }] as never);

      await rolesService.deleteRole(1);

      const beginOrder = mockConnection.beginTransaction.mock.invocationCallOrder[0];
      const executeOrder = mockConnection.execute.mock.invocationCallOrder[0];
      expect(beginOrder).toBeLessThan(executeOrder!);
    });
  });
});