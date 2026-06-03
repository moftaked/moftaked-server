import { RowDataPacket, ResultSetHeader } from 'mysql2';
import { executeQuery, getConnection } from './database.service';
import dataVersionsService from './data-versions.service';
import accountsService from './accounts.service';

async function getUserJoinedSchoolsClasses(userId: number) {
  const isAdmin = await accountsService.isAdmin(userId);
  if (isAdmin) {
    const allClasses = await executeQuery<RowDataPacket[]>(
      `SELECT
        s.school_id,
        s.school_name,
        c.class_id,
        c.class_name,
        'admin' AS role
      FROM classes c
      INNER JOIN schools s ON s.school_id = c.school_id
      ORDER BY s.school_name, c.class_name`,
    );

    const classes: {
      school_id: number;
      school_name: string;
      role: 'admin' | 'manager' | 'leader' | 'teacher';
      classes: { class_id: number; class_name: string }[];
    }[] = [];

    for (const row of allClasses) {
      let school = classes.find(c => c.school_id === row['school_id']);
      if (!school) {
        school = {
          school_id: row['school_id'],
          school_name: row['school_name'],
          role: 'admin',
          classes: [],
        };
        classes.push(school);
      }
      school.classes.push({ class_id: row['class_id'], class_name: row['class_name'] });
    }
    return classes;
  }

  const classRows = await executeQuery<RowDataPacket[]>(
    `SELECT
      classes.school_id,
      school_name,
      classes.class_id,
      class_name,
      role
      FROM roles
      INNER JOIN classes ON classes.class_id = roles.class_id
      INNER JOIN schools ON schools.school_id = classes.school_id
      WHERE account_id = ?`,
    [userId],
  );
  const classes: {
    school_id: number;
    school_name: string;
    role: 'admin' | 'manager' | 'leader' | 'teacher';
    classes: { class_id: number; class_name: string }[];
  }[] = [];

  const rolePriority: Record<string, number> = {
    admin: 4,
    manager: 3,
    leader: 2,
    teacher: 1,
  };

  for (const row of classRows) {
    const { school_id, school_name, class_id, class_name, role } = row;
    let school = classes.find(c => c.school_id === school_id);
    if (!school) {
      school = { school_id, school_name, role, classes: [] };
      classes.push(school);
    }

    // Keep the highest role across all classes in the school
    if ((rolePriority[role] || 0) > (rolePriority[school.role] || 0)) {
      school.role = role;
    }

    // Avoid duplicate classes (a user may have multiple roles in the same class)
    if (!school.classes.some(c => c.class_id === class_id)) {
      school.classes.push({ class_id, class_name });
    }
  }
  return classes;
}

async function getStudents(classId: number) {
  return await executeQuery(
    `SELECT 
      person_id as student_id,
      person_name as student_name, 
      address,
      photo_link,
      group_concat(phone_numbers.phone_number separator ', ') as phone_numbers,
      district_name as district,
      notes 
     FROM persons
     inner join person_class using(person_id)
     left join phone_numbers using(person_id)
     left join districts using(district_id)
     where class_id = ? and person_class.type = 'student'
     group by person_id
     order by student_name;
    `,
    [classId],
  );
}

async function getTeachers(classId: number) {
  return await executeQuery(
    `SELECT 
      person_id as teacher_id,
      person_name as teacher_name, 
      address,
      photo_link,
      group_concat(phone_numbers.phone_number separator ', ') as phone_numbers,
      district_name as district,
      notes 
     FROM persons
     inner join person_class using(person_id)
     left join phone_numbers using(person_id)
     left join districts using(district_id)
     where class_id = ? and person_class.type = 'teacher'
     group by person_id
     order by teacher_name;
    `,
    [classId],
  );
}

// ---------------------------------------------------------------------------
// School CRUD
// ---------------------------------------------------------------------------

async function getSchools() {
  return await executeQuery<RowDataPacket[]>(
    'SELECT school_id, school_name FROM schools ORDER BY school_name',
  );
}

async function createSchool(schoolName: string) {
  const result = await executeQuery<ResultSetHeader>(
    'INSERT INTO schools (school_name) VALUES (?)',
    [schoolName],
  );
  dataVersionsService.touchClasses().catch(() => {});
  return result;
}

async function updateSchool(schoolId: number, schoolName: string) {
  const result = await executeQuery<ResultSetHeader>(
    'UPDATE schools SET school_name = ? WHERE school_id = ?',
    [schoolName, schoolId],
  );
  dataVersionsService.touchClasses().catch(() => {});
  return result;
}

async function deleteSchool(schoolId: number) {
  // Deleting a school cascades to classes, person_class, roles, events, etc.
  // via FK constraints — or we delete manually to be safe.
  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // Get class IDs in this school
    const [classRows] = await connection.query<RowDataPacket[]>(
      'SELECT class_id FROM classes WHERE school_id = ?',
      [schoolId],
    );
    const classIds = classRows.map((r: RowDataPacket) => r['class_id'] as number);

    if (classIds.length > 0) {
      const ph = classIds.map(() => '?').join(',');
      // Delete events (and their occurrences + attendance via cascade)
      await connection.query(`DELETE FROM events WHERE class_id IN (${ph})`, classIds);
      // Delete roles
      await connection.query(`DELETE FROM roles WHERE class_id IN (${ph})`, classIds);
      // Delete person_class
      await connection.query(`DELETE FROM person_class WHERE class_id IN (${ph})`, classIds);
      // Delete classes
      await connection.query(`DELETE FROM classes WHERE school_id = ?`, [schoolId]);
    }
    await connection.query('DELETE FROM schools WHERE school_id = ?', [schoolId]);

    const [schoolRows] = await connection.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM schools');
    if (schoolRows[0]!['cnt'] === 0) {
      await connection.query('INSERT INTO schools (school_id, school_name) VALUES (1, "Default School")');
    }
    const [rows] = await connection.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM classes');
    if (rows[0]!['cnt'] === 0) {
      await connection.query('INSERT INTO classes (class_id, class_name, school_id) VALUES (1, "Default Class", 1)');
    }
    await connection.query('INSERT IGNORE INTO roles (account_id, class_id, role, school_id) VALUES (80, 1, "manager", 1)');
    await connection.commit();
    dataVersionsService.touchClasses().catch(() => {});
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

// ---------------------------------------------------------------------------
// Class CRUD
// ---------------------------------------------------------------------------

async function createClass(className: string, schoolId: number) {
  const result = await executeQuery<ResultSetHeader>(
    'INSERT INTO classes (class_name, school_id) VALUES (?, ?)',
    [className, schoolId],
  );
  dataVersionsService.touchClasses().catch(() => {});
  return result;
}

async function updateClass(classId: number, className: string) {
  const result = await executeQuery<ResultSetHeader>(
    'UPDATE classes SET class_name = ? WHERE class_id = ?',
    [className, classId],
  );
  dataVersionsService.touchClasses().catch(() => {});
  return result;
}

async function deleteClass(classId: number) {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM events WHERE class_id = ?', [classId]);
    await connection.query('DELETE FROM roles WHERE class_id = ?', [classId]);
    await connection.query('DELETE FROM person_class WHERE class_id = ?', [classId]);
    await connection.query('DELETE FROM classes WHERE class_id = ?', [classId]);

    const [rows] = await connection.query<RowDataPacket[]>('SELECT COUNT(*) AS cnt FROM classes');
    if (rows[0]!['cnt'] === 0) {
      await connection.query('INSERT INTO classes (class_id, class_name, school_id) VALUES (1, "Default Class", 1)');
      await connection.query('INSERT IGNORE INTO roles (account_id, class_id, role, school_id) VALUES (80, 1, "manager", 1)');
    }
    await connection.commit();
    dataVersionsService.touchClasses().catch(() => {});
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getAllClassesWithSchool() {
  return await executeQuery<RowDataPacket[]>(
    `SELECT c.class_id, c.class_name, s.school_id, s.school_name
     FROM classes c
     INNER JOIN schools s ON c.school_id = s.school_id
     ORDER BY s.school_name, c.class_name`,
  );
}

async function getClassSchoolId(classId: number) {
  return await executeQuery<RowDataPacket[]>(
    'SELECT school_id FROM classes WHERE class_id = ?',
    [classId],
  );
}

export default {
  getStudents,
  getTeachers,
  getUserJoinedSchoolsClasses,
  getSchools,
  createSchool,
  updateSchool,
  deleteSchool,
  createClass,
  updateClass,
  deleteClass,
  getAllClassesWithSchool,
  getClassSchoolId,
};
