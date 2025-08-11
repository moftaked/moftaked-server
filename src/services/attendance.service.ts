import { RowDataPacket } from 'mysql2/promise';
import { getConnection, executeQuery } from './database.service';

async function getAttendance(
  eventOccurrenceId: number,
  type: 'student' | 'teacher',
) {
  const attendance = await executeQuery(
    `
      select 
        persons.person_id, 
        persons.person_name, 
        if(attendance.person_id is null, 0, 1) as attended 
        from event_occurence 
        inner join events using(event_id)
        inner join person_class
          on 
            events.class_id = person_class.class_id
            and person_class.type = ?
        inner join persons using(person_id) 
        left join attendance 
          on 
            attendance.event_occurence_id = event_occurence.event_occurence_id 
            and attendance.person_id = persons.person_id 
        where event_occurence.event_occurence_id=?
        order by persons.person_name;

      `,
    [type, eventOccurrenceId],
  );
  const date = await executeQuery(
    'select occurence_date from event_occurence where event_occurence_id=?;',
    [eventOccurrenceId],
  );
  return {
    attendance,
    date,
  };
}

async function patchAttendance(
  attended: number[] | undefined,
  absent: number[] | undefined,
  eventOccurrenceId: number,
  type: 'student' | 'teacher',
) {
  const connection = await getConnection();
  await connection.beginTransaction();
  let classId = 0;
  const [classes] = await connection.execute<RowDataPacket[]>(
    `
    select class_id from event_occurence inner join events using(event_id) where event_occurence_id = ?
    `,
    [eventOccurrenceId],
  );
  if (classes[0]) {
    classId = classes[0]['class_id'];
  }
  if (attended) {
    attended.forEach(async personId => {
      await connection.execute(
        `
        insert ignore into 
        attendance(person_id, event_occurence_id) 
          select distinct ? as person_id, ? as event_occurence_id from person_class 
          where ? in 
            (select person_id from person_class where class_id=? and type=?);
        `,
        [personId, eventOccurrenceId, personId, classId, type],
      );
    });
  }
  if (absent) {
    absent.forEach(async personId => {
      await connection.execute(
        `
        delete from attendance where person_id=? and event_occurence_id=?;
        `,
        [personId, eventOccurrenceId],
      );
    });
  }
  await connection.commit();
  connection.release();
}

export default { getAttendance, patchAttendance };
