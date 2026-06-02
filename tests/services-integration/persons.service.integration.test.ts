import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  createTestDatabase,
  dropTestDatabase,
  truncateAllTables,
  seedTestData,
  SeedSchool,
  SeedDistrict,
} from '../helpers/test-db';
import personsService from '../../src/services/persons.service';
import { executeQuery } from '../../src/services/database.service';
import { RowDataPacket } from 'mysql2/promise';

describe('Persons Service — DB Integration', () => {
  let school: SeedSchool;
  let district1: SeedDistrict;
  let district2: SeedDistrict;

  let schoolId: number;
  let district1Id: number;
  let district2Id: number;
  let class1Id: number;
  let class2Id: number;

  beforeAll(async () => {
    await createTestDatabase();
  });

  afterAll(async () => {
    await dropTestDatabase();
  });

  beforeEach(async () => {
    await truncateAllTables();

    school = { school_name: 'Persons School' };
    district1 = { district_name: 'دمنهور' };
    district2 = { district_name: 'الإسكندرية' };

    const baseSeed = await seedTestData({
      schools: [school],
      districts: [district1, district2],
    });
    schoolId = baseSeed.schoolIds[0]!;
    district1Id = baseSeed.districtIds[0]!;
    district2Id = baseSeed.districtIds[1]!;

    const classSeed = await seedTestData({
      classes: [
        { class_name: 'Class A', school_id: schoolId },
        { class_name: 'Class B', school_id: schoolId },
      ],
    });
    class1Id = classSeed.classIds[0]!;
    class2Id = classSeed.classIds[1]!;
  });

  // ---------------------------------------------------------------------------
  // createPerson()
  // ---------------------------------------------------------------------------

  describe('createPerson()', () => {
    it('should insert a student with all required fields into persons, phone_numbers, and person_class', async () => {
      await personsService.createPerson('student', {
        name: 'أحمد محمد',
        address: 'شارع النيل',
        phone_number: '01012345678',
        district_id: district1Id,
        class_id: class1Id,
      });

      // Check persons table
      const persons = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM persons WHERE person_name = ?',
        ['أحمد محمد'],
      );
      expect(persons).toHaveLength(1);
      expect(persons[0]!['address']).toBe('شارع النيل');
      expect(persons[0]!['district_id']).toBe(district1Id);
      const personId = persons[0]!['person_id'] as number;

      // Check phone_numbers table
      const phones = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM phone_numbers WHERE person_id = ?',
        [personId],
      );
      expect(phones).toHaveLength(1);
      expect(phones[0]!['phone_number']).toBe('01012345678');

      // Check person_class table
      const pcs = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM person_class WHERE person_id = ?',
        [personId],
      );
      expect(pcs).toHaveLength(1);
      expect(pcs[0]!['class_id']).toBe(class1Id);
      expect(pcs[0]!['type']).toBe('student');
    });

    it('should insert a teacher with type "teacher"', async () => {
      await personsService.createPerson('teacher', {
        name: 'المعلم خالد',
        address: 'شارع الجيش',
        phone_number: '01198765432',
        district_id: district2Id,
        class_id: class1Id,
      });

      const pcs = await executeQuery<RowDataPacket[]>(
        "SELECT * FROM person_class WHERE type = 'teacher'",
      );
      expect(pcs).toHaveLength(1);
      expect(pcs[0]!['class_id']).toBe(class1Id);
    });

    it('should insert a second phone number when provided', async () => {
      await personsService.createPerson('student', {
        name: 'Two Phones',
        address: 'Addr',
        phone_number: '0101',
        second_phone_number: '0102',
        district_id: district1Id,
        class_id: class1Id,
      });

      const persons = await executeQuery<RowDataPacket[]>(
        'SELECT person_id FROM persons WHERE person_name = ?',
        ['Two Phones'],
      );
      const personId = persons[0]!['person_id'] as number;

      const phones = await executeQuery<RowDataPacket[]>(
        'SELECT phone_number FROM phone_numbers WHERE person_id = ? ORDER BY phone_number_id',
        [personId],
      );
      expect(phones).toHaveLength(2);
      expect(phones[0]!['phone_number']).toBe('0101');
      expect(phones[1]!['phone_number']).toBe('0102');
    });

    it('should only insert one phone number when second_phone_number is not provided', async () => {
      await personsService.createPerson('student', {
        name: 'One Phone',
        address: 'Addr',
        phone_number: '0201',
        district_id: district1Id,
        class_id: class1Id,
      });

      const persons = await executeQuery<RowDataPacket[]>(
        'SELECT person_id FROM persons WHERE person_name = ?',
        ['One Phone'],
      );
      const personId = persons[0]!['person_id'] as number;

      const phones = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM phone_numbers WHERE person_id = ?',
        [personId],
      );
      expect(phones).toHaveLength(1);
    });

    it('should store the normalized Arabic name in normalized_person_name', async () => {
      await personsService.createPerson('student', {
        name: 'أحمد إبراهيم',
        address: 'Addr',
        phone_number: '0301',
        district_id: district1Id,
        class_id: class1Id,
      });

      const persons = await executeQuery<RowDataPacket[]>(
        'SELECT person_name, normalized_person_name FROM persons WHERE person_name = ?',
        ['أحمد إبراهيم'],
      );
      expect(persons).toHaveLength(1);
      // normalized_person_name should be set (arabic-strings sanitize removes diacritics etc.)
      expect(persons[0]!['normalized_person_name']).toBeDefined();
      expect(typeof persons[0]!['normalized_person_name']).toBe('string');
      expect((persons[0]!['normalized_person_name'] as string).length).toBeGreaterThan(0);
    });

    it('should trim whitespace from name, address, phone_number, and notes', async () => {
      await personsService.createPerson('student', {
        name: '  Trimmed Name  ',
        address: '  Trimmed Address  ',
        phone_number: ' 0401 ',
        district_id: district1Id,
        class_id: class1Id,
        notes: '  Some notes  ',
      });

      const persons = await executeQuery<RowDataPacket[]>(
        'SELECT person_name, address, notes FROM persons ORDER BY person_id DESC LIMIT 1',
      );
      expect(persons[0]!['person_name']).toBe('Trimmed Name');
      expect(persons[0]!['address']).toBe('Trimmed Address');
      expect(persons[0]!['notes']).toBe('Some notes');

      const personId = (await executeQuery<RowDataPacket[]>(
        'SELECT person_id FROM persons ORDER BY person_id DESC LIMIT 1',
      ))[0]!['person_id'] as number;

      const phones = await executeQuery<RowDataPacket[]>(
        'SELECT phone_number FROM phone_numbers WHERE person_id = ?',
        [personId],
      );
      expect(phones[0]!['phone_number']).toBe('0401');
    });

    it('should store optional notes field', async () => {
      await personsService.createPerson('student', {
        name: 'Notes Student',
        address: 'Addr',
        phone_number: '0501',
        district_id: district1Id,
        class_id: class1Id,
        notes: 'ملاحظة مهمة',
      });

      const persons = await executeQuery<RowDataPacket[]>(
        'SELECT notes FROM persons WHERE person_name = ?',
        ['Notes Student'],
      );
      expect(persons[0]!['notes']).toBe('ملاحظة مهمة');
    });

    it('should rollback on DB error — no partial records inserted', async () => {
      // Use an invalid district_id (FK constraint) to trigger an error
      try {
        await personsService.createPerson('student', {
          name: 'Rollback Student',
          address: 'Addr',
          phone_number: '0601',
          district_id: 99999,
          class_id: class1Id,
        });
      } catch {
        // Expected to throw FK constraint error
      }

      // No person should have been created
      const persons = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM persons WHERE person_name = ?',
        ['Rollback Student'],
      );
      expect(persons).toHaveLength(0);

      // No phone numbers
      const phones = await executeQuery<RowDataPacket[]>(
        "SELECT * FROM phone_numbers WHERE phone_number = '0601'",
      );
      expect(phones).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // getPersonById()
  // ---------------------------------------------------------------------------

  describe('getPersonById()', () => {
    it('should return a person with joined district and phone numbers (GROUP_CONCAT)', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'ById Person',
            address: 'ById Addr',
            district_id: district1Id,
            notes: 'some note',
          },
        ],
      });
      const personId = personSeed.personIds[0]!;

      await seedTestData({
        phoneNumbers: [
          { person_id: personId, phone_number: '0701' },
          { person_id: personId, phone_number: '0702' },
        ],
      });

      const results = (await personsService.getPersonById(personId)) as any[];

      expect(results).toHaveLength(1);
      expect(results[0].person_name).toBe('ById Person');
      expect(results[0].address).toBe('ById Addr');
      expect(results[0].district_name).toBe('دمنهور');
      expect(results[0].notes).toBe('some note');
      // phone_numbers should be a GROUP_CONCAT string with both numbers
      expect(results[0].phone_numbers).toContain('0701');
      expect(results[0].phone_numbers).toContain('0702');
    });

    it('should return an empty result for a non-existent person ID', async () => {
      const results = (await personsService.getPersonById(99999)) as any[];
      // The query may return a row with null values or an empty array depending
      // on the GROUP BY behavior. Either way, there should be no meaningful person data.
      if (results.length > 0) {
        expect(results[0].person_id).toBeNull();
      }
    });

    it('should return null phone_numbers when person has no phone records', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'No Phone',
            address: 'Addr',
            district_id: district1Id,
          },
        ],
      });

      const results = (await personsService.getPersonById(personSeed.personIds[0]!)) as any[];
      expect(results).toHaveLength(1);
      expect(results[0].phone_numbers).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // searchByName()
  // ---------------------------------------------------------------------------

  describe('searchByName()', () => {
    beforeAll(async () => {
      const personSeed = await seedTestData({
        persons: [
          { person_name: 'أحمد محمد إبراهيم', address: 'Addr', district_id: district1Id, normalized_person_name: 'احمد محمد ابراهيم' },
          { person_name: 'محمد أحمد', address: 'Addr', district_id: district1Id, normalized_person_name: 'محمد احمد' },
          { person_name: 'خالد يوسف', address: 'Addr', district_id: district1Id, normalized_person_name: 'خالد يوسف' },
          { person_name: 'Teacher Person', address: 'Addr', district_id: district1Id, normalized_person_name: 'teacher person' },
        ],
      });

      await seedTestData({
        personClasses: [
          { person_id: personSeed.personIds[0]!, class_id: class1Id, type: 'student' },
          { person_id: personSeed.personIds[1]!, class_id: class1Id, type: 'student' },
          { person_id: personSeed.personIds[2]!, class_id: class2Id, type: 'student' },
          { person_id: personSeed.personIds[3]!, class_id: class1Id, type: 'teacher' },
        ],
      });
    });

    it('should return empty array when classIds is empty', async () => {
      const results = await personsService.searchByName('أحمد', 'student', []);
      expect(results).toEqual([]);
    });

    it('should find students matching the search term in the specified classes', async () => {
      const results = (await personsService.searchByName('احمد', 'student', [class1Id])) as any[];
      // Should match 'أحمد محمد إبراهيم' and 'محمد أحمد' in class1
      expect(results.length).toBeGreaterThanOrEqual(1);
      const names = results.map((r: any) => r.person_name);
      // At least one of these should match based on normalized search
      const hasAhmad = names.some((n: string) => n.includes('أحمد') || n.includes('محمد'));
      expect(hasAhmad).toBe(true);
    });

    it('should not return persons from classes not in classIds', async () => {
      // Search in class1 only — خالد يوسف is in class2
      const results = (await personsService.searchByName('خالد', 'student', [class1Id])) as any[];
      const names = results.map((r: any) => r.person_name);
      expect(names).not.toContain('خالد يوسف');
    });

    it('should search across multiple classes when multiple classIds provided', async () => {
      const results = (await personsService.searchByName('احمد', 'student', [class1Id, class2Id])) as any[];
      // Should find matches from both classes
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should only return persons of the specified type (student)', async () => {
      // 'Teacher Person' is a teacher in class1 — should not appear in student search
      const results = (await personsService.searchByName('teacher', 'student', [class1Id])) as any[];
      const names = results.map((r: any) => r.person_name);
      expect(names).not.toContain('Teacher Person');
    });

    it('should only return persons of the specified type (teacher)', async () => {
      const results = (await personsService.searchByName('teacher', 'teacher', [class1Id])) as any[];
      expect(results.length).toBeGreaterThanOrEqual(1);
      const names = results.map((r: any) => r.person_name);
      expect(names).toContain('Teacher Person');
    });

    it('should return empty array when no names match', async () => {
      const results = (await personsService.searchByName('zzzznonexistent', 'student', [class1Id])) as any[];
      expect(results).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // updatePerson()
  // ---------------------------------------------------------------------------

  describe('updatePerson()', () => {
    let studentId: number;

    beforeEach(async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'Original Name',
            address: 'Original Address',
            district_id: district1Id,
            notes: 'Original notes',
          },
        ],
      });
      studentId = personSeed.personIds[0]!;

      await seedTestData({
        phoneNumbers: [
          { person_id: studentId, phone_number: '0801' },
        ],
        personClasses: [
          { person_id: studentId, class_id: class1Id, type: 'student' },
        ],
      });
    });

    it('should update name, address, district, and notes', async () => {
      const affectedRows = await personsService.updatePerson(studentId, {
        name: 'Updated Name',
        address: 'Updated Address',
        phone_number: '0801',
        district_id: district2Id,
        notes: 'Updated notes',
        class_id: undefined,
      });

      expect(affectedRows).toBe(1);

      const persons = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM persons WHERE person_id = ?',
        [studentId],
      );
      expect(persons[0]!['person_name']).toBe('Updated Name');
      expect(persons[0]!['address']).toBe('Updated Address');
      expect(persons[0]!['district_id']).toBe(district2Id);
      expect(persons[0]!['notes']).toBe('Updated notes');
    });

    it('should update the normalized_person_name when the name is changed', async () => {
      await personsService.updatePerson(studentId, {
        name: 'إبراهيم محمود',
        address: 'Addr',
        phone_number: '0801',
        district_id: district1Id,
        class_id: undefined,
      });

      const persons = await executeQuery<RowDataPacket[]>(
        'SELECT normalized_person_name FROM persons WHERE person_id = ?',
        [studentId],
      );
      expect(persons[0]!['normalized_person_name']).toBeDefined();
      expect(typeof persons[0]!['normalized_person_name']).toBe('string');
    });

    it('should update the primary phone number', async () => {
      await personsService.updatePerson(studentId, {
        name: 'Original Name',
        address: 'Original Address',
        phone_number: '0901',
        district_id: district1Id,
        class_id: undefined,
      });

      const phones = await executeQuery<RowDataPacket[]>(
        'SELECT phone_number FROM phone_numbers WHERE person_id = ? ORDER BY phone_number_id',
        [studentId],
      );
      expect(phones).toHaveLength(1);
      expect(phones[0]!['phone_number']).toBe('0901');
    });

    it('should add a second phone number when one did not exist before', async () => {
      await personsService.updatePerson(studentId, {
        name: 'Original Name',
        address: 'Original Address',
        phone_number: '0801',
        second_phone_number: '0802',
        district_id: district1Id,
        class_id: undefined,
      });

      const phones = await executeQuery<RowDataPacket[]>(
        'SELECT phone_number FROM phone_numbers WHERE person_id = ? ORDER BY phone_number_id',
        [studentId],
      );
      expect(phones).toHaveLength(2);
      expect(phones[0]!['phone_number']).toBe('0801');
      expect(phones[1]!['phone_number']).toBe('0802');
    });

    it('should update an existing second phone number', async () => {
      // First add a second phone
      await seedTestData({
        phoneNumbers: [{ person_id: studentId, phone_number: '0802_old' }],
      });

      await personsService.updatePerson(studentId, {
        name: 'Original Name',
        address: 'Original Address',
        phone_number: '0801',
        second_phone_number: '0802_new',
        district_id: district1Id,
        class_id: undefined,
      });

      const phones = await executeQuery<RowDataPacket[]>(
        'SELECT phone_number FROM phone_numbers WHERE person_id = ? ORDER BY phone_number_id',
        [studentId],
      );
      expect(phones).toHaveLength(2);
      expect(phones[1]!['phone_number']).toBe('0802_new');
    });

    it('should remove the second phone number when not provided and one existed', async () => {
      // Add a second phone
      await seedTestData({
        phoneNumbers: [{ person_id: studentId, phone_number: '0802_remove' }],
      });

      // Update without second_phone_number
      await personsService.updatePerson(studentId, {
        name: 'Original Name',
        address: 'Original Address',
        phone_number: '0801',
        district_id: district1Id,
        class_id: undefined,
      });

      const phones = await executeQuery<RowDataPacket[]>(
        'SELECT phone_number FROM phone_numbers WHERE person_id = ? ORDER BY phone_number_id',
        [studentId],
      );
      expect(phones).toHaveLength(1);
      expect(phones[0]!['phone_number']).toBe('0801');
    });

    it('should return 0 when the person is not a student (type check in WHERE clause)', async () => {
      // Create a teacher person
      const teacherSeed = await seedTestData({
        persons: [
          {
            person_name: 'Teacher Update',
            address: 'Addr',
            district_id: district1Id,
          },
        ],
      });
      const teacherId = teacherSeed.personIds[0]!;

      await seedTestData({
        phoneNumbers: [{ person_id: teacherId, phone_number: '1001' }],
        personClasses: [{ person_id: teacherId, class_id: class1Id, type: 'teacher' }],
      });

      // updatePerson checks type='student' in the WHERE clause
      const affectedRows = await personsService.updatePerson(teacherId, {
        name: 'Should Not Update',
        address: 'Addr',
        phone_number: '1001',
        district_id: district1Id,
        class_id: undefined,
      });

      expect(affectedRows).toBe(0);

      // Verify name was NOT changed
      const persons = await executeQuery<RowDataPacket[]>(
        'SELECT person_name FROM persons WHERE person_id = ?',
        [teacherId],
      );
      expect(persons[0]!['person_name']).toBe('Teacher Update');
    });
  });

  // ---------------------------------------------------------------------------
  // updatePersonPhoto()
  // ---------------------------------------------------------------------------

  describe('updatePersonPhoto()', () => {
    it('should update the photo_link column for the person', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'Photo Person',
            address: 'Addr',
            district_id: district1Id,
          },
        ],
      });
      const personId = personSeed.personIds[0]!;

      await personsService.updatePersonPhoto(personId, '/uploads/photo_123.jpg');

      const persons = await executeQuery<RowDataPacket[]>(
        'SELECT photo_link FROM persons WHERE person_id = ?',
        [personId],
      );
      expect(persons[0]!['photo_link']).toBe('/uploads/photo_123.jpg');
    });

    it('should overwrite an existing photo_link', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'Overwrite Photo',
            address: 'Addr',
            district_id: district1Id,
            photo_link: '/uploads/old.jpg',
          },
        ],
      });
      const personId = personSeed.personIds[0]!;

      await personsService.updatePersonPhoto(personId, '/uploads/new.jpg');

      const persons = await executeQuery<RowDataPacket[]>(
        'SELECT photo_link FROM persons WHERE person_id = ?',
        [personId],
      );
      expect(persons[0]!['photo_link']).toBe('/uploads/new.jpg');
    });
  });

  // ---------------------------------------------------------------------------
  // getPersonClasses()
  // ---------------------------------------------------------------------------

  describe('getPersonClasses()', () => {
    it('should return classes with school names for a person', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'Multi Class Person',
            address: 'Addr',
            district_id: district1Id,
          },
        ],
      });
      const personId = personSeed.personIds[0]!;

      await seedTestData({
        personClasses: [
          { person_id: personId, class_id: class1Id, type: 'student' },
          { person_id: personId, class_id: class2Id, type: 'student' },
        ],
      });

      const results = (await personsService.getPersonClasses(personId)) as any[];

      expect(results).toHaveLength(2);
      for (const result of results) {
        expect(result).toHaveProperty('class_id');
        expect(result).toHaveProperty('class_name');
        expect(result).toHaveProperty('school_name');
        expect(result).toHaveProperty('type');
        expect(result.school_name).toBe('Persons School');
      }

      const classNames = results.map((r: any) => r.class_name);
      expect(classNames).toContain('Class A');
      expect(classNames).toContain('Class B');
    });

    it('should return empty array for a person not assigned to any class', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'No Class',
            address: 'Addr',
            district_id: district1Id,
          },
        ],
      });

      const results = (await personsService.getPersonClasses(personSeed.personIds[0]!)) as any[];
      expect(results).toEqual([]);
    });

    it('should include the type (student/teacher) for each class assignment', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'Type Check Person',
            address: 'Addr',
            district_id: district1Id,
          },
        ],
      });
      const personId = personSeed.personIds[0]!;

      await seedTestData({
        personClasses: [
          { person_id: personId, class_id: class1Id, type: 'student' },
          { person_id: personId, class_id: class2Id, type: 'teacher' },
        ],
      });

      const results = (await personsService.getPersonClasses(personId)) as any[];
      expect(results).toHaveLength(2);

      const class1Result = results.find((r: any) => r.class_id === class1Id);
      const class2Result = results.find((r: any) => r.class_id === class2Id);

      expect(class1Result!.type).toBe('student');
      expect(class2Result!.type).toBe('teacher');
    });
  });

  // ---------------------------------------------------------------------------
  // getJoinedClasses()
  // ---------------------------------------------------------------------------

  describe('getJoinedClasses()', () => {
    it('should return class_id list for a student', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'Joined Student',
            address: 'Addr',
            district_id: district1Id,
          },
        ],
      });
      const personId = personSeed.personIds[0]!;

      await seedTestData({
        personClasses: [
          { person_id: personId, class_id: class1Id, type: 'student' },
          { person_id: personId, class_id: class2Id, type: 'student' },
        ],
      });

      const results = await personsService.getJoinedClasses(personId, 'student');
      expect(results).toHaveLength(2);
      const classIds = results.map((r) => r.class_id);
      expect(classIds).toContain(class1Id);
      expect(classIds).toContain(class2Id);
    });

    it('should filter by type — student type should not return teacher assignments', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'Dual Role',
            address: 'Addr',
            district_id: district1Id,
          },
        ],
      });
      const personId = personSeed.personIds[0]!;

      await seedTestData({
        personClasses: [
          { person_id: personId, class_id: class1Id, type: 'student' },
          { person_id: personId, class_id: class2Id, type: 'teacher' },
        ],
      });

      const studentClasses = await personsService.getJoinedClasses(personId, 'student');
      expect(studentClasses).toHaveLength(1);
      expect(studentClasses[0]!.class_id).toBe(class1Id);

      const teacherClasses = await personsService.getJoinedClasses(personId, 'teacher');
      expect(teacherClasses).toHaveLength(1);
      expect(teacherClasses[0]!.class_id).toBe(class2Id);
    });

    it('should return empty array when person has no class assignments for the type', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'No Join',
            address: 'Addr',
            district_id: district1Id,
          },
        ],
      });

      const results = await personsService.getJoinedClasses(personSeed.personIds[0]!, 'student');
      expect(results).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // unassignPerson()
  // ---------------------------------------------------------------------------

  describe('unassignPerson()', () => {
    it('should remove the person_class record', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'Unassign Person',
            address: 'Addr',
            district_id: district1Id,
          },
        ],
      });
      const personId = personSeed.personIds[0]!;

      await seedTestData({
        phoneNumbers: [{ person_id: personId, phone_number: '1101' }],
        personClasses: [
          { person_id: personId, class_id: class1Id, type: 'student' },
          { person_id: personId, class_id: class2Id, type: 'student' },
        ],
      });

      const affectedRows = await personsService.unassignPerson(personId, class1Id, 'student');
      expect(affectedRows).toBe(1);

      const pcs = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM person_class WHERE person_id = ?',
        [personId],
      );
      expect(pcs).toHaveLength(1);
      expect(pcs[0]!['class_id']).toBe(class2Id);
    });

    it('should return 0 when the person is not in the specified class', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'Not In Class',
            address: 'Addr',
            district_id: district1Id,
          },
        ],
      });
      const personId = personSeed.personIds[0]!;

      await seedTestData({
        phoneNumbers: [{ person_id: personId, phone_number: '1201' }],
        personClasses: [
          { person_id: personId, class_id: class1Id, type: 'student' },
        ],
      });

      // Try to unassign from class2 where the person is NOT assigned
      const affectedRows = await personsService.unassignPerson(personId, class2Id, 'student');
      expect(affectedRows).toBe(0);

      // Original assignment should still exist
      const pcs = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM person_class WHERE person_id = ?',
        [personId],
      );
      expect(pcs).toHaveLength(1);
    });

    it('should auto-delete the person when unassigned from their last class', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'Auto Delete',
            address: 'Addr',
            district_id: district1Id,
          },
        ],
      });
      const personId = personSeed.personIds[0]!;

      await seedTestData({
        phoneNumbers: [{ person_id: personId, phone_number: '1301' }],
        personClasses: [
          { person_id: personId, class_id: class1Id, type: 'student' },
        ],
      });

      await personsService.unassignPerson(personId, class1Id, 'student');

      // The person should have been deleted (deletePersonIfNotInAnyClass)
      // Give it a brief moment as it's called asynchronously in the service
      await new Promise((resolve) => setTimeout(resolve, 500));

      const persons = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM persons WHERE person_id = ?',
        [personId],
      );
      expect(persons).toHaveLength(0);
    });

    it('should NOT auto-delete the person when they are still in another class', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'Keep Person',
            address: 'Addr',
            district_id: district1Id,
          },
        ],
      });
      const personId = personSeed.personIds[0]!;

      await seedTestData({
        phoneNumbers: [{ person_id: personId, phone_number: '1401' }],
        personClasses: [
          { person_id: personId, class_id: class1Id, type: 'student' },
          { person_id: personId, class_id: class2Id, type: 'student' },
        ],
      });

      await personsService.unassignPerson(personId, class1Id, 'student');

      await new Promise((resolve) => setTimeout(resolve, 500));

      const persons = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM persons WHERE person_id = ?',
        [personId],
      );
      expect(persons).toHaveLength(1); // Person should still exist
    });

    it('should return 0 when type does not match (student vs teacher)', async () => {
      const personSeed = await seedTestData({
        persons: [
          {
            person_name: 'Type Mismatch',
            address: 'Addr',
            district_id: district1Id,
          },
        ],
      });
      const personId = personSeed.personIds[0]!;

      await seedTestData({
        phoneNumbers: [{ person_id: personId, phone_number: '1501' }],
        personClasses: [
          { person_id: personId, class_id: class1Id, type: 'student' },
        ],
      });

      // Try to unassign as 'teacher' — should fail since assignment is 'student'
      const affectedRows = await personsService.unassignPerson(personId, class1Id, 'teacher');
      expect(affectedRows).toBe(0);

      const pcs = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM person_class WHERE person_id = ?',
        [personId],
      );
      expect(pcs).toHaveLength(1); // Original assignment should still exist
    });
  });

  // ---------------------------------------------------------------------------
  // End-to-end: full person lifecycle
  // ---------------------------------------------------------------------------

  describe('end-to-end: person lifecycle', () => {
    it('should support create → retrieve → update → search → unassign lifecycle', async () => {
      // 1. Create a person
      await personsService.createPerson('student', {
        name: 'محمود عبد الله',
        address: 'شارع الجامعة',
        phone_number: '01234567890',
        district_id: district1Id,
        class_id: class1Id,
        notes: 'طالب جديد',
      });

      // 2. Find the person via search
      const searchResults = (await personsService.searchByName('محمود', 'student', [class1Id])) as any[];
      expect(searchResults.length).toBeGreaterThanOrEqual(1);
      const personId = searchResults[0].person_id as number;

      // 3. Retrieve full details
      const details = (await personsService.getPersonById(personId)) as any[];
      expect(details).toHaveLength(1);
      expect(details[0].person_name).toBe('محمود عبد الله');
      expect(details[0].district_name).toBe('دمنهور');
      expect(details[0].phone_numbers).toContain('01234567890');
      expect(details[0].notes).toBe('طالب جديد');

      // 4. Get person classes
      const classes = (await personsService.getPersonClasses(personId)) as any[];
      expect(classes).toHaveLength(1);
      expect(classes[0].class_name).toBe('Class A');
      expect(classes[0].type).toBe('student');

      // 5. Update the person (change address, add second phone)
      const affectedRows = await personsService.updatePerson(personId, {
        name: 'محمود عبد الله',
        address: 'شارع التحرير',
        phone_number: '01234567890',
        second_phone_number: '01198765432',
        district_id: district2Id,
        notes: 'تم نقله',
        class_id: undefined,
      });
      expect(affectedRows).toBe(1);

      // 6. Verify update
      const updatedDetails = (await personsService.getPersonById(personId)) as any[];
      expect(updatedDetails[0].address).toBe('شارع التحرير');
      expect(updatedDetails[0].district_name).toBe('الإسكندرية');
      expect(updatedDetails[0].phone_numbers).toContain('01234567890');
      expect(updatedDetails[0].phone_numbers).toContain('01198765432');
      expect(updatedDetails[0].notes).toBe('تم نقله');

      // 7. Upload a photo
      await personsService.updatePersonPhoto(personId, '/uploads/mahmoud.jpg');
      const photoDetails = (await personsService.getPersonById(personId)) as any[];
      expect(photoDetails[0].photo_link).toBe('/uploads/mahmoud.jpg');

      // 8. Get joined classes
      const joinedClasses = await personsService.getJoinedClasses(personId, 'student');
      expect(joinedClasses).toHaveLength(1);
      expect(joinedClasses[0]!.class_id).toBe(class1Id);

      // 9. Unassign from class (person should be auto-deleted since it's their only class)
      await personsService.unassignPerson(personId, class1Id, 'student');

      // Give async deletePersonIfNotInAnyClass a moment
      await new Promise((resolve) => setTimeout(resolve, 500));

      const afterUnassign = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM persons WHERE person_id = ?',
        [personId],
      );
      expect(afterUnassign).toHaveLength(0);
    });
  });
});
