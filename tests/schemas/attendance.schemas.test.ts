import { describe, it, expect } from '@jest/globals';
import { patchAttendanceSchema } from '../../src/schemas/attendance.schemas';

describe('Attendance Schemas', () => {
  describe('patchAttendanceSchema', () => {
    it('should pass with valid data: attended, absent, and type "student"', () => {
      const result = patchAttendanceSchema.safeParse({
        attended: [1, 2],
        absent: [3],
        type: 'student',
      });
      expect(result.success).toBe(true);
    });

    it('should pass with valid data: type "teacher"', () => {
      const result = patchAttendanceSchema.safeParse({
        type: 'teacher',
      });
      expect(result.success).toBe(true);
    });

    it('should pass with type "student" and no attended/absent (both optional)', () => {
      const result = patchAttendanceSchema.safeParse({
        type: 'student',
      });
      expect(result.success).toBe(true);
    });

    it('should fail with invalid type "admin"', () => {
      const result = patchAttendanceSchema.safeParse({
        attended: [1],
        absent: [2],
        type: 'admin',
      });
      expect(result.success).toBe(false);
    });

    it('should fail with invalid type "all"', () => {
      const result = patchAttendanceSchema.safeParse({
        attended: [1],
        absent: [2],
        type: 'all',
      });
      expect(result.success).toBe(false);
    });

    it('should fail with invalid type "both"', () => {
      const result = patchAttendanceSchema.safeParse({
        attended: [1],
        type: 'both',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when attended contains non-numbers', () => {
      const result = patchAttendanceSchema.safeParse({
        attended: ['a', 'b'],
        type: 'student',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when absent contains non-numbers', () => {
      const result = patchAttendanceSchema.safeParse({
        absent: ['x', 'y'],
        type: 'student',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when type is missing', () => {
      const result = patchAttendanceSchema.safeParse({
        attended: [1, 2],
        absent: [3],
      });
      expect(result.success).toBe(false);
    });

    it('should pass with empty arrays for attended and absent', () => {
      const result = patchAttendanceSchema.safeParse({
        attended: [],
        absent: [],
        type: 'student',
      });
      expect(result.success).toBe(true);
    });

    it('should pass with only attended provided (absent omitted)', () => {
      const result = patchAttendanceSchema.safeParse({
        attended: [1, 2, 3],
        type: 'teacher',
      });
      expect(result.success).toBe(true);
    });

    it('should pass with only absent provided (attended omitted)', () => {
      const result = patchAttendanceSchema.safeParse({
        absent: [4, 5],
        type: 'student',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when attended is not an array', () => {
      const result = patchAttendanceSchema.safeParse({
        attended: 'not-an-array',
        type: 'student',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when absent is not an array', () => {
      const result = patchAttendanceSchema.safeParse({
        absent: 42,
        type: 'teacher',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when type is an empty string', () => {
      const result = patchAttendanceSchema.safeParse({
        type: '',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when type is a number instead of string', () => {
      const result = patchAttendanceSchema.safeParse({
        type: 1,
      });
      expect(result.success).toBe(false);
    });

    it('should fail when the entire input is empty', () => {
      const result = patchAttendanceSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should pass with large arrays of valid numbers', () => {
      const attended = Array.from({ length: 100 }, (_, i) => i + 1);
      const absent = Array.from({ length: 50 }, (_, i) => i + 101);
      const result = patchAttendanceSchema.safeParse({
        attended,
        absent,
        type: 'student',
      });
      expect(result.success).toBe(true);
    });

    it('should fail when attended contains mixed types (numbers and strings)', () => {
      const result = patchAttendanceSchema.safeParse({
        attended: [1, 'two', 3],
        type: 'student',
      });
      expect(result.success).toBe(false);
    });

    it('should pass with float numbers in attended (z.number allows floats)', () => {
      const result = patchAttendanceSchema.safeParse({
        attended: [1.5, 2.7],
        type: 'student',
      });
      // z.number() allows floats — only z.number().int() restricts to integers
      expect(result.success).toBe(true);
    });

    it('should pass with negative numbers in attended (z.number allows negatives)', () => {
      const result = patchAttendanceSchema.safeParse({
        attended: [-1, -2],
        type: 'teacher',
      });
      // z.number() allows negatives — no .positive() constraint on array items
      expect(result.success).toBe(true);
    });

    it('should pass with zero in attended array', () => {
      const result = patchAttendanceSchema.safeParse({
        attended: [0],
        type: 'student',
      });
      expect(result.success).toBe(true);
    });
  });
});