import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before importing the service
jest.mock('../../src/services/database.service');
jest.mock('../../src/services/data-versions.service');

import classesService from '../../src/services/classes.service';
import { executeQuery, getConnection } from '../../src/services/database.service';
import dataVersionsService from '../../src/services/data-versions.service';

const mockedExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
const mockedGetConnection = getConnection as jest.MockedFunction<typeof getConnection>;
const mockedDataVersionsService = dataVersionsService as jest.Mocked<typeof dataVersionsService>;

function createMockConnection() {
  const mockConnection = {
    beginTransaction: jest.fn().mockResolvedValue(undefined as never),
    commit: jest.fn().mockResolvedValue(undefined as never),
    rollback: jest.fn().mockResolvedValue(undefined as never),
    release: jest.fn(),
    query: jest.fn(),
    execute: jest.fn(),
  };
  return mockConnection;
}

describe('Classes Service', () => {
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = createMockConnection();
    mockedGetConnection.mockResolvedValue(mockConnection as any);
    mockedDataVersionsService.touchClasses.mockReturnValue(Promise.resolve() as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getUserJoinedSchoolsClasses()', () => {
    it('should return schools with classes grouped by school_id', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { school_id: 1, school_name: 'خدمة الأحد', class_id: 10, class_name: 'فصل أولى', role: 'teacher' },
        { school_id: 1, school_name: 'خدمة الأحد', class_id: 11, class_name: 'فصل تانية', role: 'teacher' },
        { school_id: 2, school_name: 'خدمة السبت', class_id: 20, class_name: 'فصل تالتة', role: 'leader' },
      ] as any);

      const result = await classesService.getUserJoinedSchoolsClasses(42);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        school_id: 1,
        school_name: 'خدمة الأحد',
        role: 'teacher',
        classes: [
          { class_id: 10, class_name: 'فصل أولى' },
          { class_id: 11, class_name: 'فصل تانية' },
        ],
      });
      expect(result[1]).toEqual({
        school_id: 2,
        school_name: 'خدمة السبت',
        role: 'leader',
        classes: [
          { class_id: 20, class_name: 'فصل تالتة' },
        ],
      });
    });

    it('should query the database with the correct user ID', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getUserJoinedSchoolsClasses(99);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      const [queryStr, params] = mockedExecuteQuery.mock.calls[0]!;
      expect(queryStr).toContain('account_id = ?');
      expect(params).toEqual([99]);
    });

    it('should return an empty array when user has no classes', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      const result = await classesService.getUserJoinedSchoolsClasses(42);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should deduplicate classes when user has multiple roles in the same class', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { school_id: 1, school_name: 'خدمة الأحد', class_id: 10, class_name: 'فصل أولى', role: 'teacher' },
        { school_id: 1, school_name: 'خدمة الأحد', class_id: 10, class_name: 'فصل أولى', role: 'leader' },
      ] as any);

      const result = await classesService.getUserJoinedSchoolsClasses(42);

      expect(result).toHaveLength(1);
      expect(result[0]!.classes).toHaveLength(1);
      expect(result[0]!.classes[0]!.class_id).toBe(10);
    });

    it('should keep the highest role per school: manager > leader > teacher', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { school_id: 1, school_name: 'خدمة الأحد', class_id: 10, class_name: 'فصل أولى', role: 'teacher' },
        { school_id: 1, school_name: 'خدمة الأحد', class_id: 11, class_name: 'فصل تانية', role: 'manager' },
      ] as any);

      const result = await classesService.getUserJoinedSchoolsClasses(42);

      expect(result).toHaveLength(1);
      expect(result[0]!.role).toBe('manager');
    });

    it('should keep leader over teacher when no manager exists', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { school_id: 1, school_name: 'خدمة الأحد', class_id: 10, class_name: 'فصل أولى', role: 'teacher' },
        { school_id: 1, school_name: 'خدمة الأحد', class_id: 11, class_name: 'فصل تانية', role: 'leader' },
      ] as any);

      const result = await classesService.getUserJoinedSchoolsClasses(42);

      expect(result).toHaveLength(1);
      expect(result[0]!.role).toBe('leader');
    });

    it('should handle user with classes across multiple schools', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { school_id: 1, school_name: 'خدمة 1', class_id: 10, class_name: 'فصل 10', role: 'teacher' },
        { school_id: 2, school_name: 'خدمة 2', class_id: 20, class_name: 'فصل 20', role: 'manager' },
        { school_id: 3, school_name: 'خدمة 3', class_id: 30, class_name: 'فصل 30', role: 'leader' },
      ] as any);

      const result = await classesService.getUserJoinedSchoolsClasses(42);

      expect(result).toHaveLength(3);
      expect(result[0]!.school_id).toBe(1);
      expect(result[0]!.role).toBe('teacher');
      expect(result[1]!.school_id).toBe(2);
      expect(result[1]!.role).toBe('manager');
      expect(result[2]!.school_id).toBe(3);
      expect(result[2]!.role).toBe('leader');
    });

    it('should use the first occurrence role when no upgrade happens', async () => {
      mockedExecuteQuery.mockResolvedValue([
        { school_id: 1, school_name: 'خدمة الأحد', class_id: 10, class_name: 'فصل أولى', role: 'manager' },
        { school_id: 1, school_name: 'خدمة الأحد', class_id: 11, class_name: 'فصل تانية', role: 'teacher' },
      ] as any);

      const result = await classesService.getUserJoinedSchoolsClasses(42);

      // manager was first, teacher shouldn't downgrade
      expect(result[0]!.role).toBe('manager');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValue(new Error('Connection lost') as never);

      await expect(
        classesService.getUserJoinedSchoolsClasses(42),
      ).rejects.toThrow('Connection lost');
    });

    it('should join roles, classes, and schools tables', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getUserJoinedSchoolsClasses(42);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('roles');
      expect(queryStr).toContain('classes');
      expect(queryStr).toContain('schools');
    });
  });

  describe('getStudents()', () => {
    it('should return students for a given class', async () => {
      const mockStudents = [
        {
          student_id: 1,
          student_name: 'أحمد محمد',
          address: 'شارع النيل',
          photo_link: null,
          phone_numbers: '01012345678',
          district: 'دمنهور',
          notes: null,
        },
        {
          student_id: 2,
          student_name: 'يوسف جورج',
          address: 'شارع المحطة',
          photo_link: 'photo-123',
          phone_numbers: '01098765432, 01111111111',
          district: 'إسكندرية',
          notes: 'ملاحظة',
        },
      ];
      mockedExecuteQuery.mockResolvedValue(mockStudents as any);

      const result = await classesService.getStudents(5);

      expect(result).toEqual(mockStudents);
      expect(result).toHaveLength(2);
    });

    it('should query with the correct class ID', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getStudents(42);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      const [queryStr, params] = mockedExecuteQuery.mock.calls[0]!;
      expect(queryStr).toContain('class_id = ?');
      expect(params).toEqual([42]);
    });

    it('should filter by person_class.type = "student"', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getStudents(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain("type = 'student'");
    });

    it('should return empty array when class has no students', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      const result = await classesService.getStudents(99);

      expect(result).toEqual([]);
    });

    it('should join phone_numbers and districts tables', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getStudents(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('phone_numbers');
      expect(queryStr).toContain('districts');
    });

    it('should group by person_id to aggregate phone numbers', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getStudents(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('group by person_id');
    });

    it('should order by student_name', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getStudents(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('order by student_name');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValue(new Error('DB error') as never);

      await expect(
        classesService.getStudents(1),
      ).rejects.toThrow('DB error');
    });

    it('should use group_concat to aggregate phone numbers', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getStudents(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('group_concat');
      expect(queryStr).toContain('phone_number');
    });
  });

  describe('getTeachers()', () => {
    it('should return teachers for a given class', async () => {
      const mockTeachers = [
        {
          teacher_id: 100,
          teacher_name: 'أبونا داود',
          address: 'الكنيسة',
          photo_link: null,
          phone_numbers: '01234567890',
          district: 'دمنهور',
          notes: null,
        },
      ];
      mockedExecuteQuery.mockResolvedValue(mockTeachers as any);

      const result = await classesService.getTeachers(5);

      expect(result).toEqual(mockTeachers);
      expect(result).toHaveLength(1);
    });

    it('should query with the correct class ID', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getTeachers(42);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      const [queryStr, params] = mockedExecuteQuery.mock.calls[0]!;
      expect(queryStr).toContain('class_id = ?');
      expect(params).toEqual([42]);
    });

    it('should filter by person_class.type = "teacher"', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getTeachers(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain("type = 'teacher'");
    });

    it('should return empty array when class has no teachers', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      const result = await classesService.getTeachers(99);

      expect(result).toEqual([]);
    });

    it('should join phone_numbers and districts tables', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getTeachers(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('phone_numbers');
      expect(queryStr).toContain('districts');
    });

    it('should group by person_id to aggregate phone numbers', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getTeachers(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('group by person_id');
    });

    it('should order by teacher_name', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getTeachers(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('order by teacher_name');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValue(new Error('DB error') as never);

      await expect(
        classesService.getTeachers(1),
      ).rejects.toThrow('DB error');
    });
  });

  describe('getSchools()', () => {
    it('should return all schools ordered by name', async () => {
      const mockSchools = [
        { school_id: 1, school_name: 'خدمة الأحد' },
        { school_id: 2, school_name: 'خدمة السبت' },
      ];
      mockedExecuteQuery.mockResolvedValue(mockSchools as any);

      const result = await classesService.getSchools();

      expect(result).toEqual(mockSchools);
    });

    it('should query with ORDER BY school_name', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getSchools();

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('ORDER BY school_name');
    });

    it('should return empty array when no schools exist', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      const result = await classesService.getSchools();

      expect(result).toEqual([]);
    });
  });

  describe('createSchool()', () => {
    it('should insert a school with the given name', async () => {
      mockedExecuteQuery.mockResolvedValue({ insertId: 1, affectedRows: 1 } as any);

      await classesService.createSchool('خدمة جديدة');

      expect(mockedExecuteQuery).toHaveBeenCalledWith(
        'INSERT INTO schools (school_name) VALUES (?)',
        ['خدمة جديدة'],
      );
    });

    it('should touch classes data version after insert', async () => {
      mockedExecuteQuery.mockResolvedValue({ insertId: 1 } as any);

      await classesService.createSchool('خدمة');

      expect(mockedDataVersionsService.touchClasses).toHaveBeenCalledTimes(1);
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValue(new Error('Duplicate') as never);

      await expect(
        classesService.createSchool('خدمة'),
      ).rejects.toThrow('Duplicate');
    });
  });

  describe('updateSchool()', () => {
    it('should update the school name by ID', async () => {
      mockedExecuteQuery.mockResolvedValue({ affectedRows: 1 } as any);

      await classesService.updateSchool(5, 'اسم جديد');

      expect(mockedExecuteQuery).toHaveBeenCalledWith(
        'UPDATE schools SET school_name = ? WHERE school_id = ?',
        ['اسم جديد', 5],
      );
    });

    it('should touch classes data version after update', async () => {
      mockedExecuteQuery.mockResolvedValue({ affectedRows: 1 } as any);

      await classesService.updateSchool(5, 'اسم');

      expect(mockedDataVersionsService.touchClasses).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteSchool()', () => {
    it('should delete a school and its related data in a transaction', async () => {
      // First query: get class IDs in school
      mockConnection.query
        .mockResolvedValueOnce([[{ class_id: 10 }, { class_id: 11 }]] as never) // class IDs
        .mockResolvedValueOnce([{ affectedRows: 2 }] as never) // delete events
        .mockResolvedValueOnce([{ affectedRows: 2 }] as never) // delete roles
        .mockResolvedValueOnce([{ affectedRows: 2 }] as never) // delete person_class
        .mockResolvedValueOnce([{ affectedRows: 2 }] as never) // delete classes
        .mockResolvedValueOnce([{ affectedRows: 1 }] as never); // delete school

      await classesService.deleteSchool(1);

      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should touch classes data version after successful deletion', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[]] as never) // no classes
        .mockResolvedValueOnce([{ affectedRows: 1 }] as never); // delete school

      await classesService.deleteSchool(1);

      expect(mockedDataVersionsService.touchClasses).toHaveBeenCalledTimes(1);
    });

    it('should rollback and rethrow on error', async () => {
      mockConnection.query.mockRejectedValue(new Error('FK constraint') as never);

      await expect(
        classesService.deleteSchool(1),
      ).rejects.toThrow('FK constraint');

      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    it('should release connection even on error', async () => {
      mockConnection.query.mockRejectedValue(new Error('fail') as never);

      await expect(classesService.deleteSchool(1)).rejects.toThrow();

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should skip class-related deletions when school has no classes', async () => {
      mockConnection.query
        .mockResolvedValueOnce([[]] as never) // no classes
        .mockResolvedValueOnce([{ affectedRows: 1 }] as never); // delete school

      await classesService.deleteSchool(1);

      // Only 2 queries: get classIds + delete school (skip events, roles, person_class, classes)
      expect(mockConnection.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('createClass()', () => {
    it('should insert a class with name and school_id', async () => {
      mockedExecuteQuery.mockResolvedValue({ insertId: 10 } as any);

      await classesService.createClass('فصل جديد', 5);

      expect(mockedExecuteQuery).toHaveBeenCalledWith(
        'INSERT INTO classes (class_name, school_id) VALUES (?, ?)',
        ['فصل جديد', 5],
      );
    });

    it('should touch classes data version after insert', async () => {
      mockedExecuteQuery.mockResolvedValue({ insertId: 10 } as any);

      await classesService.createClass('فصل', 1);

      expect(mockedDataVersionsService.touchClasses).toHaveBeenCalledTimes(1);
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValue(new Error('Duplicate') as never);

      await expect(
        classesService.createClass('فصل', 1),
      ).rejects.toThrow('Duplicate');
    });
  });

  describe('updateClass()', () => {
    it('should update the class name by ID', async () => {
      mockedExecuteQuery.mockResolvedValue({ affectedRows: 1 } as any);

      await classesService.updateClass(10, 'اسم جديد');

      expect(mockedExecuteQuery).toHaveBeenCalledWith(
        'UPDATE classes SET class_name = ? WHERE class_id = ?',
        ['اسم جديد', 10],
      );
    });

    it('should touch classes data version after update', async () => {
      mockedExecuteQuery.mockResolvedValue({ affectedRows: 1 } as any);

      await classesService.updateClass(10, 'اسم');

      expect(mockedDataVersionsService.touchClasses).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteClass()', () => {
    it('should delete a class and related data in a transaction', async () => {
      mockConnection.query.mockResolvedValue([{ affectedRows: 1 }] as never);

      await classesService.deleteClass(10);

      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      // 4 delete queries: events, roles, person_class, classes
      expect(mockConnection.query).toHaveBeenCalledTimes(4);
      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should touch classes data version after deletion', async () => {
      mockConnection.query.mockResolvedValue([{ affectedRows: 1 }] as never);

      await classesService.deleteClass(10);

      expect(mockedDataVersionsService.touchClasses).toHaveBeenCalledTimes(1);
    });

    it('should rollback on error', async () => {
      mockConnection.query.mockRejectedValue(new Error('FK error') as never);

      await expect(classesService.deleteClass(10)).rejects.toThrow('FK error');

      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
      expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    it('should release connection even on error', async () => {
      mockConnection.query.mockRejectedValue(new Error('fail') as never);

      await expect(classesService.deleteClass(10)).rejects.toThrow();

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should delete events, roles, person_class, then the class itself', async () => {
      mockConnection.query.mockResolvedValue([{ affectedRows: 1 }] as never);

      await classesService.deleteClass(10);

      const calls = mockConnection.query.mock.calls;
      expect(calls[0]![0]).toContain('DELETE FROM events');
      expect(calls[1]![0]).toContain('DELETE FROM roles');
      expect(calls[2]![0]).toContain('DELETE FROM person_class');
      expect(calls[3]![0]).toContain('DELETE FROM classes');
    });
  });

  describe('getAllClassesWithSchool()', () => {
    it('should return classes joined with school info', async () => {
      const mockData = [
        { class_id: 1, class_name: 'فصل أولى', school_id: 1, school_name: 'خدمة الأحد' },
        { class_id: 2, class_name: 'فصل تانية', school_id: 1, school_name: 'خدمة الأحد' },
      ];
      mockedExecuteQuery.mockResolvedValue(mockData as any);

      const result = await classesService.getAllClassesWithSchool();

      expect(result).toEqual(mockData);
    });

    it('should order by school_name then class_name', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await classesService.getAllClassesWithSchool();

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('ORDER BY');
      expect(queryStr).toContain('school_name');
      expect(queryStr).toContain('class_name');
    });

    it('should return empty array when no classes exist', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      const result = await classesService.getAllClassesWithSchool();

      expect(result).toEqual([]);
    });
  });
});