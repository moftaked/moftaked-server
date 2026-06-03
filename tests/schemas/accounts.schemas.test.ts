import { describe, it, expect } from '@jest/globals';
import { createAccountSchema } from '../../src/schemas/accounts.schemas';

describe('Accounts Schemas', () => {
  describe('createAccountSchema', () => {
    it('should pass with valid data without password', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony_123',
        real_name: 'Tony George',
      });
      expect(result.success).toBe(true);
    });

    it('should pass with valid data including password', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
        password: 'aA1bcdefgh!x',
        real_name: 'Tony',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when username contains uppercase letters', () => {
      const result = createAccountSchema.safeParse({
        username: 'Tony_123',
        real_name: 'Tony George',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when username contains spaces', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony 123',
        real_name: 'Tony George',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when username contains special characters (@, !, etc.)', () => {
      const specialChars = ['@', '!', '#', '$', '%', '^', '&', '*', '-', '.'];
      for (const char of specialChars) {
        const result = createAccountSchema.safeParse({
          username: `tony${char}123`,
          real_name: 'Tony George',
        });
        expect(result.success).toBe(false);
      }
    });

    it('should pass with username containing only lowercase, underscores, and digits', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony_george_99',
        real_name: 'Tony George',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when password is missing uppercase letter', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
        password: 'aa1bcdefgh!',
        real_name: 'Tony',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when password is missing lowercase letter', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
        password: 'AA1BCDEFGH!',
        real_name: 'Tony',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when password is missing digit', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
        password: 'aAbcdefghi!',
        real_name: 'Tony',
      });
      expect(result.success).toBe(false);
    });

    it('should pass when password contains special characters', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
        password: 'aA1bcd!fghij',
        real_name: 'Tony',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when password is only special characters', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
        password: '!@#$%^&*()_+',
        real_name: 'Tony',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when real_name is an empty string', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
        real_name: '',
      });
      expect(result.success).toBe(false);
    });

    it('should pass when real_name is exactly 1 char (min boundary)', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
        real_name: 'T',
      });
      expect(result.success).toBe(true);
    });

    it('should pass when real_name is exactly 50 chars (max boundary)', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
        real_name: 'A'.repeat(50),
      });
      expect(result.success).toBe(true);
    });

    it('should fail when real_name exceeds 50 chars', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
        real_name: 'A'.repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it('should fail when username is missing', () => {
      const result = createAccountSchema.safeParse({
        real_name: 'Tony George',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when real_name is missing', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when username is an empty string', () => {
      const result = createAccountSchema.safeParse({
        username: '',
        real_name: 'Tony',
      });
      expect(result.success).toBe(false);
    });

    it('should pass when username is exactly 1 char (min boundary)', () => {
      const result = createAccountSchema.safeParse({
        username: 'a',
        real_name: 'Tony',
      });
      expect(result.success).toBe(true);
    });

    it('should pass when username is exactly 50 chars (max boundary)', () => {
      const result = createAccountSchema.safeParse({
        username: 'a'.repeat(50),
        real_name: 'Tony',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when username exceeds 50 chars', () => {
      const result = createAccountSchema.safeParse({
        username: 'a'.repeat(51),
        real_name: 'Tony',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when username has leading/trailing whitespace (regex runs before trim)', () => {
      const result = createAccountSchema.safeParse({
        username: '  tony  ',
        real_name: 'Tony',
      });
      // regex /^[a-z_0-9]+$/ is checked before .trim(), so spaces cause failure
      expect(result.success).toBe(false);
    });

    it('should trim real_name whitespace', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
        real_name: '  Tony George  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.real_name).toBe('Tony George');
      }
    });

    it('should fail when password is too short (8 chars, min 12)', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
        password: 'aA1b!cde',
        real_name: 'Tony',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when password exceeds 50 chars', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
        password: 'aA1!' + 'b'.repeat(47),
        real_name: 'Tony',
      });
      expect(result.success).toBe(false);
    });

    it('should pass when password is exactly 50 chars with valid pattern', () => {
      const result = createAccountSchema.safeParse({
        username: 'tony',
        password: 'aA1!' + 'b'.repeat(46),
        real_name: 'Tony',
      });
      expect(result.success).toBe(true);
    });
  });
});