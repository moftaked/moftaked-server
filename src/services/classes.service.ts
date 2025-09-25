import { RowDataPacket } from 'mysql2';
import { executeQuery } from './database.service';

async function getUserJoinedSchoolsClasses(userId: number) {
  const classRows = await executeQuery<RowDataPacket[]>(
    `SELECT
      school_id,
      school_name,
      class_id,
      class_name
      FROM classes
      inner join schools using(school_id)
      WHERE class_id IN (
        SELECT class_id
        FROM roles
        WHERE account_id = ?
      )`,
    [userId],
  );
  const classes: { school_id: number; school_name: string; classes: {class_id: number; class_name: string}[] }[] = [];
  for (const row of classRows) {
    const { school_id, school_name, class_id, class_name } = row;
    let school = classes.find(c => c.school_id === school_id);
    if (!school) {
      school = { school_id, school_name, classes: [] };
      classes.push(school);
    }
    school.classes.push({ class_id, class_name });
  }
  return classes;
}

async function getStudents(classId: number) {
  return await executeQuery(
    `SELECT 
      person_id as student_id,
      person_name as student_name, 
      address,
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

export default { getStudents, getTeachers, getUserJoinedSchoolsClasses };
