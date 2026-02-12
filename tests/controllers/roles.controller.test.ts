import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

jest.mock('../../src/services/roles.service');

import { addRole, getRoles } from '../../src/controllers/roles.controller';
import rolesService from '../../src/services/roles.service';
import { Roles } from '../../src/enums/roles.enum';

const mockedRolesService = rolesService as jest.Mocked<typeof rolesService>;

function createMockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
}

describe('Roles Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── addRole ────────────────────────────────────────────────────────────

  describe('addRole()', () => {
    it('should call rolesService.addRole with correct params from body', async () => {
      const mockResult = { insertId: 42 };
      mockedRolesService.addRole.mockResolvedValueOnce(mockResult as any);

      const req = {
        body: {
          user: 'testuser',
          classId: 10,
          role: 'teacher',
        },
      } as any;
      const res = createMockRes();

      await addRole(req, res);

      expect(mockedRolesService.addRole).toHaveBeenCalledWith('testuser', 10, Roles.teacher);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should call rolesService.addRole with numeric user ID', async () => {
      const mockResult = { insertId: 43 };
      mockedRolesService.addRole.mockResolvedValueOnce(mockResult as any);

      const req = {
        body: {
          user: 100,
          classId: 20,
          role: 'leader',
        },
      } as any;
      const res = createMockRes();

      await addRole(req, res);

      expect(mockedRolesService.addRole).toHaveBeenCalledWith(100, 20, Roles.leader);
      expect(res.json).toHaveBeenCalledWith(mockResult);
    });

    it('should return the service result as JSON', async () => {
      const mockResult = { affectedRows: 1 };
      mockedRolesService.addRole.mockResolvedValueOnce(mockResult as any);

      const req = {
        body: {
          user: 'admin',
          classId: 5,
          role: 'manager',
        },
      } as any;
      const res = createMockRes();

      await addRole(req, res);

      expect(res.json).toHaveBeenCalledWith(mockResult);
    });
  });

  // ─── getRoles ───────────────────────────────────────────────────────────

  describe('getRoles()', () => {
    it('should call rolesService.getRoles with parsed userId and return result', async () => {
      const mockRoles = [
        { role_id: 1, role: 'teacher', class_id: 10 },
        { role_id: 2, role: 'leader', class_id: 20 },
      ];
      mockedRolesService.getRoles.mockResolvedValueOnce(mockRoles as any);

      const req = {
        params: { userId: '100' },
      } as any;
      const res = createMockRes();

      await getRoles(req, res);

      expect(mockedRolesService.getRoles).toHaveBeenCalledWith(100);
      expect(res.json).toHaveBeenCalledWith(mockRoles);
    });

    it('should return 400 when userId is not a valid number (NaN)', async () => {
      const req = {
        params: { userId: 'abc' },
      } as any;
      const res = createMockRes();

      await getRoles(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid user ID' });
      expect(mockedRolesService.getRoles).not.toHaveBeenCalled();
    });

    it('should return 400 when userId is undefined', async () => {
      const req = {
        params: {},
      } as any;
      const res = createMockRes();

      await getRoles(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Invalid user ID' });
    });

    it('should handle userId of 0 as valid (not NaN)', async () => {
      mockedRolesService.getRoles.mockResolvedValueOnce([] as any);

      const req = {
        params: { userId: '0' },
      } as any;
      const res = createMockRes();

      await getRoles(req, res);

      expect(mockedRolesService.getRoles).toHaveBeenCalledWith(0);
      expect(res.json).toHaveBeenCalledWith([]);
    });

    it('should not call res.status when userId is valid', async () => {
      mockedRolesService.getRoles.mockResolvedValueOnce([] as any);

      const req = {
        params: { userId: '42' },
      } as any;
      const res = createMockRes();

      await getRoles(req, res);

      expect(res.status).not.toHaveBeenCalled();
    });
  });
});