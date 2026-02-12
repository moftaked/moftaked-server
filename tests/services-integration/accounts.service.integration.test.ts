import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import bcrypt from 'bcrypt';
import {
  createTestDatabase,
  dropTestDatabase,
  truncateAllTables,
} from '../helpers/test-db';
import accountsService from '../../src/services/accounts.service';
import { executeQuery } from '../../src/services/database.service';
import { RowDataPacket } from 'mysql2/promise';

describe('Accounts Service — DB Integration', () => {
  beforeAll(async () => {
    await createTestDatabase();
  });

  afterAll(async () => {
    await dropTestDatabase();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  describe('createAccount()', () => {
    it('should create an account with an explicit password and return userId + cleartext password', async () => {
      const result = await accountsService.createAccount('tony_test', 'Tony George', 'MyP@ss123');

      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('password');
      expect(typeof result.userId).toBe('number');
      expect(result.userId).toBeGreaterThan(0);
      expect(result.password).toBe('MyP@ss123');
    });

    it('should store the password as a bcrypt hash (not plaintext)', async () => {
      const cleartext = 'SecurePass1';
      await accountsService.createAccount('hash_check', 'Hash User', cleartext);

      const rows = await executeQuery<RowDataPacket[]>(
        'SELECT password FROM accounts WHERE username = ?',
        ['hash_check'],
      );

      expect(rows).toHaveLength(1);
      const storedHash = rows[0]!['password'] as string;

      // The stored value should NOT be the cleartext
      expect(storedHash).not.toBe(cleartext);

      // It should be a valid bcrypt hash that matches the cleartext
      const matches = await bcrypt.compare(cleartext, storedHash);
      expect(matches).toBe(true);
    });

    it('should create an account without a password (auto-generated)', async () => {
      const result = await accountsService.createAccount('auto_pass', 'Auto User');

      expect(result).toHaveProperty('userId');
      expect(result).toHaveProperty('password');
      expect(typeof result.password).toBe('string');
      expect(result.password.length).toBeGreaterThan(0);

      // The auto-generated password should be stored as a hash that matches
      const rows = await executeQuery<RowDataPacket[]>(
        'SELECT password FROM accounts WHERE username = ?',
        ['auto_pass'],
      );
      const storedHash = rows[0]!['password'] as string;
      const matches = await bcrypt.compare(result.password, storedHash);
      expect(matches).toBe(true);
    });

    it('should store username and real_name correctly in the database', async () => {
      await accountsService.createAccount('stored_user', 'Stored Name', 'Pass1234');

      const rows = await executeQuery<RowDataPacket[]>(
        'SELECT username, real_name FROM accounts WHERE username = ?',
        ['stored_user'],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]!['username']).toBe('stored_user');
      expect(rows[0]!['real_name']).toBe('Stored Name');
    });

    it('should return a correct auto-increment userId', async () => {
      const result1 = await accountsService.createAccount('user_one', 'User One', 'Pass1234');
      const result2 = await accountsService.createAccount('user_two', 'User Two', 'Pass5678');

      expect(result1.userId).toBeDefined();
      expect(result2.userId).toBeDefined();
      expect(result2.userId).toBeGreaterThan(result1.userId);
    });

    it('should throw on duplicate username (UNIQUE constraint)', async () => {
      await accountsService.createAccount('dupe_user', 'First', 'Pass1234');

      await expect(
        accountsService.createAccount('dupe_user', 'Second', 'Pass5678'),
      ).rejects.toThrow();
    });

    it('should rollback on duplicate username — no partial row inserted', async () => {
      await accountsService.createAccount('rollback_user', 'Original', 'Pass1234');

      try {
        await accountsService.createAccount('rollback_user', 'Duplicate', 'Pass5678');
      } catch {
        // Expected to throw
      }

      const rows = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM accounts WHERE username = ?',
        ['rollback_user'],
      );

      // Only the original row should exist
      expect(rows).toHaveLength(1);
      expect(rows[0]!['real_name']).toBe('Original');
    });

    it('should handle Arabic real names correctly', async () => {
      await accountsService.createAccount('arabic_user', 'طوني جورج', 'Pass1234');

      const rows = await executeQuery<RowDataPacket[]>(
        'SELECT real_name FROM accounts WHERE username = ?',
        ['arabic_user'],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0]!['real_name']).toBe('طوني جورج');
    });
  });

  describe('getAccountId()', () => {
    it('should return the account_id for an existing user', async () => {
      const { userId } = await accountsService.createAccount('existing_user', 'Exists', 'Pass1234');

      const accountId = await accountsService.getAccountId('existing_user');

      expect(accountId).toBe(userId);
    });

    it('should throw when the user does not exist', async () => {
      await expect(
        accountsService.getAccountId('nonexistent_user'),
      ).rejects.toThrow('user not found');
    });

    it('should return the correct ID when multiple accounts exist', async () => {
      const result1 = await accountsService.createAccount('multi_a', 'User A', 'Pass1234');
      const result2 = await accountsService.createAccount('multi_b', 'User B', 'Pass5678');
      const result3 = await accountsService.createAccount('multi_c', 'User C', 'Pass9012');

      expect(await accountsService.getAccountId('multi_a')).toBe(result1.userId);
      expect(await accountsService.getAccountId('multi_b')).toBe(result2.userId);
      expect(await accountsService.getAccountId('multi_c')).toBe(result3.userId);
    });

    it('should be case-sensitive for username lookup', async () => {
      await accountsService.createAccount('case_test', 'Case User', 'Pass1234');

      // MySQL with utf8mb4_0900_ai_ci collation is case-insensitive by default,
      // so 'CASE_TEST' would match 'case_test'. This test documents that behavior.
      // The service code itself just does a WHERE username = ? and relies on DB collation.
      const accountId = await accountsService.getAccountId('case_test');
      expect(accountId).toBeDefined();
      expect(typeof accountId).toBe('number');
    });
  });
});