import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before importing the service
jest.mock('../../src/services/database.service');
jest.mock('../../src/services/data-versions.service');
jest.mock('@flowdegree/arabic-strings', () => ({
  sanitize: jest.fn((str: string) => `sanitized_${str}`),
}));

import personsService from '../../src/services/persons.service';
import { executeQuery, getConnection } from '../../src/services/database.service';
import dataVersionsService from '../../src/services/data-versions.service';
import * as arabic from '@flowdegree/arabic-strings';

const mockedExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
const mockedGetConnection = getConnection as jest.MockedFunction<typeof getConnection>;
const mockedDataVersionsService = dataVersionsService as jest.Mocked<typeof dataVersionsService>;
const mockedArabicSanitize = arabic.sanitize as jest.MockedFunction<typeof arabic.sanitize>;

function createMockConnection() {
  const mockConnection = {
    beginTransaction: jest.fn().mockResolvedValue(undefined as never),
    commit: jest.fn().mockResolvedValue(undefined as never),
    rollback: jest.fn().mockResolvedValue(undefined as never),
    release: jest.fn(),
    // Default: return iterable so fire-and-forget deletePersonIfNotInAnyClass
    // (which destructures `const [result] = await connection.query(...)`) won't crash
    query: jest.fn().mockResolvedValue([{ affectedRows: 0 }] as never),
    execute: jest.fn(),
  };
  return mockConnection;
}

describe('Persons Service', () => {
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockConnection = createMockConnection();
    mockedGetConnection.mockResolvedValue(mockConnection as any);
    mockedDataVersionsService.touch.mockReturnValue(Promise.resolve() as any);
    mockedDataVersionsService.classStudentsKey.mockImplementation((id: number) => `class_${id}_students`);
    mockedDataVersionsService.classTeachersKey.mockImplementation((id: number) => `class_${id}_teachers`);
    mockedArabicSanitize.mockImplementation((str: string) => `sanitized_${str}`);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ─── createPerson() ───────────────────────────────────────────────────────

  describe('createPerson()', () => {
    const baseStudentData = {
      name: ' أحمد ',
      address: ' القاهرة ',
      district_id: 5,
      notes: ' ملاحظة ',
      phone_number: ' 01012345678 ',
      class_id: 10,
    };

    it('should insert person with all fields for a student', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 42 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never);

      await personsService.createPerson('student', baseStudentData);

      // Person insert
      const personCall = mockConnection.query.mock.calls[0]!;
      expect(personCall[0]).toContain('insert into persons');
      expect(personCall[1]).toEqual([
        'أحمد',
        'sanitized_أحمد',
        'القاهرة',
        5,
        'ملاحظة',
      ]);
    });

    it('should insert a phone number record after person creation', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 42 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never);

      await personsService.createPerson('student', baseStudentData);

      const phoneCall = mockConnection.query.mock.calls[1]!;
      expect(phoneCall[0]).toContain('insert into phone_numbers');
      expect(phoneCall[1]).toEqual([42, '01012345678']);
    });

    it('should insert second phone number when provided', async () => {
      const dataWithSecondPhone = {
        ...baseStudentData,
        second_phone_number: ' 01098765432 ',
      };

      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 42 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never) // second phone
        .mockResolvedValueOnce([{}] as never); // person_class

      await personsService.createPerson('student', dataWithSecondPhone);

      expect(mockConnection.query).toHaveBeenCalledTimes(4);
      const secondPhoneCall = mockConnection.query.mock.calls[2]!;
      expect(secondPhoneCall[0]).toContain('insert into phone_numbers');
      expect(secondPhoneCall[1]).toEqual([42, '01098765432']);
    });

    it('should not insert second phone number when not provided', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 42 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never);

      await personsService.createPerson('student', baseStudentData);

      // 3 queries: person, phone, person_class (no second phone)
      expect(mockConnection.query).toHaveBeenCalledTimes(3);
    });

    it('should insert person_class record with correct type', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 42 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never);

      await personsService.createPerson('student', baseStudentData);

      const personClassCall = mockConnection.query.mock.calls[2]!;
      expect(personClassCall[0]).toContain('insert into person_class');
      expect(personClassCall[1]).toEqual([42, 10, 'student']);
    });

    it('should insert person_class with type "teacher" for teacher creation', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 55 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never);

      await personsService.createPerson('teacher', baseStudentData);

      const personClassCall = mockConnection.query.mock.calls[2]!;
      expect(personClassCall[1]).toEqual([55, 10, 'teacher']);
    });

    it('should sanitize the name using arabic.sanitize for normalized_person_name', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 1 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never);

      await personsService.createPerson('student', baseStudentData);

      expect(mockedArabicSanitize).toHaveBeenCalledWith('أحمد');
    });

    it('should touch data version with classStudentsKey for student type', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 1 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never);

      await personsService.createPerson('student', baseStudentData);

      expect(mockedDataVersionsService.classStudentsKey).toHaveBeenCalledWith(10);
      expect(mockedDataVersionsService.touch).toHaveBeenCalledWith('class_10_students');
    });

    it('should touch data version with classTeachersKey for teacher type', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 1 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never);

      await personsService.createPerson('teacher', baseStudentData);

      expect(mockedDataVersionsService.classTeachersKey).toHaveBeenCalledWith(10);
      expect(mockedDataVersionsService.touch).toHaveBeenCalledWith('class_10_teachers');
    });

    it('should begin a transaction before any inserts', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 1 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never);

      await personsService.createPerson('student', baseStudentData);

      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      const beginOrder = mockConnection.beginTransaction.mock.invocationCallOrder[0]!;
      const firstQueryOrder = mockConnection.query.mock.invocationCallOrder[0]!;
      expect(beginOrder).toBeLessThan(firstQueryOrder);
    });

    it('should commit the transaction after all inserts', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 1 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never);

      await personsService.createPerson('student', baseStudentData);

      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });

    it('should rollback and rethrow on DB error', async () => {
      mockConnection.query.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(personsService.createPerson('student', baseStudentData)).rejects.toThrow('DB error');
      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    });

    it('should release the connection after success', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 1 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never);

      await personsService.createPerson('student', baseStudentData);

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should release the connection after error', async () => {
      mockConnection.query.mockRejectedValueOnce(new Error('fail') as never);

      await expect(personsService.createPerson('student', baseStudentData)).rejects.toThrow();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should not throw if touch rejects (caught with .catch)', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 1 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never);
      mockedDataVersionsService.touch.mockReturnValue(Promise.reject(new Error('touch error')) as any);

      // Should not reject
      await expect(personsService.createPerson('student', baseStudentData)).resolves.toBeUndefined();
    });

    it('should trim whitespace from name, address, phone_number, and notes', async () => {
      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 1 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never);

      await personsService.createPerson('student', baseStudentData);

      const personParams = mockConnection.query.mock.calls[0]![1] as any[];
      expect(personParams[0]).toBe('أحمد'); // name trimmed
      expect(personParams[2]).toBe('القاهرة'); // address trimmed
      expect(personParams[4]).toBe('ملاحظة'); // notes trimmed

      const phoneParams = mockConnection.query.mock.calls[1]![1] as any[];
      expect(phoneParams[1]).toBe('01012345678'); // phone trimmed
    });

    it('should handle undefined notes gracefully', async () => {
      const dataWithoutNotes = {
        ...baseStudentData,
        notes: undefined,
      };

      mockConnection.query
        .mockResolvedValueOnce([{ insertId: 1 }] as never)
        .mockResolvedValueOnce([{}] as never)
        .mockResolvedValueOnce([{}] as never);

      await personsService.createPerson('student', dataWithoutNotes as any);

      const personParams = mockConnection.query.mock.calls[0]![1] as any[];
      expect(personParams[4]).toBeUndefined();
    });
  });

  // ─── updatePerson() ───────────────────────────────────────────────────────

  describe('updatePerson()', () => {
    const baseUpdateData = {
      name: ' محمد ',
      address: ' الإسكندرية ',
      district_id: 3,
      notes: ' ملاحظة جديدة ',
      phone_number: ' 01111111111 ',
      class_id: undefined as undefined,
    };

    it('should update person name, address, district, notes', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);
      mockedExecuteQuery.mockResolvedValueOnce([{ phone_number_id: 100 }] as any);
      mockConnection.query.mockResolvedValueOnce([{}] as never); // update phone
      mockConnection.query.mockResolvedValue(undefined as never); // commit (ignored)
      mockedExecuteQuery.mockResolvedValueOnce([] as any); // allClasses for touch

      const result = await personsService.updatePerson(7, baseUpdateData);

      const updateCall = mockConnection.query.mock.calls[0]!;
      expect(updateCall[0]).toContain('update persons');
      expect(updateCall[1]).toContain('محمد');
      expect(updateCall[1]).toContain('sanitized_محمد');
      expect(updateCall[1]).toContain('الإسكندرية');
      expect(updateCall[1]).toContain(3);
      expect(result).toBe(1);
    });

    it('should return 0 if person is not a student (affectedRows 0)', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 0 }] as never);

      const result = await personsService.updatePerson(7, baseUpdateData);

      expect(result).toBe(0);
      // Should not proceed to phone queries
      expect(mockedExecuteQuery).not.toHaveBeenCalled();
    });

    it('should check that person has type student in the update query', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);
      mockedExecuteQuery.mockResolvedValueOnce([{ phone_number_id: 100 }] as any);
      mockConnection.query.mockResolvedValueOnce([{}] as never);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.updatePerson(7, baseUpdateData);

      const updateQuery = mockConnection.query.mock.calls[0]![0] as string;
      expect(updateQuery).toContain("type='student'");
    });

    it('should update existing first phone number', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);
      mockedExecuteQuery.mockResolvedValueOnce([{ phone_number_id: 100 }] as any);
      mockConnection.query.mockResolvedValueOnce([{}] as never);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.updatePerson(7, baseUpdateData);

      const phoneUpdateCall = mockConnection.query.mock.calls[1]!;
      expect(phoneUpdateCall[0]).toContain('update phone_numbers');
      expect(phoneUpdateCall[1]).toEqual(['01111111111', 7, 100]);
    });

    it('should add second phone when none existed previously', async () => {
      const dataWithSecondPhone = {
        ...baseUpdateData,
        second_phone_number: ' 01222222222 ',
      };

      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);
      // Only one phone number id exists
      mockedExecuteQuery.mockResolvedValueOnce([{ phone_number_id: 100 }] as any);
      mockConnection.query.mockResolvedValueOnce([{}] as never); // update first phone
      mockConnection.query.mockResolvedValueOnce([{}] as never); // insert second phone
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.updatePerson(7, dataWithSecondPhone);

      const insertSecondPhoneCall = mockConnection.query.mock.calls[2]!;
      expect(insertSecondPhoneCall[0]).toContain('insert into phone_numbers');
      expect(insertSecondPhoneCall[1]).toEqual([7, '01222222222']);
    });

    it('should update existing second phone number', async () => {
      const dataWithSecondPhone = {
        ...baseUpdateData,
        second_phone_number: ' 01333333333 ',
      };

      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);
      // Two phone number ids exist
      mockedExecuteQuery.mockResolvedValueOnce([
        { phone_number_id: 100 },
        { phone_number_id: 101 },
      ] as any);
      mockConnection.query.mockResolvedValueOnce([{}] as never); // update first phone
      mockConnection.query.mockResolvedValueOnce([{}] as never); // update second phone
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.updatePerson(7, dataWithSecondPhone);

      const updateSecondCall = mockConnection.query.mock.calls[2]!;
      expect(updateSecondCall[0]).toContain('update phone_numbers');
      expect(updateSecondCall[1]).toEqual(['01333333333', 7, 101]);
    });

    it('should remove second phone when it existed but is not provided', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);
      // Two phone number ids exist
      mockedExecuteQuery.mockResolvedValueOnce([
        { phone_number_id: 100 },
        { phone_number_id: 101 },
      ] as any);
      mockConnection.query.mockResolvedValueOnce([{}] as never); // update first phone
      mockConnection.query.mockResolvedValueOnce([{}] as never); // delete second phone
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.updatePerson(7, baseUpdateData);

      const deleteSecondCall = mockConnection.query.mock.calls[2]!;
      expect(deleteSecondCall[0]).toContain('delete from phone_numbers');
      expect(deleteSecondCall[1]).toEqual([101]);
    });

    it('should rollback and rethrow on DB error', async () => {
      mockConnection.query.mockRejectedValueOnce(new Error('DB fail') as never);

      await expect(personsService.updatePerson(7, baseUpdateData)).rejects.toThrow('DB fail');
      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    });

    it('should release connection after success', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);
      mockedExecuteQuery.mockResolvedValueOnce([{ phone_number_id: 100 }] as any);
      mockConnection.query.mockResolvedValueOnce([{}] as never);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.updatePerson(7, baseUpdateData);

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should release connection after error', async () => {
      mockConnection.query.mockRejectedValueOnce(new Error('fail') as never);

      await expect(personsService.updatePerson(7, baseUpdateData)).rejects.toThrow();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should sanitize name using arabic.sanitize', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);
      mockedExecuteQuery.mockResolvedValueOnce([{ phone_number_id: 100 }] as any);
      mockConnection.query.mockResolvedValueOnce([{}] as never);
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.updatePerson(7, baseUpdateData);

      expect(mockedArabicSanitize).toHaveBeenCalledWith('محمد');
    });

    it('should touch data versions for all classes the person belongs to', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);
      mockedExecuteQuery
        .mockResolvedValueOnce([{ phone_number_id: 100 }] as any) // phoneNumbersIds
        .mockResolvedValueOnce([
          { class_id: 10, type: 'student' },
          { class_id: 20, type: 'teacher' },
        ] as any); // allClasses
      mockConnection.query.mockResolvedValueOnce([{}] as never);

      await personsService.updatePerson(7, baseUpdateData);

      expect(mockedDataVersionsService.classStudentsKey).toHaveBeenCalledWith(10);
      expect(mockedDataVersionsService.classTeachersKey).toHaveBeenCalledWith(20);
      expect(mockedDataVersionsService.touch).toHaveBeenCalledWith(
        'class_10_students',
        'class_20_teachers',
      );
    });

    it('should not touch data versions when allClasses is empty', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);
      mockedExecuteQuery
        .mockResolvedValueOnce([{ phone_number_id: 100 }] as any)
        .mockResolvedValueOnce([] as any); // no classes
      mockConnection.query.mockResolvedValueOnce([{}] as never);

      await personsService.updatePerson(7, baseUpdateData);

      expect(mockedDataVersionsService.touch).not.toHaveBeenCalled();
    });

    it('should pass personId twice to the update query (for WHERE and subselect)', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);
      mockedExecuteQuery
        .mockResolvedValueOnce([{ phone_number_id: 100 }] as any)
        .mockResolvedValueOnce([] as any);
      mockConnection.query.mockResolvedValueOnce([{}] as never);

      await personsService.updatePerson(42, baseUpdateData);

      const updateParams = mockConnection.query.mock.calls[0]![1] as any[];
      // personId appears as the 6th and 7th params
      expect(updateParams[5]).toBe(42);
      expect(updateParams[6]).toBe(42);
    });

    it('should begin a transaction before any updates', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);
      mockedExecuteQuery
        .mockResolvedValueOnce([{ phone_number_id: 100 }] as any)
        .mockResolvedValueOnce([] as any);
      mockConnection.query.mockResolvedValueOnce([{}] as never);

      await personsService.updatePerson(7, baseUpdateData);

      expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
      const beginOrder = mockConnection.beginTransaction.mock.invocationCallOrder[0]!;
      const firstQueryOrder = mockConnection.query.mock.invocationCallOrder[0]!;
      expect(beginOrder).toBeLessThan(firstQueryOrder);
    });

    it('should commit the transaction after all operations', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);
      mockedExecuteQuery
        .mockResolvedValueOnce([{ phone_number_id: 100 }] as any)
        .mockResolvedValueOnce([] as any);
      mockConnection.query.mockResolvedValueOnce([{}] as never);

      await personsService.updatePerson(7, baseUpdateData);

      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getPersonById() ──────────────────────────────────────────────────────

  describe('getPersonById()', () => {
    it('should return person with joined district and phone numbers', async () => {
      const mockPerson = [
        {
          person_id: 7,
          person_name: 'أحمد',
          address: 'القاهرة',
          photo_link: null,
          notes: 'ملاحظة',
          district_name: 'المنطقة',
          phone_numbers: '01012345678, 01098765432',
        },
      ];
      mockedExecuteQuery.mockResolvedValueOnce(mockPerson as any);

      const result = await personsService.getPersonById(7);

      expect(result).toEqual(mockPerson);
    });

    it('should pass the personId to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.getPersonById(42);

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42]);
    });

    it('should query with LEFT JOIN on districts and phone_numbers', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.getPersonById(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('left join districts');
      expect(queryStr).toContain('left join phone_numbers');
    });

    it('should group by person_id to aggregate phone numbers', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.getPersonById(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('group by person_id');
    });

    it('should return empty array for non-existing person', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await personsService.getPersonById(9999);

      expect(result).toEqual([]);
    });

    it('should use group_concat for phone_numbers', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.getPersonById(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('group_concat');
      expect(queryStr).toContain('phone_number');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(personsService.getPersonById(1)).rejects.toThrow('DB error');
    });
  });

  // ─── searchByName() ───────────────────────────────────────────────────────

  describe('searchByName()', () => {
    it('should return matching persons with normalized Arabic search', async () => {
      const mockResults = [
        { person_id: 1, person_name: 'أحمد', photo_link: null, classIds: '10, 20' },
      ];
      mockedExecuteQuery.mockResolvedValueOnce(mockResults as any);

      const result = await personsService.searchByName('أحمد', 'student', [10, 20]);

      expect(result).toEqual(mockResults);
    });

    it('should return empty array immediately when classIds is empty', async () => {
      const result = await personsService.searchByName('أحمد', 'student', []);

      expect(result).toEqual([]);
      expect(mockedExecuteQuery).not.toHaveBeenCalled();
    });

    it('should apply arabic.sanitize to the search name', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.searchByName('أحمد', 'student', [10]);

      expect(mockedArabicSanitize).toHaveBeenCalledWith('أحمد');
    });

    it('should create wildcard search term with % between words', async () => {
      mockedArabicSanitize.mockReturnValueOnce('sanitized_أحمد محمد');
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.searchByName('أحمد محمد', 'student', [10]);

      const params = mockedExecuteQuery.mock.calls[0]![1] as any[];
      const searchTerm = params[params.length - 1];
      expect(searchTerm).toBe('%sanitized_أحمد%محمد%');
    });

    it('should pass type as first parameter', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.searchByName('أحمد', 'teacher', [10]);

      const params = mockedExecuteQuery.mock.calls[0]![1] as any[];
      expect(params[0]).toBe('teacher');
    });

    it('should pass classIds as individual parameters', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.searchByName('أحمد', 'student', [10, 20, 30]);

      const params = mockedExecuteQuery.mock.calls[0]![1] as any[];
      expect(params[1]).toBe(10);
      expect(params[2]).toBe(20);
      expect(params[3]).toBe(30);
    });

    it('should generate correct number of placeholders for classIds', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.searchByName('أحمد', 'student', [1, 2, 3]);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('class_id in (?,?,?)');
    });

    it('should use COALESCE(normalized_person_name, person_name) for search', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.searchByName('أحمد', 'student', [10]);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('COALESCE(normalized_person_name, person_name)');
    });

    it('should use LIKE for search matching', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.searchByName('أحمد', 'student', [10]);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('like ?');
    });

    it('should use DISTINCT to avoid duplicate person results', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.searchByName('أحمد', 'student', [10]);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr.toLowerCase()).toContain('select distinct');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(personsService.searchByName('أحمد', 'student', [10])).rejects.toThrow('DB error');
    });
  });

  // ─── updatePersonPhoto() ──────────────────────────────────────────────────

  describe('updatePersonPhoto()', () => {
    it('should update photo_link column for the person', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({ affectedRows: 1 } as any);

      const result = await personsService.updatePersonPhoto(7, 'https://example.com/photo.jpg');

      expect(result).toEqual({ affectedRows: 1 });
    });

    it('should pass correct params to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);

      await personsService.updatePersonPhoto(42, 'https://cdn.com/img.png');

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual(['https://cdn.com/img.png', 42]);
    });

    it('should use UPDATE query on persons table', async () => {
      mockedExecuteQuery.mockResolvedValueOnce({} as any);

      await personsService.updatePersonPhoto(1, 'link');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('update persons');
      expect(queryStr).toContain('photo_link');
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(personsService.updatePersonPhoto(1, 'link')).rejects.toThrow('DB error');
    });
  });

  // ─── getPersonClasses() ───────────────────────────────────────────────────

  describe('getPersonClasses()', () => {
    it('should return class list with school names for a person', async () => {
      const mockClasses = [
        { class_id: 10, class_name: 'الصف الأول', school_name: 'مدرسة 1', type: 'student' },
        { class_id: 20, class_name: 'الصف الثاني', school_name: 'مدرسة 2', type: 'teacher' },
      ];
      mockedExecuteQuery.mockResolvedValueOnce(mockClasses as any);

      const result = await personsService.getPersonClasses(7);

      expect(result).toEqual(mockClasses);
    });

    it('should pass personId to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.getPersonClasses(42);

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42]);
    });

    it('should join person_class, classes, and schools tables', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.getPersonClasses(1);

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('person_class');
      expect(queryStr).toContain('inner join classes');
      expect(queryStr).toContain('inner join schools');
    });

    it('should return empty array when person has no classes', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await personsService.getPersonClasses(9999);

      expect(result).toEqual([]);
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(personsService.getPersonClasses(1)).rejects.toThrow('DB error');
    });
  });

  // ─── getJoinedClasses() ───────────────────────────────────────────────────

  describe('getJoinedClasses()', () => {
    it('should return class_id list for a person and type', async () => {
      const mockResults = [{ class_id: 10 }, { class_id: 20 }];
      mockedExecuteQuery.mockResolvedValueOnce(mockResults as any);

      const result = await personsService.getJoinedClasses(7, 'student');

      expect(result).toEqual(mockResults);
    });

    it('should pass personId and type to the query', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.getJoinedClasses(42, 'teacher');

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual([42, 'teacher']);
    });

    it('should query person_class table', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.getJoinedClasses(1, 'student');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('person_class');
    });

    it('should filter by both person_id and type', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      await personsService.getJoinedClasses(1, 'student');

      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('person_id');
      expect(queryStr).toContain('type');
    });

    it('should return empty array for person with no classes of that type', async () => {
      mockedExecuteQuery.mockResolvedValueOnce([] as any);

      const result = await personsService.getJoinedClasses(9999, 'student');

      expect(result).toEqual([]);
    });

    it('should propagate DB errors', async () => {
      mockedExecuteQuery.mockRejectedValueOnce(new Error('DB error') as never);

      await expect(personsService.getJoinedClasses(1, 'student')).rejects.toThrow('DB error');
    });
  });

  // ─── unassignPerson() ─────────────────────────────────────────────────────

  describe('unassignPerson()', () => {
    it('should delete the person_class record and return affectedRows', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);

      const result = await personsService.unassignPerson(7, 10, 'student');

      expect(result).toBe(1);
    });

    it('should return 0 when person_class record not found', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 0 }] as never);

      const result = await personsService.unassignPerson(9999, 10, 'student');

      expect(result).toBe(0);
    });

    it('should pass personId, classId, and type to the delete query', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);

      await personsService.unassignPerson(7, 10, 'teacher');

      const deleteCall = mockConnection.query.mock.calls[0]!;
      expect(deleteCall[0]).toContain('delete from person_class');
      expect(deleteCall[1]).toEqual([7, 10, 'teacher']);
    });

    it('should begin a transaction before delete', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);

      await personsService.unassignPerson(7, 10, 'student');

      // beginTransaction is called at least once for unassignPerson itself;
      // deletePersonIfNotInAnyClass (fire-and-forget) may also call it on the same mock
      expect(mockConnection.beginTransaction).toHaveBeenCalled();
      const beginOrder = mockConnection.beginTransaction.mock.invocationCallOrder[0]!;
      const deleteOrder = mockConnection.query.mock.invocationCallOrder[0]!;
      expect(beginOrder).toBeLessThan(deleteOrder);
    });

    it('should commit the transaction after successful delete', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);

      await personsService.unassignPerson(7, 10, 'student');

      expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });

    it('should not commit when affectedRows is 0', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 0 }] as never);

      await personsService.unassignPerson(7, 10, 'student');

      expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    it('should touch data version with classStudentsKey for student type', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);

      await personsService.unassignPerson(7, 10, 'student');

      expect(mockedDataVersionsService.classStudentsKey).toHaveBeenCalledWith(10);
      expect(mockedDataVersionsService.touch).toHaveBeenCalledWith('class_10_students');
    });

    it('should touch data version with classTeachersKey for teacher type', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);

      await personsService.unassignPerson(7, 10, 'teacher');

      expect(mockedDataVersionsService.classTeachersKey).toHaveBeenCalledWith(10);
      expect(mockedDataVersionsService.touch).toHaveBeenCalledWith('class_10_teachers');
    });

    it('should not touch data version when affectedRows is 0', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 0 }] as never);

      await personsService.unassignPerson(7, 10, 'student');

      expect(mockedDataVersionsService.touch).not.toHaveBeenCalled();
    });

    it('should rollback and rethrow on DB error', async () => {
      mockConnection.query.mockRejectedValueOnce(new Error('DB fail') as never);

      await expect(personsService.unassignPerson(7, 10, 'student')).rejects.toThrow('DB fail');
      expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
    });

    it('should release connection after success', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);

      await personsService.unassignPerson(7, 10, 'student');

      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should release connection after error', async () => {
      mockConnection.query.mockRejectedValueOnce(new Error('fail') as never);

      await expect(personsService.unassignPerson(7, 10, 'student')).rejects.toThrow();
      expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should not throw if touch rejects (caught with .catch)', async () => {
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);
      mockedDataVersionsService.touch.mockReturnValue(Promise.reject(new Error('touch error')) as any);

      await expect(personsService.unassignPerson(7, 10, 'student')).resolves.toBe(1);
    });

    it('should call deletePersonIfNotInAnyClass after successful unassign', async () => {
      // deletePersonIfNotInAnyClass is fire-and-forget. It calls getConnection()
      // to get a NEW connection, then runs a DELETE query.
      // The default mockConnection (from beforeEach) is returned for both calls.
      // Since query has a default mockResolvedValue returning [{ affectedRows: 0 }],
      // the destructuring in deletePersonIfNotInAnyClass will work.
      mockConnection.query.mockResolvedValueOnce([{ affectedRows: 1 }] as never);

      await personsService.unassignPerson(7, 10, 'student');

      // deletePersonIfNotInAnyClass fires asynchronously, give it a tick
      await new Promise((resolve) => setTimeout(resolve, 50));

      // getConnection is called twice: once for unassignPerson, once for deletePersonIfNotInAnyClass
      expect(mockedGetConnection).toHaveBeenCalledTimes(2);

      // The second query call (index 1) is from deletePersonIfNotInAnyClass
      // (index 0 is the person_class delete from unassignPerson)
      const deleteQuery = mockConnection.query.mock.calls[1]![0] as string;
      expect(deleteQuery).toContain('delete from persons');
      expect(deleteQuery).toContain('not in');
    });
  });
});