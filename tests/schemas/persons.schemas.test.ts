import { describe, it, expect } from '@jest/globals';
import {
  createPersonSchema,
  updatePersonSchema,
} from '../../src/schemas/persons.schemas';

describe('Persons Schemas', () => {
  describe('createPersonSchema', () => {
    const validPerson = {
      name: 'أحمد محمد',
      address: 'شارع النيل',
      phone_number: '01012345678',
      district_id: 1,
      class_id: 1,
    };

    it('should pass with valid minimal person data', () => {
      const result = createPersonSchema.safeParse(validPerson);
      expect(result.success).toBe(true);
    });

    it('should pass with all optional fields provided', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        second_phone_number: '01198765432',
        notes: 'ملاحظة بسيطة',
        photo_link: 'https://example.com/photo.jpg',
      });
      expect(result.success).toBe(true);
    });

    // --- name ---

    it('should fail when name is too short (1 char, min 2)', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        name: 'أ',
      });
      expect(result.success).toBe(false);
    });

    it('should pass when name is exactly 2 chars (min boundary)', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        name: 'أب',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when name exceeds 50 chars', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        name: 'أ'.repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it('should pass when name is exactly 50 chars (max boundary)', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        name: 'أ'.repeat(50),
      });
      expect(result.success).toBe(true);
    });

    it('should trim name whitespace', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        name: '  أحمد محمد  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.name).toBe('أحمد محمد');
      }
    });

    it('should fail when name is missing', () => {
      const { name: _, ...withoutName } = validPerson;
      const result = createPersonSchema.safeParse(withoutName);
      expect(result.success).toBe(false);
    });

    // --- address ---

    it('should fail when address is too short (3 chars, min 4)', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        address: 'شار',
      });
      expect(result.success).toBe(false);
    });

    it('should pass when address is exactly 4 chars (min boundary)', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        address: 'شارع',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when address exceeds 1000 chars', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        address: 'ش'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    it('should pass when address is exactly 1000 chars (max boundary)', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        address: 'ش'.repeat(1000),
      });
      expect(result.success).toBe(true);
    });

    it('should trim address whitespace', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        address: '  شارع النيل  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.address).toBe('شارع النيل');
      }
    });

    // --- phone_number ---

    it('should fail when phone_number contains letters', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        phone_number: '0101abc5678',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when phone_number is too short (6 digits, min 7)', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        phone_number: '012345',
      });
      expect(result.success).toBe(false);
    });

    it('should pass when phone_number is exactly 7 digits (min boundary)', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        phone_number: '0123456',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when phone_number exceeds 15 digits', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        phone_number: '0'.repeat(16),
      });
      expect(result.success).toBe(false);
    });

    it('should pass when phone_number is exactly 15 digits (max boundary)', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        phone_number: '0'.repeat(15),
      });
      expect(result.success).toBe(true);
    });

    it('should fail when phone_number contains special characters', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        phone_number: '010-1234-5678',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when phone_number contains spaces', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        phone_number: '010 1234 5678',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when phone_number is missing', () => {
      const { phone_number: _, ...withoutPhone } = validPerson;
      const result = createPersonSchema.safeParse(withoutPhone);
      expect(result.success).toBe(false);
    });

    // --- second_phone_number ---

    it('should pass when second_phone_number is omitted', () => {
      const result = createPersonSchema.safeParse(validPerson);
      expect(result.success).toBe(true);
    });

    it('should pass when second_phone_number is valid', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        second_phone_number: '01198765432',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when second_phone_number contains letters', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        second_phone_number: '0119abc5432',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when second_phone_number is too short (6 digits)', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        second_phone_number: '012345',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when second_phone_number exceeds 15 digits', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        second_phone_number: '0'.repeat(16),
      });
      expect(result.success).toBe(false);
    });

    // --- district_id ---

    it('should fail when district_id is zero', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        district_id: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should fail when district_id is negative', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        district_id: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should fail when district_id is a float', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        district_id: 1.5,
      });
      expect(result.success).toBe(false);
    });

    it('should pass when district_id is a positive integer', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        district_id: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should fail when district_id is missing', () => {
      const { district_id: _, ...withoutDistrict } = validPerson;
      const result = createPersonSchema.safeParse(withoutDistrict);
      expect(result.success).toBe(false);
    });

    // --- class_id ---

    it('should pass when class_id is a number', () => {
      const result = createPersonSchema.safeParse(validPerson);
      expect(result.success).toBe(true);
    });

    it('should fail when class_id is missing', () => {
      const { class_id: _, ...withoutClass } = validPerson;
      const result = createPersonSchema.safeParse(withoutClass);
      expect(result.success).toBe(false);
    });

    it('should fail when class_id is not a number', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        class_id: 'abc',
      });
      expect(result.success).toBe(false);
    });

    // --- notes ---

    it('should pass when notes is omitted', () => {
      const result = createPersonSchema.safeParse(validPerson);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notes).toBeUndefined();
      }
    });

    it('should pass when notes is exactly 255 chars (max boundary)', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        notes: 'ن'.repeat(255),
      });
      expect(result.success).toBe(true);
    });

    it('should fail when notes exceeds 255 chars', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        notes: 'ن'.repeat(256),
      });
      expect(result.success).toBe(false);
    });

    it('should trim notes whitespace', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        notes: '  ملاحظة  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.notes).toBe('ملاحظة');
      }
    });

    // --- photo_link ---

    it('should pass when photo_link is omitted', () => {
      const result = createPersonSchema.safeParse(validPerson);
      expect(result.success).toBe(true);
    });

    it('should pass when photo_link is a valid string (min 6)', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        photo_link: 'abc.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when photo_link is too short (5 chars, min 6)', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        photo_link: 'ab.jp',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when photo_link exceeds 1000 chars', () => {
      const result = createPersonSchema.safeParse({
        ...validPerson,
        photo_link: 'a'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe('updatePersonSchema', () => {
    const validUpdate = {
      name: 'أحمد محمد',
      address: 'شارع النيل',
      phone_number: '01012345678',
      district_id: 1,
    };

    it('should pass with valid update data (no class_id)', () => {
      const result = updatePersonSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it('should fail when class_id is provided (must be undefined)', () => {
      const result = updatePersonSchema.safeParse({
        ...validUpdate,
        class_id: 1,
      });
      expect(result.success).toBe(false);
    });

    it('should pass with all required fields present', () => {
      const result = updatePersonSchema.safeParse({
        ...validUpdate,
        second_phone_number: '01198765432',
        notes: 'ملاحظة جديدة',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when required name is missing', () => {
      const { name: _, ...withoutName } = validUpdate;
      const result = updatePersonSchema.safeParse(withoutName);
      expect(result.success).toBe(false);
    });

    it('should fail when required address is missing', () => {
      const { address: _, ...withoutAddress } = validUpdate;
      const result = updatePersonSchema.safeParse(withoutAddress);
      expect(result.success).toBe(false);
    });

    it('should fail when required phone_number is missing', () => {
      const { phone_number: _, ...withoutPhone } = validUpdate;
      const result = updatePersonSchema.safeParse(withoutPhone);
      expect(result.success).toBe(false);
    });

    it('should fail when required district_id is missing', () => {
      const { district_id: _, ...withoutDistrict } = validUpdate;
      const result = updatePersonSchema.safeParse(withoutDistrict);
      expect(result.success).toBe(false);
    });

    it('should inherit name validation rules from createPersonSchema', () => {
      const result = updatePersonSchema.safeParse({
        ...validUpdate,
        name: 'أ', // too short
      });
      expect(result.success).toBe(false);
    });

    it('should inherit phone_number validation rules from createPersonSchema', () => {
      const result = updatePersonSchema.safeParse({
        ...validUpdate,
        phone_number: '0101abc5678', // letters in phone
      });
      expect(result.success).toBe(false);
    });

    it('should inherit district_id validation rules from createPersonSchema', () => {
      const result = updatePersonSchema.safeParse({
        ...validUpdate,
        district_id: -1, // negative
      });
      expect(result.success).toBe(false);
    });
  });
});