import { describe, it, expect } from '@jest/globals';
import { signInSchema } from '../../src/schemas/auth.schemas';

describe('Auth Schemas', () => {
  describe('signInSchema', () => {
    it('should pass with valid sign-in data', () => {
      const result = signInSchema.safeParse({
        username: 'test_user',
        password: 'Password123!',
      });
      expect(result.success).toBe(true);
    });

    it('should pass when username is exactly 1 char (min boundary)', () => {
      const result = signInSchema.safeParse({
        username: 'a',
        password: 'Password123!',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when username is too long (51 chars, max 50)', () => {
      const result = signInSchema.safeParse({
        username: 'a'.repeat(51),
        password: 'Password123!',
      });
      expect(result.success).toBe(false);
    });

    it('should pass when username is exactly 50 chars (max boundary)', () => {
      const result = signInSchema.safeParse({
        username: 'a'.repeat(50),
        password: 'Password123!',
      });
      expect(result.success).toBe(true);
    });

    it('should pass with any non-empty password', () => {
      const result = signInSchema.safeParse({
        username: 'test_user',
        password: '1',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when username is missing', () => {
      const result = signInSchema.safeParse({
        password: 'Password123!',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when password is missing', () => {
      const result = signInSchema.safeParse({
        username: 'test_user',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when both fields are missing', () => {
      const result = signInSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should trim username with leading/trailing whitespace', () => {
      const result = signInSchema.safeParse({
        username: '  test_user  ',
        password: 'Password123!',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe('test_user');
      }
    });

    it('should fail when username is an empty string', () => {
      const result = signInSchema.safeParse({
        username: '',
        password: 'Password123!',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when password is an empty string', () => {
      const result = signInSchema.safeParse({
        username: 'test_user',
        password: '',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when username is only whitespace (trims to empty)', () => {
      const result = signInSchema.safeParse({
        username: '   ',
        password: 'Password123!',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when username is not a string', () => {
      const result = signInSchema.safeParse({
        username: 12345,
        password: 'Password123!',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when password is not a string', () => {
      const result = signInSchema.safeParse({
        username: 'test_user',
        password: 12345678,
      });
      expect(result.success).toBe(false);
    });
  });
});