import { describe, it, expect } from '@jest/globals';
import {
  EventSchema,
  EventOccurrenceSchema,
  SchoolOccurrenceSchema,
} from '../../src/schemas/events.schemas';

describe('Events Schemas', () => {
  describe('EventSchema', () => {
    const validEvent = {
      classId: 1,
      eventName: 'حصة',
      type: 'student',
    };

    it('should pass with valid EventSchema data (type "student")', () => {
      const result = EventSchema.safeParse(validEvent);
      expect(result.success).toBe(true);
    });

    it('should pass with type "teacher"', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        type: 'teacher',
      });
      expect(result.success).toBe(true);
    });

    it('should pass with type "all"', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        type: 'all',
      });
      expect(result.success).toBe(true);
    });

    it('should fail with invalid type "both"', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        type: 'both',
      });
      expect(result.success).toBe(false);
    });

    it('should fail with invalid type "admin"', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        type: 'admin',
      });
      expect(result.success).toBe(false);
    });

    it('should fail with empty string type', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        type: '',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when type is missing', () => {
      const { type: _, ...withoutType } = validEvent;
      const result = EventSchema.safeParse(withoutType);
      expect(result.success).toBe(false);
    });

    it('should fail when eventName is too short (1 char, min 2)', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        eventName: 'ح',
      });
      expect(result.success).toBe(false);
    });

    it('should pass when eventName is exactly 2 chars (min boundary)', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        eventName: 'حص',
      });
      expect(result.success).toBe(true);
    });

    it('should pass when eventName is exactly 50 chars (max boundary)', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        eventName: 'ح'.repeat(50),
      });
      expect(result.success).toBe(true);
    });

    it('should fail when eventName exceeds 50 chars', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        eventName: 'ح'.repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it('should fail when eventName is an empty string', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        eventName: '',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when eventName is missing', () => {
      const { eventName: _, ...withoutName } = validEvent;
      const result = EventSchema.safeParse(withoutName);
      expect(result.success).toBe(false);
    });

    it('should trim eventName whitespace', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        eventName: '  حصة  ',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.eventName).toBe('حصة');
      }
    });

    it('should fail when classId is zero', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        classId: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should fail when classId is negative', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        classId: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should fail when classId is a float', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        classId: 1.5,
      });
      expect(result.success).toBe(false);
    });

    it('should pass when classId is a positive integer', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        classId: 99,
      });
      expect(result.success).toBe(true);
    });

    it('should fail when classId is missing', () => {
      const { classId: _, ...withoutClassId } = validEvent;
      const result = EventSchema.safeParse(withoutClassId);
      expect(result.success).toBe(false);
    });

    it('should fail when classId is a string', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        classId: '1',
      });
      expect(result.success).toBe(false);
    });

    it('should fail when all fields are missing', () => {
      const result = EventSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should fail when type is a number', () => {
      const result = EventSchema.safeParse({
        ...validEvent,
        type: 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('EventOccurrenceSchema', () => {
    it('should pass with valid eventId', () => {
      const result = EventOccurrenceSchema.safeParse({ eventId: 1 });
      expect(result.success).toBe(true);
    });

    it('should pass with large positive integer eventId', () => {
      const result = EventOccurrenceSchema.safeParse({ eventId: 99999 });
      expect(result.success).toBe(true);
    });

    it('should fail when eventId is zero', () => {
      const result = EventOccurrenceSchema.safeParse({ eventId: 0 });
      expect(result.success).toBe(false);
    });

    it('should fail when eventId is negative', () => {
      const result = EventOccurrenceSchema.safeParse({ eventId: -1 });
      expect(result.success).toBe(false);
    });

    it('should fail when eventId is a float', () => {
      const result = EventOccurrenceSchema.safeParse({ eventId: 1.5 });
      expect(result.success).toBe(false);
    });

    it('should fail when eventId is a string', () => {
      const result = EventOccurrenceSchema.safeParse({ eventId: '1' });
      expect(result.success).toBe(false);
    });

    it('should fail when eventId is missing', () => {
      const result = EventOccurrenceSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should fail when eventId is null', () => {
      const result = EventOccurrenceSchema.safeParse({ eventId: null });
      expect(result.success).toBe(false);
    });

    it('should fail when eventId is undefined', () => {
      const result = EventOccurrenceSchema.safeParse({ eventId: undefined });
      expect(result.success).toBe(false);
    });
  });

  describe('SchoolOccurrenceSchema', () => {
    it('should pass with valid schoolId', () => {
      const result = SchoolOccurrenceSchema.safeParse({ schoolId: 1 });
      expect(result.success).toBe(true);
    });

    it('should pass with large positive integer schoolId', () => {
      const result = SchoolOccurrenceSchema.safeParse({ schoolId: 99999 });
      expect(result.success).toBe(true);
    });

    it('should fail when schoolId is zero', () => {
      const result = SchoolOccurrenceSchema.safeParse({ schoolId: 0 });
      expect(result.success).toBe(false);
    });

    it('should fail when schoolId is negative', () => {
      const result = SchoolOccurrenceSchema.safeParse({ schoolId: -1 });
      expect(result.success).toBe(false);
    });

    it('should fail when schoolId is a float', () => {
      const result = SchoolOccurrenceSchema.safeParse({ schoolId: 1.5 });
      expect(result.success).toBe(false);
    });

    it('should fail when schoolId is a string', () => {
      const result = SchoolOccurrenceSchema.safeParse({ schoolId: '1' });
      expect(result.success).toBe(false);
    });

    it('should fail when schoolId is missing', () => {
      const result = SchoolOccurrenceSchema.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should fail when schoolId is null', () => {
      const result = SchoolOccurrenceSchema.safeParse({ schoolId: null });
      expect(result.success).toBe(false);
    });

    it('should fail when schoolId is undefined', () => {
      const result = SchoolOccurrenceSchema.safeParse({ schoolId: undefined });
      expect(result.success).toBe(false);
    });
  });
});