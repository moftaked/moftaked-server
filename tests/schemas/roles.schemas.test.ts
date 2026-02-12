import { describe, it, expect } from '@jest/globals';
import { addRoleSchema } from '../../src/schemas/roles.schemas';

describe('Roles Schemas', () => {
  describe('addRoleSchema', () => {
    it('should pass with valid data using username string', () => {
      const result = addRoleSchema.safeParse({
        user: 'tony',
        classId: 1,
        role: 'teacher',
      });
      expect(result.success).toBe(true);
    });

    it('should pass with valid data using user ID number', () => {
      const result = addRoleSchema.safeParse({
        user: 5,
        classId: 1,
        role: 'leader',
      });
      expect(result.success).toBe(true);
    });

    it('should pass with role "manager"', () => {
      const result = addRoleSchema.safeParse({
        user: 'tony',
        classId: 1,
        role: 'manager',
      });
      expect(result.success).toBe(true);
    });

    it('should pass with role "teacher"', () => {
      const result = addRoleSchema.safeParse({
        user: 'tony',
        classId: 1,
        role: 'teacher',
      });
      expect(result.success).toBe(true);
    });

    it('should pass with role "leader"', () => {
      const result = addRoleSchema.safeParse({
        user: 'tony',
        classId: 1,
        role: 'leader',
      });
      expect(result.success).toBe(true);
    });

    it('should fail with invalid role "admin"', () => {
      const result = addRoleSchema.safeParse({
        user: 'tony',
        classId: 1,
        role: 'admin',
      });
      expect(result.success).toBe(false);
    });

    it('should fail with invalid role "student"', () => {
      const result = addRoleSchema.safeParse({
        user: 'tony',
        classId: 1,
        role: 'student',
      });
      expect(result.success).toBe(false);
    });

    it('should fail with empty string role', () => {
      const result = addRoleSchema.safeParse({
        user: 'tony',
        classId: 1,
        role: '',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when role is missing', () => {
      const result = addRoleSchema.safeParse({
        user: 'tony',
        classId: 1,
      });
      expect(result.success).toBe(false);
    });

    it('should fail when username contains uppercase letters', () => {
      const result = addRoleSchema.safeParse({
        user: 'Tony',
        classId: 1,
        role: 'teacher',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when username contains special characters', () => {
      const specialChars = ['@', '!', '#', '$', '-', '.', ' '];
      for (const char of specialChars) {
        const result = addRoleSchema.safeParse({
          user: `tony${char}test`,
          classId: 1,
          role: 'teacher',
        });
        expect(result.success).toBe(false);
      }
    });

    it('should pass when username contains only lowercase, underscores, and digits', () => {
      const result = addRoleSchema.safeParse({
        user: 'tony_george_99',
        classId: 1,
        role: 'teacher',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when user is an empty string (min 1)', () => {
      const result = addRoleSchema.safeParse({
        user: '',
        classId: 1,
        role: 'teacher',
      });
      expect(result.success).toBe(false);
    });

    it('should pass when user string is exactly 1 char (min boundary)', () => {
      const result = addRoleSchema.safeParse({
        user: 'a',
        classId: 1,
        role: 'teacher',
      });
      expect(result.success).toBe(true);
    });

    it('should pass when user string is exactly 50 chars (max boundary)', () => {
      const result = addRoleSchema.safeParse({
        user: 'a'.repeat(50),
        classId: 1,
        role: 'teacher',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when user string exceeds 50 chars', () => {
      const result = addRoleSchema.safeParse({
        user: 'a'.repeat(51),
        classId: 1,
        role: 'teacher',
      });
      expect(result.success).toBe(false);
    });

    it('should pass when user is a positive number', () => {
      const result = addRoleSchema.safeParse({
        user: 100,
        classId: 1,
        role: 'leader',
      });
      expect(result.success).toBe(true);
    });

    it('should pass when user is zero (z.number has no .positive constraint)', () => {
      const result = addRoleSchema.safeParse({
        user: 0,
        classId: 1,
        role: 'teacher',
      });
      expect(result.success).toBe(true);
    });

    it('should pass when user is a negative number (z.number has no .positive constraint)', () => {
      const result = addRoleSchema.safeParse({
        user: -5,
        classId: 1,
        role: 'teacher',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when user is missing', () => {
      const result = addRoleSchema.safeParse({
        classId: 1,
        role: 'teacher',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when user is a boolean', () => {
      const result = addRoleSchema.safeParse({
        user: true,
        classId: 1,
        role: 'teacher',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when user is null', () => {
      const result = addRoleSchema.safeParse({
        user: null,
        classId: 1,
        role: 'teacher',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when classId is missing', () => {
      const result = addRoleSchema.safeParse({
        user: 'tony',
        role: 'teacher',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when classId is a string', () => {
      const result = addRoleSchema.safeParse({
        user: 'tony',
        classId: '1',
        role: 'teacher',
      });
      expect(result.success).toBe(false);
    });

    it('should pass when classId is a valid number', () => {
      const result = addRoleSchema.safeParse({
        user: 'tony',
        classId: 42,
        role: 'teacher',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when all fields are missing', () => {
      const result = addRoleSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should fail when role is a number instead of string', () => {
      const result = addRoleSchema.safeParse({
        user: 'tony',
        classId: 1,
        role: 1,
      });
      expect(result.success).toBe(false);
    });
  });
});