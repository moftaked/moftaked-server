import { executeQuery } from './database.service';

async function getUserJoinedClasses(userId: number) {
  return await executeQuery(
    `SELECT 
      distinct class_id,
      class_name
      FROM classes
      WHERE class_id IN (
        SELECT class_id
        FROM roles
        WHERE account_id = ?
      )`,
    [userId],
  );
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

export default { getStudents, getTeachers, getUserJoinedClasses };
