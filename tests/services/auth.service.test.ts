import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { StatusCodes } from 'http-status-codes';
import { Roles } from '../../src/enums/roles.enum';

// Mock dependencies before importing the service
jest.mock('../../src/services/database.service');
jest.mock('../../src/services/roles.service');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

import fs from 'fs';

import authService from '../../src/services/auth.service';
import { executeQuery } from '../../src/services/database.service';
import rolesService from '../../src/services/roles.service';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const mockedExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
const mockedRolesService = rolesService as jest.Mocked<typeof rolesService>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Prevent default key file loading in tests
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
    // Initialize the service with a test secret
    authService.init('test-jwt-secret');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('init()', () => {
    it('should set the JWT secret so verify/sign can use it', () => {
      // After init, verify should attempt to use jwt.verify with the secret
      (mockedJwt.verify as jest.Mock).mockReturnValue({ payload: { sub: 1, username: 'test' } });

      // If init didn't set the secret, this would fail or use undefined
      const result = authService.verify('some-token');
      expect(mockedJwt.verify).toHaveBeenCalledWith('some-token', 'test-jwt-secret', {
        algorithms: ['HS256'],
      });
      expect(result).toEqual({ payload: { sub: 1, username: 'test' } });
    });

    it('should allow changing the secret by calling init again', () => {
      authService.init('new-secret');
      (mockedJwt.verify as jest.Mock).mockReturnValue({ payload: { sub: 1 } });

      authService.verify('token');
      expect(mockedJwt.verify).toHaveBeenCalledWith('token', 'new-secret', {
        algorithms: ['HS256'],
      });
    });
  });

  describe('signIn()', () => {
    const mockUser = {
      account_id: 123,
      username: 'testuser',
      password: '$2b$10$hashedpassword',
      real_name: 'Test User',
      constructor: { name: 'RowDataPacket' },
    };

    it('should return Ok with access_token, user_id, and roles on valid credentials', async () => {
      mockedExecuteQuery.mockResolvedValue([mockUser] as any);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true as never);
      mockedRolesService.getRoles.mockResolvedValue([
        { class_id: 1, role: 'teacher', school_id: 1 },
      ] as any);
      (mockedJwt.sign as jest.Mock).mockReturnValue('mock-jwt-token');

      const result = await authService.signIn('testuser', 'correctpassword');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.unwrap()).toEqual({
          access_token: 'mock-jwt-token',
          user_id: 123,
          roles: JSON.stringify([{ class_id: 1, role: 'teacher', school_id: 1 }]),
        });
      }
    });

    it('should query the database with the correct username', async () => {
      mockedExecuteQuery.mockResolvedValue([mockUser] as any);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true as never);
      mockedRolesService.getRoles.mockResolvedValue([] as any);
      (mockedJwt.sign as jest.Mock).mockReturnValue('token');

      await authService.signIn('testuser', 'password123');

      expect(mockedExecuteQuery).toHaveBeenCalledWith(
        'select account_id, username, password, real_name from accounts where username = ?',
        ['testuser'],
      );
    });

    it('should return Err(401) when user is not found', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      const result = await authService.signIn('nonexistent', 'password');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.err()).toBe(StatusCodes.UNAUTHORIZED);
      }
    });

    it('should return Err(401) when password is wrong', async () => {
      mockedExecuteQuery.mockResolvedValue([mockUser] as any);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false as never);

      const result = await authService.signIn('testuser', 'wrongpassword');

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.err()).toBe(StatusCodes.UNAUTHORIZED);
      }
    });

    it('should compare the provided password against the stored hash', async () => {
      mockedExecuteQuery.mockResolvedValue([mockUser] as any);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true as never);
      mockedRolesService.getRoles.mockResolvedValue([] as any);
      (mockedJwt.sign as jest.Mock).mockReturnValue('token');

      await authService.signIn('testuser', 'mypassword');

      expect(mockedBcrypt.compare).toHaveBeenCalledWith('mypassword', '$2b$10$hashedpassword');
    });

    it('should fetch roles using the user account_id', async () => {
      mockedExecuteQuery.mockResolvedValue([mockUser] as any);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true as never);
      mockedRolesService.getRoles.mockResolvedValue([] as any);
      (mockedJwt.sign as jest.Mock).mockReturnValue('token');

      await authService.signIn('testuser', 'password');

      expect(mockedRolesService.getRoles).toHaveBeenCalledWith(123);
    });

    it('should generate a JWT with the correct payload structure', async () => {
      mockedExecuteQuery.mockResolvedValue([mockUser] as any);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true as never);
      mockedRolesService.getRoles.mockResolvedValue([] as any);
      (mockedJwt.sign as jest.Mock).mockReturnValue('generated-token');

      await authService.signIn('testuser', 'password');

      expect(mockedJwt.sign).toHaveBeenCalledWith(
        { payload: { sub: 123, username: 'testuser' } },
        'test-jwt-secret',
        { expiresIn: '1Days', algorithm: 'HS256' },
      );
    });

    it('should not call bcrypt.compare if user is not found', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await authService.signIn('nonexistent', 'password');

      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('should not fetch roles if password is wrong', async () => {
      mockedExecuteQuery.mockResolvedValue([mockUser] as any);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false as never);

      await authService.signIn('testuser', 'wrongpassword');

      expect(mockedRolesService.getRoles).not.toHaveBeenCalled();
    });

    it('should stringify roles array in the result', async () => {
      const roles = [
        { class_id: 1, role: 'teacher', school_id: 1 },
        { class_id: 2, role: 'manager', school_id: 1 },
      ];
      mockedExecuteQuery.mockResolvedValue([mockUser] as any);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true as never);
      mockedRolesService.getRoles.mockResolvedValue(roles as any);
      (mockedJwt.sign as jest.Mock).mockReturnValue('token');

      const result = await authService.signIn('testuser', 'password');

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.unwrap().roles).toBe(JSON.stringify(roles));
      }
    });
  });

  describe('verify()', () => {
    it('should return decoded payload for a valid token', () => {
      const decoded = { payload: { sub: 1, username: 'tony' }, iat: 1234567890, exp: 1234654290 };
      (mockedJwt.verify as jest.Mock).mockReturnValue(decoded);

      const result = authService.verify('valid-token');

      expect(result).toEqual(decoded);
      expect(mockedJwt.verify).toHaveBeenCalledWith('valid-token', 'test-jwt-secret', {
        algorithms: ['HS256'],
      });
    });

    it('should throw JsonWebTokenError for an invalid/tampered token', () => {
      const { JsonWebTokenError } = require('jsonwebtoken');
      (mockedJwt.verify as jest.Mock).mockImplementation(() => {
        throw new JsonWebTokenError('invalid signature');
      });

      expect(() => authService.verify('tampered-token')).toThrow();
    });

    it('should throw TokenExpiredError for an expired token', () => {
      const { TokenExpiredError } = require('jsonwebtoken');
      (mockedJwt.verify as jest.Mock).mockImplementation(() => {
        throw new TokenExpiredError('jwt expired', new Date());
      });

      expect(() => authService.verify('expired-token')).toThrow();
    });

    it('should use HS256 algorithm for verification', () => {
      (mockedJwt.verify as jest.Mock).mockReturnValue({ payload: { sub: 1 } });

      authService.verify('some-token');

      const callArgs = (mockedJwt.verify as jest.Mock).mock.calls[0];
      expect(callArgs![2]).toEqual({ algorithms: ['HS256'] });
    });
  });

  describe('isInAnyClass()', () => {
    it('should return true when user has matching role in one of the classIds', async () => {
      mockedRolesService.getRoles.mockResolvedValue([
        { class_id: 5, role: 'teacher', school_id: 1 },
        { class_id: 10, role: 'leader', school_id: 2 },
      ] as any);

      const result = await authService.isInAnyClass(1, [5, 10], [Roles.teacher]);

      expect(result).toBe(true);
    });

    it('should return false when user has no matching role in any classId', async () => {
      mockedRolesService.getRoles.mockResolvedValue([
        { class_id: 5, role: 'teacher', school_id: 1 },
      ] as any);

      const result = await authService.isInAnyClass(1, [5], [Roles.manager]);

      expect(result).toBe(false);
    });

    it('should return false when user has matching role but in different class', async () => {
      mockedRolesService.getRoles.mockResolvedValue([
        { class_id: 99, role: 'teacher', school_id: 1 },
      ] as any);

      const result = await authService.isInAnyClass(1, [5], [Roles.teacher]);

      expect(result).toBe(false);
    });

    it('should return false when user has no roles at all', async () => {
      mockedRolesService.getRoles.mockResolvedValue([] as any);

      const result = await authService.isInAnyClass(1, [5], [Roles.teacher]);

      expect(result).toBe(false);
    });

    it('should pass userId and classIds to getRoles', async () => {
      mockedRolesService.getRoles.mockResolvedValue([] as any);

      await authService.isInAnyClass(42, [1, 2, 3], [Roles.teacher]);

      expect(mockedRolesService.getRoles).toHaveBeenCalledWith(42, [1, 2, 3]);
    });

    it('should return true when user has role "teacher" and "teacher" is required (teacher when leader required → false)', async () => {
      mockedRolesService.getRoles.mockResolvedValue([
        { class_id: 5, role: 'teacher', school_id: 1 },
      ] as any);

      // Teacher role is required, user has teacher role — should be true
      const result1 = await authService.isInAnyClass(1, [5], [Roles.teacher]);
      expect(result1).toBe(true);

      // Leader role is required, user has teacher role — should be false
      const result2 = await authService.isInAnyClass(1, [5], [Roles.leader]);
      expect(result2).toBe(false);
    });

    it('should return true when multiple authorized roles include user\'s role', async () => {
      mockedRolesService.getRoles.mockResolvedValue([
        { class_id: 5, role: 'leader', school_id: 1 },
      ] as any);

      const result = await authService.isInAnyClass(1, [5], [Roles.teacher, Roles.leader, Roles.manager]);

      expect(result).toBe(true);
    });

    it('should check across multiple classes', async () => {
      mockedRolesService.getRoles.mockResolvedValue([
        { class_id: 1, role: 'teacher', school_id: 1 },
        { class_id: 2, role: 'manager', school_id: 1 },
      ] as any);

      // User has manager in class 2, and we're checking classes [1, 2] for manager
      const result = await authService.isInAnyClass(1, [1, 2], [Roles.manager]);

      expect(result).toBe(true);
    });

    it('should return false when classIds is empty', async () => {
      mockedRolesService.getRoles.mockResolvedValue([] as any);

      const result = await authService.isInAnyClass(1, [], [Roles.teacher]);

      expect(result).toBe(false);
    });
  });

  describe('hasRole()', () => {
    it('should return true when user has at least one required role', async () => {
      mockedRolesService.getRoles.mockResolvedValue([
        { class_id: 1, role: 'teacher', school_id: 1 },
        { class_id: 2, role: 'manager', school_id: 1 },
      ] as any);

      const result = await authService.hasRole(1, [Roles.manager]);

      expect(result).toBe(true);
    });

    it('should return false when user has no matching roles', async () => {
      mockedRolesService.getRoles.mockResolvedValue([
        { class_id: 1, role: 'teacher', school_id: 1 },
      ] as any);

      const result = await authService.hasRole(1, [Roles.manager]);

      expect(result).toBe(false);
    });

    it('should return false when user has no roles at all', async () => {
      mockedRolesService.getRoles.mockResolvedValue([] as any);

      const result = await authService.hasRole(1, [Roles.teacher]);

      expect(result).toBe(false);
    });

    it('should call getRoles with the user ID (no classIds filter)', async () => {
      mockedRolesService.getRoles.mockResolvedValue([] as any);

      await authService.hasRole(42, [Roles.teacher]);

      expect(mockedRolesService.getRoles).toHaveBeenCalledWith(42);
    });

    it('should return true when checking multiple required roles and user has one', async () => {
      mockedRolesService.getRoles.mockResolvedValue([
        { class_id: 1, role: 'leader', school_id: 1 },
      ] as any);

      const result = await authService.hasRole(1, [Roles.leader, Roles.manager]);

      expect(result).toBe(true);
    });

    it('should return true when user has multiple roles and one matches', async () => {
      mockedRolesService.getRoles.mockResolvedValue([
        { class_id: 1, role: 'teacher', school_id: 1 },
        { class_id: 2, role: 'leader', school_id: 1 },
        { class_id: 3, role: 'manager', school_id: 2 },
      ] as any);

      const result = await authService.hasRole(1, [Roles.manager]);

      expect(result).toBe(true);
    });
  });
});