import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import bcrypt from 'bcrypt';
import {
  createTestDatabase,
  dropTestDatabase,
  truncateAllTables,
  seedTestData,
  SeedSchool,
  SeedDistrict,
  SeedAccount,
} from '../helpers/test-db';
import classesService from '../../src/services/classes.service';
import { executeQuery } from '../../src/services/database.service';
import { RowDataPacket } from 'mysql2/promise';

describe('Classes Service — DB Integration', () => {
  let school1: SeedSchool;
  let school2: SeedSchool;
  let district1: SeedDistrict;
  let district2: SeedDistrict;
  let account1: SeedAccount;
  let account2: SeedAccount;

  beforeAll(async () => {
    await createTestDatabase();
  });

  afterAll(async () => {
    await dropTestDatabase();
  });

  beforeEach(async () => {
    await truncateAllTables();

    const hashedPassword = await bcrypt.hash('TestPass1', 10);
    school1 = { school_name: 'School Alpha' };
    school2 = { school_name: 'School Beta' };
    district1 = { district_name: 'دمنهور' };
    district2 = { district_name: 'الإسكندرية' };
    account1 = { username: 'user_one', password: hashedPassword, real_name: 'User One' };
    account2 = { username: 'user_two', password: hashedPassword, real_name: 'User Two' };

    await seedTestData({
      schools: [school1, school2],
      districts: [district1, district2],
      accounts: [account1, account2],
    });
  });

  // ---------------------------------------------------------------------------
  // School CRUD
  // ---------------------------------------------------------------------------

  describe('getSchools()', () => {
    it('should return all schools ordered by school_name', async () => {
      const schools = await classesService.getSchools();

      expect(schools).toHaveLength(2);
      // Alpha comes before Beta alphabetically
      expect(schools[0]!['school_name']).toBe('School Alpha');
      expect(schools[1]!['school_name']).toBe('School Beta');
    });

    it('should return empty array when no schools exist', async () => {
      await truncateAllTables();

      const schools = await classesService.getSchools();
      expect(schools).toEqual([]);
    });

    it('should return rows with school_id and school_name columns', async () => {
      const schools = await classesService.getSchools();

      for (const school of schools) {
        expect(school).toHaveProperty('school_id');
        expect(school).toHaveProperty('school_name');
      }
    });
  });

  describe('createSchool()', () => {
    it('should insert a school and be retrievable via getSchools', async () => {
      await classesService.createSchool('New School');

      const schools = await classesService.getSchools();
      const newSchool = schools.find((s) => s['school_name'] === 'New School');
      expect(newSchool).toBeDefined();
    });

    it('should handle Arabic school names', async () => {
      await classesService.createSchool('خدمة الأحد');

      const schools = await classesService.getSchools();
      const arabicSchool = schools.find((s) => s['school_name'] === 'خدمة الأحد');
      expect(arabicSchool).toBeDefined();
    });

    it('should return a ResultSetHeader with insertId', async () => {
      const result = await classesService.createSchool('Result School');

      expect(result).toBeDefined();
      expect((result as any).insertId).toBeGreaterThan(0);
    });
  });

  describe('updateSchool()', () => {
    it('should update the school name', async () => {
      await classesService.updateSchool(school1.school_id!, 'Updated Alpha');

      const schools = await classesService.getSchools();
      const updated = schools.find((s) => s['school_id'] === school1.school_id!);
      expect(updated).toBeDefined();
      expect(updated!['school_name']).toBe('Updated Alpha');
    });

    it('should not affect other schools', async () => {
      await classesService.updateSchool(school1.school_id!, 'Changed');

      const schools = await classesService.getSchools();
      const other = schools.find((s) => s['school_id'] === school2.school_id!);
      expect(other).toBeDefined();
      expect(other!['school_name']).toBe('School Beta');
    });
  });

  describe('deleteSchool()', () => {
    it('should delete the school', async () => {
      await classesService.deleteSchool(school1.school_id!);

      const schools = await classesService.getSchools();
      expect(schools).toHaveLength(1);
      expect(schools[0]!['school_name']).toBe('School Beta');
    });

    it('should cascade delete classes belonging to the school', async () => {
      await seedTestData({
        classes: [
          { class_name: 'Class A', school_id: school1.school_id! },
          { class_name: 'Class B', school_id: school1.school_id! },
        ],
      });

      await classesService.deleteSchool(school1.school_id!);

      const classes = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM classes WHERE school_id = ?',
        [school1.school_id!],
      );
      expect(classes).toHaveLength(0);
    });

    it('should cascade delete roles linked to classes in the school', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Class X', school_id: school1.school_id! }],
      });

      await seedTestData({
        roles: [
          {
            account_id: account1.account_id!,
            class_id: classSeeds.classIds[0]!,
            role: 'teacher',
            school_id: school1.school_id!,
          },
        ],
      });

      await classesService.deleteSchool(school1.school_id!);

      const roles = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM roles WHERE school_id = ?',
        [school1.school_id!],
      );
      expect(roles).toHaveLength(0);
    });

    it('should cascade delete events linked to classes in the school', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Evt Class', school_id: school1.school_id! }],
      });

      await seedTestData({
        events: [
          { class_id: classSeeds.classIds[0]!, event_name: 'Evt 1', type: 'student' },
        ],
      });

      await classesService.deleteSchool(school1.school_id!);

      const events = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM events WHERE class_id = ?',
        [classSeeds.classIds[0]!],
      );
      expect(events).toHaveLength(0);
    });

    it('should cascade delete person_class records linked to classes in the school', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'PC Class', school_id: school1.school_id! }],
      });

      const personSeeds = await seedTestData({
        persons: [
          {
            person_name: 'Student',
            address: 'Addr',
            district_id: district1.district_id!,
          },
        ],
      });

      await seedTestData({
        personClasses: [
          {
            person_id: personSeeds.personIds[0]!,
            class_id: classSeeds.classIds[0]!,
            type: 'student',
          },
        ],
      });

      await classesService.deleteSchool(school1.school_id!);

      const pcs = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM person_class WHERE class_id = ?',
        [classSeeds.classIds[0]!],
      );
      expect(pcs).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // Class CRUD
  // ---------------------------------------------------------------------------

  describe('createClass()', () => {
    it('should insert a class linked to the specified school', async () => {
      await classesService.createClass('New Class', school1.school_id!);

      const allClasses = await classesService.getAllClassesWithSchool();
      const created = allClasses.find((c) => c['class_name'] === 'New Class');
      expect(created).toBeDefined();
      expect(created!['school_id']).toBe(school1.school_id!);
    });

    it('should return a ResultSetHeader with insertId', async () => {
      const result = await classesService.createClass('Id Class', school1.school_id!);

      expect(result).toBeDefined();
      expect((result as any).insertId).toBeGreaterThan(0);
    });

    it('should handle Arabic class names', async () => {
      await classesService.createClass('فصل أول ابتدائي', school1.school_id!);

      const allClasses = await classesService.getAllClassesWithSchool();
      const arabicClass = allClasses.find(
        (c) => c['class_name'] === 'فصل أول ابتدائي',
      );
      expect(arabicClass).toBeDefined();
    });
  });

  describe('updateClass()', () => {
    it('should update the class name', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Original', school_id: school1.school_id! }],
      });

      await classesService.updateClass(classSeeds.classIds[0]!, 'Renamed');

      const allClasses = await classesService.getAllClassesWithSchool();
      const updated = allClasses.find(
        (c) => c['class_id'] === classSeeds.classIds[0]!,
      );
      expect(updated).toBeDefined();
      expect(updated!['class_name']).toBe('Renamed');
    });
  });

  describe('deleteClass()', () => {
    it('should delete the class', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'To Delete', school_id: school1.school_id! }],
      });

      await classesService.deleteClass(classSeeds.classIds[0]!);

      const rows = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM classes WHERE class_id = ?',
        [classSeeds.classIds[0]!],
      );
      expect(rows).toHaveLength(0);
    });

    it('should cascade delete events in the class', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Evt Del Class', school_id: school1.school_id! }],
      });

      await seedTestData({
        events: [
          { class_id: classSeeds.classIds[0]!, event_name: 'Evt A', type: 'all' },
          { class_id: classSeeds.classIds[0]!, event_name: 'Evt B', type: 'student' },
        ],
      });

      await classesService.deleteClass(classSeeds.classIds[0]!);

      const events = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM events WHERE class_id = ?',
        [classSeeds.classIds[0]!],
      );
      expect(events).toHaveLength(0);
    });

    it('should cascade delete roles in the class', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Role Del Class', school_id: school1.school_id! }],
      });

      await seedTestData({
        roles: [
          {
            account_id: account1.account_id!,
            class_id: classSeeds.classIds[0]!,
            role: 'leader',
            school_id: school1.school_id!,
          },
        ],
      });

      await classesService.deleteClass(classSeeds.classIds[0]!);

      const roles = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM roles WHERE class_id = ?',
        [classSeeds.classIds[0]!],
      );
      expect(roles).toHaveLength(0);
    });

    it('should cascade delete person_class records in the class', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'PC Del Class', school_id: school1.school_id! }],
      });

      const personSeeds = await seedTestData({
        persons: [
          {
            person_name: 'Person',
            address: 'Addr',
            district_id: district1.district_id!,
          },
        ],
      });

      await seedTestData({
        personClasses: [
          {
            person_id: personSeeds.personIds[0]!,
            class_id: classSeeds.classIds[0]!,
            type: 'student',
          },
        ],
      });

      await classesService.deleteClass(classSeeds.classIds[0]!);

      const pcs = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM person_class WHERE class_id = ?',
        [classSeeds.classIds[0]!],
      );
      expect(pcs).toHaveLength(0);
    });

    it('should not affect other classes in the same school', async () => {
      const classSeeds = await seedTestData({
        classes: [
          { class_name: 'Keep This', school_id: school1.school_id! },
          { class_name: 'Delete This', school_id: school1.school_id! },
        ],
      });

      await classesService.deleteClass(classSeeds.classIds[1]!);

      const remaining = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM classes WHERE school_id = ?',
        [school1.school_id!],
      );
      expect(remaining).toHaveLength(1);
      expect(remaining[0]!['class_name']).toBe('Keep This');
    });
  });

  // ---------------------------------------------------------------------------
  // getAllClassesWithSchool()
  // ---------------------------------------------------------------------------

  describe('getAllClassesWithSchool()', () => {
    it('should return classes joined with their school info', async () => {
      await seedTestData({
        classes: [
          { class_name: 'Class A', school_id: school1.school_id! },
          { class_name: 'Class B', school_id: school2.school_id! },
        ],
      });

      const allClasses = await classesService.getAllClassesWithSchool();

      expect(allClasses).toHaveLength(2);
      for (const cls of allClasses) {
        expect(cls).toHaveProperty('class_id');
        expect(cls).toHaveProperty('class_name');
        expect(cls).toHaveProperty('school_id');
        expect(cls).toHaveProperty('school_name');
      }
    });

    it('should return classes ordered by school_name then class_name', async () => {
      await seedTestData({
        classes: [
          { class_name: 'Zulu', school_id: school2.school_id! },
          { class_name: 'Alpha', school_id: school1.school_id! },
          { class_name: 'Bravo', school_id: school1.school_id! },
        ],
      });

      const allClasses = await classesService.getAllClassesWithSchool();

      // School Alpha comes first (alphabetically), then School Beta
      expect(allClasses[0]!['school_name']).toBe('School Alpha');
      expect(allClasses[0]!['class_name']).toBe('Alpha');
      expect(allClasses[1]!['school_name']).toBe('School Alpha');
      expect(allClasses[1]!['class_name']).toBe('Bravo');
      expect(allClasses[2]!['school_name']).toBe('School Beta');
      expect(allClasses[2]!['class_name']).toBe('Zulu');
    });

    it('should return an empty array when no classes exist', async () => {
      const allClasses = await classesService.getAllClassesWithSchool();
      expect(allClasses).toEqual([]);
    });
  });

  // ---------------------------------------------------------------------------
  // getUserJoinedSchoolsClasses()
  // ---------------------------------------------------------------------------

  describe('getUserJoinedSchoolsClasses()', () => {
    it('should return schools and classes the user has roles in', async () => {
      const classSeeds = await seedTestData({
        classes: [
          { class_name: 'Class A', school_id: school1.school_id! },
          { class_name: 'Class B', school_id: school1.school_id! },
        ],
      });

      await seedTestData({
        roles: [
          {
            account_id: account1.account_id!,
            class_id: classSeeds.classIds[0]!,
            role: 'teacher',
            school_id: school1.school_id!,
          },
          {
            account_id: account1.account_id!,
            class_id: classSeeds.classIds[1]!,
            role: 'leader',
            school_id: school1.school_id!,
          },
        ],
      });

      const result = await classesService.getUserJoinedSchoolsClasses(
        account1.account_id!,
      );

      expect(result).toHaveLength(1); // one school
      expect(result[0]!.school_name).toBe('School Alpha');
      expect(result[0]!.classes).toHaveLength(2);
      const classNames = result[0]!.classes.map((c) => c.class_name);
      expect(classNames).toContain('Class A');
      expect(classNames).toContain('Class B');
    });

    it('should group classes by school when user has roles across multiple schools', async () => {
      const classSeeds = await seedTestData({
        classes: [
          { class_name: 'Alpha Class', school_id: school1.school_id! },
          { class_name: 'Beta Class', school_id: school2.school_id! },
        ],
      });

      await seedTestData({
        roles: [
          {
            account_id: account1.account_id!,
            class_id: classSeeds.classIds[0]!,
            role: 'teacher',
            school_id: school1.school_id!,
          },
          {
            account_id: account1.account_id!,
            class_id: classSeeds.classIds[1]!,
            role: 'manager',
            school_id: school2.school_id!,
          },
        ],
      });

      const result = await classesService.getUserJoinedSchoolsClasses(
        account1.account_id!,
      );

      expect(result).toHaveLength(2);
      const schoolNames = result.map((s) => s.school_name);
      expect(schoolNames).toContain('School Alpha');
      expect(schoolNames).toContain('School Beta');

      const alphaSchool = result.find((s) => s.school_name === 'School Alpha');
      expect(alphaSchool!.classes).toHaveLength(1);
      expect(alphaSchool!.classes[0]!.class_name).toBe('Alpha Class');

      const betaSchool = result.find((s) => s.school_name === 'School Beta');
      expect(betaSchool!.classes).toHaveLength(1);
      expect(betaSchool!.classes[0]!.class_name).toBe('Beta Class');
    });

    it('should keep the highest role per school (manager > leader > teacher)', async () => {
      const classSeeds = await seedTestData({
        classes: [
          { class_name: 'Class 1', school_id: school1.school_id! },
          { class_name: 'Class 2', school_id: school1.school_id! },
        ],
      });

      await seedTestData({
        roles: [
          {
            account_id: account1.account_id!,
            class_id: classSeeds.classIds[0]!,
            role: 'teacher',
            school_id: school1.school_id!,
          },
          {
            account_id: account1.account_id!,
            class_id: classSeeds.classIds[1]!,
            role: 'manager',
            school_id: school1.school_id!,
          },
        ],
      });

      const result = await classesService.getUserJoinedSchoolsClasses(
        account1.account_id!,
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.role).toBe('manager');
    });

    it('should deduplicate classes when user has multiple roles in the same class', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Dupe Class', school_id: school1.school_id! }],
      });

      await seedTestData({
        roles: [
          {
            account_id: account1.account_id!,
            class_id: classSeeds.classIds[0]!,
            role: 'teacher',
            school_id: school1.school_id!,
          },
          {
            account_id: account1.account_id!,
            class_id: classSeeds.classIds[0]!,
            role: 'leader',
            school_id: school1.school_id!,
          },
        ],
      });

      const result = await classesService.getUserJoinedSchoolsClasses(
        account1.account_id!,
      );

      expect(result).toHaveLength(1);
      // Classes should not be duplicated
      expect(result[0]!.classes).toHaveLength(1);
      expect(result[0]!.classes[0]!.class_name).toBe('Dupe Class');
      // Highest role should be leader
      expect(result[0]!.role).toBe('leader');
    });

    it('should return an empty array for a user with no roles', async () => {
      const result = await classesService.getUserJoinedSchoolsClasses(
        account1.account_id!,
      );
      expect(result).toEqual([]);
    });

    it('should only return data for the specified user (not other users)', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Isolated', school_id: school1.school_id! }],
      });

      await seedTestData({
        roles: [
          {
            account_id: account2.account_id!,
            class_id: classSeeds.classIds[0]!,
            role: 'teacher',
            school_id: school1.school_id!,
          },
        ],
      });

      // user_one should see nothing, user_two should see the class
      const result1 = await classesService.getUserJoinedSchoolsClasses(
        account1.account_id!,
      );
      expect(result1).toEqual([]);

      const result2 = await classesService.getUserJoinedSchoolsClasses(
        account2.account_id!,
      );
      expect(result2).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // getStudents() and getTeachers()
  // ---------------------------------------------------------------------------

  describe('getStudents()', () => {
    it('should return students in the class with phone numbers and district', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Student Class', school_id: school1.school_id! }],
      });

      const personSeeds = await seedTestData({
        persons: [
          {
            person_name: 'أحمد محمد',
            address: 'شارع النيل',
            district_id: district1.district_id!,
            notes: 'ملاحظة',
          },
        ],
      });

      await seedTestData({
        phoneNumbers: [
          { person_id: personSeeds.personIds[0]!, phone_number: '01012345678' },
        ],
        personClasses: [
          {
            person_id: personSeeds.personIds[0]!,
            class_id: classSeeds.classIds[0]!,
            type: 'student',
          },
        ],
      });

      const students = (await classesService.getStudents(
        classSeeds.classIds[0]!,
      )) as any[];

      expect(students).toHaveLength(1);
      expect(students[0]).toMatchObject({
        student_name: 'أحمد محمد',
        district: 'دمنهور',
      });
      expect(students[0].phone_numbers).toContain('01012345678');
      expect(students[0].student_id).toBe(personSeeds.personIds[0]!);
    });

    it('should return students with multiple phone numbers concatenated', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Multi Phone Class', school_id: school1.school_id! }],
      });

      const personSeeds = await seedTestData({
        persons: [
          {
            person_name: 'Multi Phone Student',
            address: 'Addr',
            district_id: district1.district_id!,
          },
        ],
      });

      await seedTestData({
        phoneNumbers: [
          { person_id: personSeeds.personIds[0]!, phone_number: '0101' },
          { person_id: personSeeds.personIds[0]!, phone_number: '0102' },
        ],
        personClasses: [
          {
            person_id: personSeeds.personIds[0]!,
            class_id: classSeeds.classIds[0]!,
            type: 'student',
          },
        ],
      });

      const students = (await classesService.getStudents(
        classSeeds.classIds[0]!,
      )) as any[];

      expect(students).toHaveLength(1);
      // GROUP_CONCAT with separator ', '
      expect(students[0].phone_numbers).toContain('0101');
      expect(students[0].phone_numbers).toContain('0102');
    });

    it('should return an empty array when the class has no students', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Empty Class', school_id: school1.school_id! }],
      });

      const students = (await classesService.getStudents(
        classSeeds.classIds[0]!,
      )) as any[];
      expect(students).toEqual([]);
    });

    it('should not include teachers in the student list', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Mixed Class', school_id: school1.school_id! }],
      });

      const personSeeds = await seedTestData({
        persons: [
          {
            person_name: 'Student Person',
            address: 'Addr',
            district_id: district1.district_id!,
          },
          {
            person_name: 'Teacher Person',
            address: 'Addr',
            district_id: district1.district_id!,
          },
        ],
      });

      await seedTestData({
        phoneNumbers: [
          { person_id: personSeeds.personIds[0]!, phone_number: '0101' },
          { person_id: personSeeds.personIds[1]!, phone_number: '0201' },
        ],
        personClasses: [
          {
            person_id: personSeeds.personIds[0]!,
            class_id: classSeeds.classIds[0]!,
            type: 'student',
          },
          {
            person_id: personSeeds.personIds[1]!,
            class_id: classSeeds.classIds[0]!,
            type: 'teacher',
          },
        ],
      });

      const students = (await classesService.getStudents(
        classSeeds.classIds[0]!,
      )) as any[];
      expect(students).toHaveLength(1);
      expect(students[0].student_name).toBe('Student Person');
    });

    it('should return students ordered by student_name', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Order Class', school_id: school1.school_id! }],
      });

      const personSeeds = await seedTestData({
        persons: [
          {
            person_name: 'Zaid',
            address: 'Addr',
            district_id: district1.district_id!,
          },
          {
            person_name: 'Ahmad',
            address: 'Addr',
            district_id: district1.district_id!,
          },
          {
            person_name: 'Mahmoud',
            address: 'Addr',
            district_id: district1.district_id!,
          },
        ],
      });

      await seedTestData({
        phoneNumbers: [
          { person_id: personSeeds.personIds[0]!, phone_number: '0100' },
          { person_id: personSeeds.personIds[1]!, phone_number: '0101' },
          { person_id: personSeeds.personIds[2]!, phone_number: '0102' },
        ],
        personClasses: [
          {
            person_id: personSeeds.personIds[0]!,
            class_id: classSeeds.classIds[0]!,
            type: 'student',
          },
          {
            person_id: personSeeds.personIds[1]!,
            class_id: classSeeds.classIds[0]!,
            type: 'student',
          },
          {
            person_id: personSeeds.personIds[2]!,
            class_id: classSeeds.classIds[0]!,
            type: 'student',
          },
        ],
      });

      const students = (await classesService.getStudents(
        classSeeds.classIds[0]!,
      )) as any[];
      expect(students).toHaveLength(3);
      expect(students[0].student_name).toBe('Ahmad');
      expect(students[1].student_name).toBe('Mahmoud');
      expect(students[2].student_name).toBe('Zaid');
    });
  });

  describe('getTeachers()', () => {
    it('should return teachers in the class with phone numbers and district', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Teacher Class', school_id: school1.school_id! }],
      });

      const personSeeds = await seedTestData({
        persons: [
          {
            person_name: 'المعلم أحمد',
            address: 'شارع الجيش',
            district_id: district2.district_id!,
            notes: 'معلم متميز',
          },
        ],
      });

      await seedTestData({
        phoneNumbers: [
          { person_id: personSeeds.personIds[0]!, phone_number: '01198765432' },
        ],
        personClasses: [
          {
            person_id: personSeeds.personIds[0]!,
            class_id: classSeeds.classIds[0]!,
            type: 'teacher',
          },
        ],
      });

      const teachers = (await classesService.getTeachers(
        classSeeds.classIds[0]!,
      )) as any[];

      expect(teachers).toHaveLength(1);
      expect(teachers[0]).toMatchObject({
        teacher_name: 'المعلم أحمد',
        district: 'الإسكندرية',
      });
      expect(teachers[0].phone_numbers).toContain('01198765432');
      expect(teachers[0].teacher_id).toBe(personSeeds.personIds[0]!);
    });

    it('should return an empty array when the class has no teachers', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'No Teacher Class', school_id: school1.school_id! }],
      });

      const teachers = (await classesService.getTeachers(
        classSeeds.classIds[0]!,
      )) as any[];
      expect(teachers).toEqual([]);
    });

    it('should not include students in the teacher list', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Filter Class', school_id: school1.school_id! }],
      });

      const personSeeds = await seedTestData({
        persons: [
          {
            person_name: 'Student Only',
            address: 'Addr',
            district_id: district1.district_id!,
          },
          {
            person_name: 'Teacher Only',
            address: 'Addr',
            district_id: district1.district_id!,
          },
        ],
      });

      await seedTestData({
        phoneNumbers: [
          { person_id: personSeeds.personIds[0]!, phone_number: '0301' },
          { person_id: personSeeds.personIds[1]!, phone_number: '0302' },
        ],
        personClasses: [
          {
            person_id: personSeeds.personIds[0]!,
            class_id: classSeeds.classIds[0]!,
            type: 'student',
          },
          {
            person_id: personSeeds.personIds[1]!,
            class_id: classSeeds.classIds[0]!,
            type: 'teacher',
          },
        ],
      });

      const teachers = (await classesService.getTeachers(
        classSeeds.classIds[0]!,
      )) as any[];
      expect(teachers).toHaveLength(1);
      expect(teachers[0].teacher_name).toBe('Teacher Only');
    });

    it('should return teachers ordered by teacher_name', async () => {
      const classSeeds = await seedTestData({
        classes: [{ class_name: 'Order Teacher Class', school_id: school1.school_id! }],
      });

      const personSeeds = await seedTestData({
        persons: [
          {
            person_name: 'Youssef',
            address: 'Addr',
            district_id: district1.district_id!,
          },
          {
            person_name: 'Bassem',
            address: 'Addr',
            district_id: district1.district_id!,
          },
        ],
      });

      await seedTestData({
        phoneNumbers: [
          { person_id: personSeeds.personIds[0]!, phone_number: '0401' },
          { person_id: personSeeds.personIds[1]!, phone_number: '0402' },
        ],
        personClasses: [
          {
            person_id: personSeeds.personIds[0]!,
            class_id: classSeeds.classIds[0]!,
            type: 'teacher',
          },
          {
            person_id: personSeeds.personIds[1]!,
            class_id: classSeeds.classIds[0]!,
            type: 'teacher',
          },
        ],
      });

      const teachers = (await classesService.getTeachers(
        classSeeds.classIds[0]!,
      )) as any[];
      expect(teachers).toHaveLength(2);
      expect(teachers[0].teacher_name).toBe('Bassem');
      expect(teachers[1].teacher_name).toBe('Youssef');
    });
  });

  // ---------------------------------------------------------------------------
  // End-to-end: full lifecycle
  // ---------------------------------------------------------------------------

  describe('end-to-end: school → class → students/teachers lifecycle', () => {
    it('should support creating a school, adding classes, then deleting school cascades everything', async () => {
      // 1. Create school via service
      const schoolResult = await classesService.createSchool('E2E School');
      const schoolId = (schoolResult as any).insertId as number;

      // 2. Create classes in the school
      const classResult1 = await classesService.createClass('E2E Class 1', schoolId);
      const classResult2 = await classesService.createClass('E2E Class 2', schoolId);
      const classId1 = (classResult1 as any).insertId as number;
      const classId2 = (classResult2 as any).insertId as number;

      // 3. Add persons and assign them
      const personSeeds = await seedTestData({
        persons: [
          {
            person_name: 'E2E Student',
            address: 'Addr',
            district_id: district1.district_id!,
          },
          {
            person_name: 'E2E Teacher',
            address: 'Addr',
            district_id: district1.district_id!,
          },
        ],
      });

      await seedTestData({
        phoneNumbers: [
          { person_id: personSeeds.personIds[0]!, phone_number: '0501' },
          { person_id: personSeeds.personIds[1]!, phone_number: '0502' },
        ],
        personClasses: [
          {
            person_id: personSeeds.personIds[0]!,
            class_id: classId1,
            type: 'student',
          },
          {
            person_id: personSeeds.personIds[1]!,
            class_id: classId1,
            type: 'teacher',
          },
        ],
        events: [
          { class_id: classId1, event_name: 'E2E Event', type: 'all' },
        ],
        roles: [
          {
            account_id: account1.account_id!,
            class_id: classId1,
            role: 'leader',
            school_id: schoolId,
          },
          {
            account_id: account1.account_id!,
            class_id: classId2,
            role: 'teacher',
            school_id: schoolId,
          },
        ],
      });

      // 4. Verify everything is there
      const schools = await classesService.getSchools();
      expect(schools.find((s) => s['school_id'] === schoolId)).toBeDefined();

      const allClasses = await classesService.getAllClassesWithSchool();
      expect(allClasses.filter((c) => c['school_id'] === schoolId)).toHaveLength(2);

      const students = (await classesService.getStudents(classId1)) as any[];
      expect(students).toHaveLength(1);

      const teachers = (await classesService.getTeachers(classId1)) as any[];
      expect(teachers).toHaveLength(1);

      const userClasses = await classesService.getUserJoinedSchoolsClasses(
        account1.account_id!,
      );
      expect(userClasses).toHaveLength(1);
      expect(userClasses[0]!.classes).toHaveLength(2);
      expect(userClasses[0]!.role).toBe('leader'); // highest

      // 5. Delete school → everything should cascade
      await classesService.deleteSchool(schoolId);

      const schoolsAfter = await classesService.getSchools();
      expect(schoolsAfter.find((s) => s['school_id'] === schoolId)).toBeUndefined();

      const classesAfter = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM classes WHERE school_id = ?',
        [schoolId],
      );
      expect(classesAfter).toHaveLength(0);

      const rolesAfter = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM roles WHERE school_id = ?',
        [schoolId],
      );
      expect(rolesAfter).toHaveLength(0);

      const eventsAfter = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM events WHERE class_id IN (?, ?)',
        [classId1, classId2],
      );
      expect(eventsAfter).toHaveLength(0);

      const pcsAfter = await executeQuery<RowDataPacket[]>(
        'SELECT * FROM person_class WHERE class_id IN (?, ?)',
        [classId1, classId2],
      );
      expect(pcsAfter).toHaveLength(0);
    });
  });
});