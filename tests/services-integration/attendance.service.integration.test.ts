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
import attendanceService from '../../src/services/attendance.service';
import { executeQuery } from '../../src/services/database.service';
import { RowDataPacket } from 'mysql2/promise';

describe('Attendance Service — DB Integration', () => {
  let school: SeedSchool;
  let district: SeedDistrict;
  let account: SeedAccount;

  let schoolId: number;
  let classId: number;
  let districtId: number;

  // Persons
  let student1Id: number;
  let student2Id: number;
  let student3Id: number;
  let teacher1Id: number;
  let teacher2Id: number;

  // Event and occurrences
  let eventId: number;
  let occ1Id: number; // older occurrence
  let occ2Id: number; // latest occurrence

  beforeAll(async () => {
    await createTestDatabase();
  });

  afterAll(async () => {
    await dropTestDatabase();
  });

  beforeEach(async () => {
    await truncateAllTables();

    const hashedPassword = await bcrypt.hash('TestPass1', 10);
    school = { school_name: 'Attendance School' };
    district = { district_name: 'Test District' };
    account = { username: 'att_user', password: hashedPassword, real_name: 'Att User' };

    const baseSeed = await seedTestData({
      schools: [school],
      districts: [district],
      accounts: [account],
    });

    schoolId = baseSeed.schoolIds[0]!;
    districtId = baseSeed.districtIds[0]!;

    // Create class
    const classSeed = await seedTestData({
      classes: [{ class_name: 'Att Class', school_id: schoolId }],
    });
    classId = classSeed.classIds[0]!;

    // Create persons (3 students, 2 teachers)
    const personSeed = await seedTestData({
      persons: [
        { person_name: 'Student A', address: 'Addr A', district_id: districtId },
        { person_name: 'Student B', address: 'Addr B', district_id: districtId },
        { person_name: 'Student C', address: 'Addr C', district_id: districtId },
        { person_name: 'Teacher X', address: 'Addr X', district_id: districtId },
        { person_name: 'Teacher Y', address: 'Addr Y', district_id: districtId },
      ],
    });

    student1Id = personSeed.personIds[0]!;
    student2Id = personSeed.personIds[1]!;
    student3Id = personSeed.personIds[2]!;
    teacher1Id = personSeed.personIds[3]!;
    teacher2Id = personSeed.personIds[4]!;

    // Assign persons to class
    await seedTestData({
      personClasses: [
        { person_id: student1Id, class_id: classId, type: 'student' },
        { person_id: student2Id, class_id: classId, type: 'student' },
        { person_id: student3Id, class_id: classId, type: 'student' },
        { person_id: teacher1Id, class_id: classId, type: 'teacher' },
        { person_id: teacher2Id, class_id: classId, type: 'teacher' },
      ],
    });

    // Create event (type 'all' so it applies to both students and teachers)
    const eventSeed = await seedTestData({
      events: [{ class_id: classId, event_name: 'Daily Attendance', type: 'all' }],
    });
    eventId = eventSeed.eventIds[0]!;

    // Create two occurrences — occ1 is older, occ2 is the latest
    const occSeed = await seedTestData({
      eventOccurrences: [
        { event_id: eventId, occurence_date: '2025-06-01' },
        { event_id: eventId, occurence_date: '2025-06-08' },
      ],
    });
    occ1Id = occSeed.eventOccurrenceIds[0]!;
    occ2Id = occSeed.eventOccurrenceIds[1]!;
  });

  // ---------------------------------------------------------------------------
  // isLatestOccurrence()
  // ---------------------------------------------------------------------------

  describe('isLatestOccurrence()', () => {
    it('should return true for the latest occurrence', async () => {
      const result = await attendanceService.isLatestOccurrence(occ2Id);
      expect(result).toBe(true);
    });

    it('should return false for an older occurrence', async () => {
      const result = await attendanceService.isLatestOccurrence(occ1Id);
      expect(result).toBe(false);
    });

    it('should return false for a non-existent occurrence ID', async () => {
      const result = await attendanceService.isLatestOccurrence(99999);
      expect(result).toBe(false);
    });

    it('should return true when there is only one occurrence for the event', async () => {
      // Create a separate event with a single occurrence
      const evtSeed = await seedTestData({
        events: [{ class_id: classId, event_name: 'Single Occ', type: 'student' }],
      });
      const occSeed = await seedTestData({
        eventOccurrences: [{ event_id: evtSeed.eventIds[0]!, occurence_date: '2025-07-01' }],
      });

      const result = await attendanceService.isLatestOccurrence(occSeed.eventOccurrenceIds[0]!);
      expect(result).toBe(true);
    });

    it('should correctly identify latest when three occurrences exist', async () => {
      // Add a third occurrence that is the newest
      const occSeed = await seedTestData({
        eventOccurrences: [{ event_id: eventId, occurence_date: '2025-06-15' }],
      });
      const occ3Id = occSeed.eventOccurrenceIds[0]!;

      // occ3 is now the latest
      expect(await attendanceService.isLatestOccurrence(occ3Id)).toBe(true);
      // occ2 is no longer the latest
      expect(await attendanceService.isLatestOccurrence(occ2Id)).toBe(false);
      // occ1 is still not the latest
      expect(await attendanceService.isLatestOccurrence(occ1Id)).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // getAttendance()
  // ---------------------------------------------------------------------------

  describe('getAttendance()', () => {
    it('should return all students with attended=0 when no attendance records exist', async () => {
      const result = await attendanceService.getAttendance(occ2Id, 'student');

      const attendance = result.attendance as any[];
      expect(attendance).toHaveLength(3);

      for (const record of attendance) {
        expect(record).toHaveProperty('person_id');
        expect(record).toHaveProperty('person_name');
        // attended should be 0 (or '0') since nobody has been marked
        expect(Number(record.attended)).toBe(0);
      }

      const names = attendance.map((a: any) => a.person_name);
      expect(names).toContain('Student A');
      expect(names).toContain('Student B');
      expect(names).toContain('Student C');
    });

    it('should return all teachers with attended=0 when type is "teacher"', async () => {
      const result = await attendanceService.getAttendance(occ2Id, 'teacher');

      const attendance = result.attendance as any[];
      expect(attendance).toHaveLength(2);

      const names = attendance.map((a: any) => a.person_name);
      expect(names).toContain('Teacher X');
      expect(names).toContain('Teacher Y');

      for (const record of attendance) {
        expect(Number(record.attended)).toBe(0);
      }
    });

    it('should NOT include teachers when type is "student"', async () => {
      const result = await attendanceService.getAttendance(occ2Id, 'student');

      const attendance = result.attendance as any[];
      const names = attendance.map((a: any) => a.person_name);

      expect(names).not.toContain('Teacher X');
      expect(names).not.toContain('Teacher Y');
    });

    it('should NOT include students when type is "teacher"', async () => {
      const result = await attendanceService.getAttendance(occ2Id, 'teacher');

      const attendance = result.attendance as any[];
      const names = attendance.map((a: any) => a.person_name);

      expect(names).not.toContain('Student A');
      expect(names).not.toContain('Student B');
      expect(names).not.toContain('Student C');
    });

    it('should show attended=1 for persons that have attendance records', async () => {
      // Manually insert attendance for student1 and student2
      await executeQuery(
        'INSERT INTO attendance (event_occurence_id, person_id) VALUES (?, ?), (?, ?)',
        [occ2Id, student1Id, occ2Id, student2Id],
      );

      const result = await attendanceService.getAttendance(occ2Id, 'student');
      const attendance = result.attendance as any[];

      expect(attendance).toHaveLength(3);

      const s1 = attendance.find((a: any) => a.person_id === student1Id);
      const s2 = attendance.find((a: any) => a.person_id === student2Id);
      const s3 = attendance.find((a: any) => a.person_id === student3Id);

      expect(Number(s1!.attended)).toBe(1);
      expect(Number(s2!.attended)).toBe(1);
      expect(Number(s3!.attended)).toBe(0);
    });

    it('should return the occurrence date', async () => {
      const result = await attendanceService.getAttendance(occ2Id, 'student');

      expect(result.date).toBeDefined();
      const dateArr = result.date as any[];
      expect(dateArr).toHaveLength(1);
      // The date should correspond to the occurrence we queried
      const dateValue = dateArr[0].occurence_date;
      expect(dateValue).toBeDefined();
    });

    it('should return persons ordered by person_name', async () => {
      const result = await attendanceService.getAttendance(occ2Id, 'student');

      const attendance = result.attendance as any[];
      const names = attendance.map((a: any) => a.person_name);

      // Student A, Student B, Student C — already alphabetical
      expect(names[0]).toBe('Student A');
      expect(names[1]).toBe('Student B');
      expect(names[2]).toBe('Student C');
    });

    it('should return empty attendance array if no persons are assigned to the class for that type', async () => {
      // Create a new class with no persons
      const emptyClassSeed = await seedTestData({
        classes: [{ class_name: 'Empty Class', school_id: schoolId }],
      });
      const emptyEvtSeed = await seedTestData({
        events: [{ class_id: emptyClassSeed.classIds[0]!, event_name: 'Empty Evt', type: 'student' }],
      });
      const emptyOccSeed = await seedTestData({
        eventOccurrences: [{ event_id: emptyEvtSeed.eventIds[0]!, occurence_date: '2025-06-01' }],
      });

      const result = await attendanceService.getAttendance(emptyOccSeed.eventOccurrenceIds[0]!, 'student');
      const attendance = result.attendance as any[];
      expect(attendance).toHaveLength(0);
    });

    it('should return attendance scoped to the specific occurrence (not other occurrences)', async () => {
      // Mark student1 attended in occ1 only
      await executeQuery(
        'INSERT INTO attendance (event_occurence_id, person_id) VALUES (?, ?)',
        [occ1Id, student1Id],
      );

      // Query occ2 — student1 should NOT be marked attended
      const result = await attendanceService.getAttendance(occ2Id, 'student');
      const attendance = result.attendance as any[];
      const s1 = attendance.find((a: any) => a.person_id === student1Id);
      expect(Number(s1!.attended)).toBe(0);

      // Query occ1 — student1 should be marked attended
      const result1 = await attendanceService.getAttendance(occ1Id, 'student');
      const attendance1 = result1.attendance as any[];
      const s1inOcc1 = attendance1.find((a: any) => a.person_id === student1Id);
      expect(Number(s1inOcc1!.attended)).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // patchAttendance()
  // ---------------------------------------------------------------------------

  describe('patchAttendance()', () => {
    describe('marking attended (INSERT IGNORE)', () => {
      it('should mark a student as attended', async () => {
        await attendanceService.patchAttendance(
          [student1Id],
          undefined,
          occ2Id,
          'student',
        );

        const result = await attendanceService.getAttendance(occ2Id, 'student');
        const attendance = result.attendance as any[];
        const s1 = attendance.find((a: any) => a.person_id === student1Id);
        expect(Number(s1!.attended)).toBe(1);
      });

      it('should mark multiple students as attended in one call', async () => {
        await attendanceService.patchAttendance(
          [student1Id, student2Id, student3Id],
          undefined,
          occ2Id,
          'student',
        );

        const result = await attendanceService.getAttendance(occ2Id, 'student');
        const attendance = result.attendance as any[];

        for (const record of attendance) {
          expect(Number(record.attended)).toBe(1);
        }
      });

      it('should be idempotent — marking already-attended student again does not throw', async () => {
        await attendanceService.patchAttendance([student1Id], undefined, occ2Id, 'student');
        // Call again — INSERT IGNORE should silently skip the duplicate
        await expect(
          attendanceService.patchAttendance([student1Id], undefined, occ2Id, 'student'),
        ).resolves.not.toThrow();

        // Still only one attendance record
        const rows = await executeQuery<RowDataPacket[]>(
          'SELECT * FROM attendance WHERE event_occurence_id = ? AND person_id = ?',
          [occ2Id, student1Id],
        );
        expect(rows).toHaveLength(1);
      });

      it('should mark a teacher as attended', async () => {
        await attendanceService.patchAttendance(
          [teacher1Id],
          undefined,
          occ2Id,
          'teacher',
        );

        const result = await attendanceService.getAttendance(occ2Id, 'teacher');
        const attendance = result.attendance as any[];
        const t1 = attendance.find((a: any) => a.person_id === teacher1Id);
        expect(Number(t1!.attended)).toBe(1);
      });
    });

    describe('marking absent (DELETE)', () => {
      it('should mark a previously attended student as absent', async () => {
        // First mark as attended
        await attendanceService.patchAttendance([student1Id], undefined, occ2Id, 'student');

        // Verify attended
        let result = await attendanceService.getAttendance(occ2Id, 'student');
        let s1 = (result.attendance as any[]).find((a: any) => a.person_id === student1Id);
        expect(Number(s1!.attended)).toBe(1);

        // Now mark as absent
        await attendanceService.patchAttendance(undefined, [student1Id], occ2Id, 'student');

        // Verify absent
        result = await attendanceService.getAttendance(occ2Id, 'student');
        s1 = (result.attendance as any[]).find((a: any) => a.person_id === student1Id);
        expect(Number(s1!.attended)).toBe(0);
      });

      it('should not throw when marking an already-absent student as absent', async () => {
        // student1 has no attendance record — marking absent should be a no-op
        await expect(
          attendanceService.patchAttendance(undefined, [student1Id], occ2Id, 'student'),
        ).resolves.not.toThrow();
      });

      it('should mark multiple students as absent', async () => {
        // Mark all 3 attended
        await attendanceService.patchAttendance(
          [student1Id, student2Id, student3Id],
          undefined,
          occ2Id,
          'student',
        );

        // Mark student1 and student3 absent
        await attendanceService.patchAttendance(
          undefined,
          [student1Id, student3Id],
          occ2Id,
          'student',
        );

        const result = await attendanceService.getAttendance(occ2Id, 'student');
        const attendance = result.attendance as any[];

        const s1 = attendance.find((a: any) => a.person_id === student1Id);
        const s2 = attendance.find((a: any) => a.person_id === student2Id);
        const s3 = attendance.find((a: any) => a.person_id === student3Id);

        expect(Number(s1!.attended)).toBe(0);
        expect(Number(s2!.attended)).toBe(1);
        expect(Number(s3!.attended)).toBe(0);
      });
    });

    describe('both attended and absent in same call', () => {
      it('should handle mixed attended and absent arrays', async () => {
        // First mark all as attended
        await attendanceService.patchAttendance(
          [student1Id, student2Id, student3Id],
          undefined,
          occ2Id,
          'student',
        );

        // In one call: mark student1 attended (no-op), mark student3 absent
        await attendanceService.patchAttendance(
          [student1Id],
          [student3Id],
          occ2Id,
          'student',
        );

        const result = await attendanceService.getAttendance(occ2Id, 'student');
        const attendance = result.attendance as any[];

        expect(Number(attendance.find((a: any) => a.person_id === student1Id)!.attended)).toBe(1);
        expect(Number(attendance.find((a: any) => a.person_id === student2Id)!.attended)).toBe(1);
        expect(Number(attendance.find((a: any) => a.person_id === student3Id)!.attended)).toBe(0);
      });
    });

    describe('EDIT_NOT_LATEST guard', () => {
      it('should throw EDIT_NOT_LATEST when patching an older occurrence', async () => {
        await expect(
          attendanceService.patchAttendance([student1Id], undefined, occ1Id, 'student'),
        ).rejects.toThrow('EDIT_NOT_LATEST');
      });

      it('should NOT throw when patching the latest occurrence', async () => {
        await expect(
          attendanceService.patchAttendance([student1Id], undefined, occ2Id, 'student'),
        ).resolves.not.toThrow();
      });

      it('should throw EDIT_NOT_LATEST for teacher type on older occurrence too', async () => {
        await expect(
          attendanceService.patchAttendance([teacher1Id], undefined, occ1Id, 'teacher'),
        ).rejects.toThrow('EDIT_NOT_LATEST');
      });
    });

    describe('cross-class injection prevention', () => {
      it('should NOT insert attendance for a person who is not in the class', async () => {
        // Create a person in a DIFFERENT class
        const otherClassSeed = await seedTestData({
          classes: [{ class_name: 'Other Class', school_id: schoolId }],
        });

        const otherPersonSeed = await seedTestData({
          persons: [
            { person_name: 'Outsider', address: 'Addr', district_id: districtId },
          ],
        });

        await seedTestData({
          personClasses: [
            {
              person_id: otherPersonSeed.personIds[0]!,
              class_id: otherClassSeed.classIds[0]!,
              type: 'student',
            },
          ],
        });

        const outsiderId = otherPersonSeed.personIds[0]!;

        // Try to mark the outsider as attended in the main class's occurrence
        await attendanceService.patchAttendance([outsiderId], undefined, occ2Id, 'student');

        // The INSERT IGNORE with the subquery check should prevent this
        const rows = await executeQuery<RowDataPacket[]>(
          'SELECT * FROM attendance WHERE event_occurence_id = ? AND person_id = ?',
          [occ2Id, outsiderId],
        );
        expect(rows).toHaveLength(0);
      });

      it('should NOT insert attendance for a teacher when type is "student"', async () => {
        // teacher1Id is in the class as a teacher, not as a student
        await attendanceService.patchAttendance([teacher1Id], undefined, occ2Id, 'student');

        const rows = await executeQuery<RowDataPacket[]>(
          'SELECT * FROM attendance WHERE event_occurence_id = ? AND person_id = ?',
          [occ2Id, teacher1Id],
        );
        // The subquery checks person_class type, so teacher should not be insertable as student
        expect(rows).toHaveLength(0);
      });

      it('should NOT insert attendance for a student when type is "teacher"', async () => {
        // student1Id is in the class as a student, not as a teacher
        await attendanceService.patchAttendance([student1Id], undefined, occ2Id, 'teacher');

        const rows = await executeQuery<RowDataPacket[]>(
          'SELECT * FROM attendance WHERE event_occurence_id = ? AND person_id = ?',
          [occ2Id, student1Id],
        );
        expect(rows).toHaveLength(0);
      });
    });

    describe('no-op calls', () => {
      it('should not throw when both attended and absent are undefined', async () => {
        await expect(
          attendanceService.patchAttendance(undefined, undefined, occ2Id, 'student'),
        ).resolves.not.toThrow();
      });

      it('should not throw when both attended and absent are empty arrays', async () => {
        await expect(
          attendanceService.patchAttendance([], [], occ2Id, 'student'),
        ).resolves.not.toThrow();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // End-to-end: full attendance lifecycle
  // ---------------------------------------------------------------------------

  describe('end-to-end: attendance lifecycle', () => {
    it('should support a full attendance workflow: check → mark → verify → change → verify', async () => {
      // 1. Initial state — nobody attended
      let result = await attendanceService.getAttendance(occ2Id, 'student');
      let attendance = result.attendance as any[];
      expect(attendance).toHaveLength(3);
      for (const record of attendance) {
        expect(Number(record.attended)).toBe(0);
      }

      // 2. Mark all students as attended
      await attendanceService.patchAttendance(
        [student1Id, student2Id, student3Id],
        undefined,
        occ2Id,
        'student',
      );

      result = await attendanceService.getAttendance(occ2Id, 'student');
      attendance = result.attendance as any[];
      for (const record of attendance) {
        expect(Number(record.attended)).toBe(1);
      }

      // 3. Student C was actually absent — correct the record
      await attendanceService.patchAttendance(
        undefined,
        [student3Id],
        occ2Id,
        'student',
      );

      result = await attendanceService.getAttendance(occ2Id, 'student');
      attendance = result.attendance as any[];
      expect(Number(attendance.find((a: any) => a.person_id === student1Id)!.attended)).toBe(1);
      expect(Number(attendance.find((a: any) => a.person_id === student2Id)!.attended)).toBe(1);
      expect(Number(attendance.find((a: any) => a.person_id === student3Id)!.attended)).toBe(0);

      // 4. Also record teacher attendance
      await attendanceService.patchAttendance(
        [teacher1Id],
        undefined,
        occ2Id,
        'teacher',
      );

      result = await attendanceService.getAttendance(occ2Id, 'teacher');
      attendance = result.attendance as any[];
      expect(Number(attendance.find((a: any) => a.person_id === teacher1Id)!.attended)).toBe(1);
      expect(Number(attendance.find((a: any) => a.person_id === teacher2Id)!.attended)).toBe(0);

      // 5. Verify student attendance is independent of teacher attendance
      result = await attendanceService.getAttendance(occ2Id, 'student');
      attendance = result.attendance as any[];
      expect(attendance).toHaveLength(3); // still 3 students
      expect(Number(attendance.find((a: any) => a.person_id === student1Id)!.attended)).toBe(1);

      // 6. Verify that occ1 (older) still has no attendance
      result = await attendanceService.getAttendance(occ1Id, 'student');
      attendance = result.attendance as any[];
      for (const record of attendance) {
        expect(Number(record.attended)).toBe(0);
      }
    });

    it('should prevent editing an older occurrence after a new one is added', async () => {
      // Mark attendance on latest (occ2)
      await attendanceService.patchAttendance(
        [student1Id],
        undefined,
        occ2Id,
        'student',
      );

      // Add a new occurrence (now occ2 is no longer the latest)
      await seedTestData({
        eventOccurrences: [{ event_id: eventId, occurence_date: '2025-06-15' }],
      });

      // Trying to edit occ2 should now throw EDIT_NOT_LATEST
      await expect(
        attendanceService.patchAttendance([student2Id], undefined, occ2Id, 'student'),
      ).rejects.toThrow('EDIT_NOT_LATEST');

      // But the original attendance on occ2 should still be intact
      const result = await attendanceService.getAttendance(occ2Id, 'student');
      const attendance = result.attendance as any[];
      const s1 = attendance.find((a: any) => a.person_id === student1Id);
      expect(Number(s1!.attended)).toBe(1);
    });
  });
});