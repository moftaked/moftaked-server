import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import bcrypt from 'bcrypt';
import {
  createTestDatabase,
  dropTestDatabase,
  truncateAllTables,
  seedTestData,
  SeedAccount,
  SeedSchool,
  SeedClass,
  SeedDistrict,
} from '../helpers/test-db';
import rolesService from '../../src/services/roles.service';
import { Roles } from '../../src/enums/roles.enum';
import { executeQuery } from '../../src/services/database.service';
import { RowDataPacket } from 'mysql2/promise';

describe('Roles Service — DB Integration', () => {
  let school1: SeedSchool;
  let school2: SeedSchool;
  let class1: SeedClass;
  let class2: SeedClass;
  let class3: SeedClass;
  let account1: SeedAccount;
  let account2: SeedAccount;
  let district: SeedDistrict;

  beforeAll(async () => {
    await createTestDatabase();
  });

  afterAll(async () => {
    await dropTestDatabase();
  });

  beforeEach(async () => {
    await truncateAllTables();

    // Seed common fixtures used by most tests
    school1 = { school_name: 'School Alpha' };
    school2 = { school_name: 'School Beta' };
    district = { district_name: 'Test District' };

    const hashedPassword = await bcrypt.hash('TestPass1', 10);
    account1 = { username: 'user_one', password: hashedPassword, real_name: 'User One' };
    account2 = { username: 'user_two', password: hashedPassword, real_name: 'User Two' };

    const seedResult = await seedTestData({
      schools: [school1, school2],
      districts: [district],
      accounts: [account1, account2],
    });

    class1 = { class_name: 'Class A', school_id: seedResult.schoolIds[0]! };
    class2 = { class_name: 'Class B', school_id: seedResult.schoolIds[0]! };
    class3 = { class_name: 'Class C', school_id: seedResult.schoolIds[1]! };

    await seedTestData({
      classes: [class1, class2, class3],
    });
  });

  describe('addRole()', () => {
    it('should insert a role with a numeric user ID and link school_id from the class', async () => {
      await rolesService.addRole(account1.account_id!, class1.class_id!, Roles.teacher);

      const roles = await executeQuery<RowDataPacket[]>(
        'SELECT account_id, class_id, role, school_id FROM roles WHERE account_id = ?',
        [account1.account_id!],
      );

      expect(roles).toHaveLength(1);
      expect(roles[0]).toMatchObject({
        account_id: account1.account_id!,
        class_id: class1.class_id!,
        role: 'teacher',
        school_id: school1.school_id!,
      });
    });

    it('should resolve a username string to an account_id before inserting the role', async () => {
      await rolesService.addRole('user_two', class2.class_id!, Roles.leader);

      const roles = await executeQuery<RowDataPacket[]>(
        'SELECT account_id, class_id, role, school_id FROM roles WHERE account_id = ?',
        [account2.account_id!],
      );

      expect(roles).toHaveLength(1);
      expect(roles[0]).toMatchObject({
        account_id: account2.account_id!,
        class_id: class2.class_id!,
        role: 'leader',
        school_id: school1.school_id!,
      });
    });

    it('should correctly derive school_id from the class when inserting a role', async () => {
      // class3 belongs to school2
      await rolesService.addRole(account1.account_id!, class3.class_id!, Roles.manager);

      const roles = await executeQuery<RowDataPacket[]>(
        'SELECT school_id FROM roles WHERE account_id = ? AND class_id = ?',
        [account1.account_id!, class3.class_id!],
      );

      expect(roles).toHaveLength(1);
      expect(roles[0]!['school_id']).toBe(school2.school_id!);
    });

    it('should allow adding multiple different roles for the same user in different classes', async () => {
      await rolesService.addRole(account1.account_id!, class1.class_id!, Roles.teacher);
      await rolesService.addRole(account1.account_id!, class2.class_id!, Roles.leader);
      await rolesService.addRole(account1.account_id!, class3.class_id!, Roles.manager);

      const roles = await executeQuery<RowDataPacket[]>(
        'SELECT role FROM roles WHERE account_id = ? ORDER BY role',
        [account1.account_id!],
      );

      expect(roles).toHaveLength(3);
      const roleNames = roles.map((r) => r['role']);
      expect(roleNames).toContain('teacher');
      expect(roleNames).toContain('leader');
      expect(roleNames).toContain('manager');
    });

    it('should throw when the username does not exist', async () => {
      await expect(
        rolesService.addRole('nonexistent_user', class1.class_id!, Roles.teacher),
      ).rejects.toThrow('user not found');

      // No role should have been inserted (transaction rolled back)
      const roles = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM roles',
        [],
      );
      expect(roles).toHaveLength(0);
    });

    it('should throw when the account_id does not exist (FK constraint)', async () => {
      // Account ID 99999 does not exist — the INSERT selects school_id from classes,
      // so the row will have a valid class_id but an invalid account_id.
      // However, the INSERT itself will be attempted with the non-existent account_id
      // and the FK constraint on account_id should reject it.
      await expect(
        rolesService.addRole(99999, class1.class_id!, Roles.teacher),
      ).rejects.toThrow();
    });
  });

  describe('getRoles()', () => {
    beforeEach(async () => {
      // Seed some roles for testing queries
      await seedTestData({
        roles: [
          { account_id: account1.account_id!, class_id: class1.class_id!, role: 'teacher', school_id: school1.school_id! },
          { account_id: account1.account_id!, class_id: class2.class_id!, role: 'leader', school_id: school1.school_id! },
          { account_id: account1.account_id!, class_id: class3.class_id!, role: 'manager', school_id: school2.school_id! },
          { account_id: account2.account_id!, class_id: class1.class_id!, role: 'teacher', school_id: school1.school_id! },
        ],
      });
    });

    it('should return all roles for an account', async () => {
      const roles = await rolesService.getRoles(account1.account_id!);

      expect(roles).toHaveLength(3);
      const roleValues = roles.map((r) => r['role']);
      expect(roleValues).toContain('teacher');
      expect(roleValues).toContain('leader');
      expect(roleValues).toContain('manager');
    });

    it('should return roles with class_id, role, and school_id columns', async () => {
      const roles = await rolesService.getRoles(account1.account_id!);

      for (const role of roles) {
        expect(role).toHaveProperty('class_id');
        expect(role).toHaveProperty('role');
        expect(role).toHaveProperty('school_id');
      }
    });

    it('should filter by classIds when provided', async () => {
      const roles = await rolesService.getRoles(account1.account_id!, [class1.class_id!]);

      expect(roles).toHaveLength(1);
      expect(roles[0]!['class_id']).toBe(class1.class_id!);
      expect(roles[0]!['role']).toBe('teacher');
    });

    it('should filter by multiple classIds', async () => {
      const roles = await rolesService.getRoles(account1.account_id!, [class1.class_id!, class2.class_id!]);

      expect(roles).toHaveLength(2);
      const classIds = roles.map((r) => r['class_id']);
      expect(classIds).toContain(class1.class_id!);
      expect(classIds).toContain(class2.class_id!);
    });

    it('should filter by schoolId when provided', async () => {
      const roles = await rolesService.getRoles(account1.account_id!, undefined, school2.school_id!);

      expect(roles).toHaveLength(1);
      expect(roles[0]!['school_id']).toBe(school2.school_id!);
      expect(roles[0]!['role']).toBe('manager');
    });

    it('should filter by both classIds and schoolId when both provided', async () => {
      // class1 is in school1 — filtering by school1 and class1 should return the teacher role
      const roles = await rolesService.getRoles(
        account1.account_id!,
        [class1.class_id!, class3.class_id!],
        school1.school_id!,
      );

      expect(roles).toHaveLength(1);
      expect(roles[0]!['class_id']).toBe(class1.class_id!);
      expect(roles[0]!['role']).toBe('teacher');
    });

    it('should return an empty array when the user has no roles', async () => {
      // Create a fresh account with no roles
      const seed = await seedTestData({
        accounts: [{ username: 'no_roles_user', password: await bcrypt.hash('Pass1', 10), real_name: 'No Roles' }],
      });

      const roles = await rolesService.getRoles(seed.accountIds[0]!);
      expect(roles).toEqual([]);
    });

    it('should return an empty array when classIds filter matches no roles', async () => {
      const roles = await rolesService.getRoles(account1.account_id!, [99999]);
      expect(roles).toEqual([]);
    });

    it('should return an empty array when schoolId filter matches no roles', async () => {
      const roles = await rolesService.getRoles(account1.account_id!, undefined, 99999);
      expect(roles).toEqual([]);
    });

    it('should only return roles for the specified account (not other accounts)', async () => {
      const roles = await rolesService.getRoles(account2.account_id!);

      expect(roles).toHaveLength(1);
      expect(roles[0]!['class_id']).toBe(class1.class_id!);
      expect(roles[0]!['role']).toBe('teacher');
    });
  });

  describe('getHighestRole()', () => {
    it('should return "manager" when user has a manager role', async () => {
      await seedTestData({
        roles: [
          { account_id: account1.account_id!, class_id: class1.class_id!, role: 'manager', school_id: school1.school_id! },
        ],
      });

      const result = await rolesService.getHighestRole(account1.account_id!);
      expect(result).toBe(Roles.manager);
    });

    it('should return "leader" when user is a leader but not a manager', async () => {
      await seedTestData({
        roles: [
          { account_id: account1.account_id!, class_id: class1.class_id!, role: 'leader', school_id: school1.school_id! },
        ],
      });

      const result = await rolesService.getHighestRole(account1.account_id!);
      expect(result).toBe(Roles.leader);
    });

    it('should return "teacher" when user is only a teacher', async () => {
      await seedTestData({
        roles: [
          { account_id: account1.account_id!, class_id: class1.class_id!, role: 'teacher', school_id: school1.school_id! },
        ],
      });

      const result = await rolesService.getHighestRole(account1.account_id!);
      expect(result).toBe(Roles.teacher);
    });

    it('should return undefined when user has no roles', async () => {
      const result = await rolesService.getHighestRole(account1.account_id!);
      expect(result).toBeUndefined();
    });

    it('should return "manager" when user has teacher, leader, AND manager roles (priority)', async () => {
      await seedTestData({
        roles: [
          { account_id: account1.account_id!, class_id: class1.class_id!, role: 'teacher', school_id: school1.school_id! },
          { account_id: account1.account_id!, class_id: class2.class_id!, role: 'leader', school_id: school1.school_id! },
          { account_id: account1.account_id!, class_id: class3.class_id!, role: 'manager', school_id: school2.school_id! },
        ],
      });

      const result = await rolesService.getHighestRole(account1.account_id!);
      expect(result).toBe(Roles.manager);
    });

    it('should return "leader" when user has both teacher and leader roles', async () => {
      await seedTestData({
        roles: [
          { account_id: account1.account_id!, class_id: class1.class_id!, role: 'teacher', school_id: school1.school_id! },
          { account_id: account1.account_id!, class_id: class2.class_id!, role: 'leader', school_id: school1.school_id! },
        ],
      });

      const result = await rolesService.getHighestRole(account1.account_id!);
      expect(result).toBe(Roles.leader);
    });

    it('should respect classId filter when provided', async () => {
      await seedTestData({
        roles: [
          { account_id: account1.account_id!, class_id: class1.class_id!, role: 'teacher', school_id: school1.school_id! },
          { account_id: account1.account_id!, class_id: class2.class_id!, role: 'manager', school_id: school1.school_id! },
        ],
      });

      // When filtered to class1 only, the highest role should be teacher
      const result = await rolesService.getHighestRole(account1.account_id!, class1.class_id!);
      expect(result).toBe(Roles.teacher);
    });

    it('should respect schoolId filter when provided', async () => {
      await seedTestData({
        roles: [
          { account_id: account1.account_id!, class_id: class1.class_id!, role: 'manager', school_id: school1.school_id! },
          { account_id: account1.account_id!, class_id: class3.class_id!, role: 'teacher', school_id: school2.school_id! },
        ],
      });

      // When filtered to school2, the highest role should be teacher
      const result = await rolesService.getHighestRole(account1.account_id!, undefined, school2.school_id!);
      expect(result).toBe(Roles.teacher);
    });
  });

  describe('deleteRole()', () => {
    it('should delete a role by its roleId', async () => {
      const seedResult = await seedTestData({
        roles: [
          { account_id: account1.account_id!, class_id: class1.class_id!, role: 'teacher', school_id: school1.school_id! },
        ],
      });

      const roleId = seedResult.roleIds[0]!;

      await rolesService.deleteRole(roleId);

      const roles = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM roles WHERE role_id = ?',
        [roleId],
      );
      expect(roles).toHaveLength(0);
    });

    it('should only delete the specified role (not other roles)', async () => {
      const seedResult = await seedTestData({
        roles: [
          { account_id: account1.account_id!, class_id: class1.class_id!, role: 'teacher', school_id: school1.school_id! },
          { account_id: account1.account_id!, class_id: class2.class_id!, role: 'leader', school_id: school1.school_id! },
          { account_id: account1.account_id!, class_id: class3.class_id!, role: 'manager', school_id: school2.school_id! },
        ],
      });

      // Delete the leader role
      await rolesService.deleteRole(seedResult.roleIds[1]!);

      const roles = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM roles WHERE account_id = ?',
        [account1.account_id!],
      );
      expect(roles).toHaveLength(2);
      const remainingRoles = roles.map((r) => r['role']);
      expect(remainingRoles).toContain('teacher');
      expect(remainingRoles).toContain('manager');
      expect(remainingRoles).not.toContain('leader');
    });

    it('should not throw when deleting a non-existent roleId (0 affected rows)', async () => {
      await expect(rolesService.deleteRole(99999)).resolves.not.toThrow();
    });

    it('should use a transaction (role is gone after commit)', async () => {
      const seedResult = await seedTestData({
        roles: [
          { account_id: account1.account_id!, class_id: class1.class_id!, role: 'teacher', school_id: school1.school_id! },
        ],
      });

      await rolesService.deleteRole(seedResult.roleIds[0]!);

      // Verify the role is truly gone
      const roles = await rolesService.getRoles(account1.account_id!);
      expect(roles).toHaveLength(0);
    });
  });

  describe('end-to-end: addRole → getRoles → getHighestRole → deleteRole', () => {
    it('should support the full lifecycle of a role', async () => {
      // 1. No roles initially
      let roles = await rolesService.getRoles(account1.account_id!);
      expect(roles).toHaveLength(0);
      expect(await rolesService.getHighestRole(account1.account_id!)).toBeUndefined();

      // 2. Add a teacher role
      await rolesService.addRole(account1.account_id!, class1.class_id!, Roles.teacher);
      roles = await rolesService.getRoles(account1.account_id!);
      expect(roles).toHaveLength(1);
      expect(await rolesService.getHighestRole(account1.account_id!)).toBe(Roles.teacher);

      // 3. Add a manager role
      await rolesService.addRole(account1.account_id!, class2.class_id!, Roles.manager);
      roles = await rolesService.getRoles(account1.account_id!);
      expect(roles).toHaveLength(2);
      expect(await rolesService.getHighestRole(account1.account_id!)).toBe(Roles.manager);

      // 4. Delete the manager role — getRoles doesn't return role_id,
      // so query it directly from the DB
      const managerRows = await executeQuery<RowDataPacket[]>(
        'SELECT role_id FROM roles WHERE account_id = ? AND role = ?',
        [account1.account_id!, 'manager'],
      );
      expect(managerRows).toHaveLength(1);
      await rolesService.deleteRole(managerRows[0]!['role_id'] as number);

      // 5. Highest role should now be teacher
      roles = await rolesService.getRoles(account1.account_id!);
      expect(roles).toHaveLength(1);
      expect(await rolesService.getHighestRole(account1.account_id!)).toBe(Roles.teacher);
    });

    it('should support adding a role by username and verifying it via getRoles', async () => {
      await rolesService.addRole('user_one', class3.class_id!, Roles.leader);

      const roles = await rolesService.getRoles(account1.account_id!);
      expect(roles).toHaveLength(1);
      expect(roles[0]).toMatchObject({
        class_id: class3.class_id!,
        role: 'leader',
        school_id: school2.school_id!,
      });
    });
  });
});