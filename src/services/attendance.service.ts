import { RowDataPacket } from 'mysql2/promise';
import { getConnection, executeQuery } from './database.service';
import dataVersionsService from './data-versions.service';

async function getClassIdFromEventOccurrence(eventOccurrenceId: number): Promise<number | null> {
  const rows = await executeQuery<RowDataPacket[]>(
    `SELECT class_id FROM event_occurence inner join events using(event_id) WHERE event_occurence_id = ?`,
    [eventOccurrenceId],
  );
  if (rows.length === 0 || !rows[0]) return null;
  return rows[0]['class_id'] as number;
}

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

async function isLatestOccurrence(eventOccurrenceId: number): Promise<boolean> {
  const rows = await executeQuery<RowDataPacket[]>(
    `
    select eo_latest.event_occurence_id as latest_id
    from event_occurence eo
    inner join (
      select event_id, max(occurence_date) as max_date
      from event_occurence
      group by event_id
    ) eo_max on eo.event_id = eo_max.event_id and eo.occurence_date = eo_max.max_date
    inner join event_occurence eo_latest
      on eo_latest.event_id = eo_max.event_id and eo_latest.occurence_date = eo_max.max_date
    where eo.event_occurence_id = ?
    limit 1
    `,
    [eventOccurrenceId],
  );

  if (rows.length === 0 || !rows[0]) return false;
  return rows[0]['latest_id'] === eventOccurrenceId;
}

async function patchAttendance(
  attended: number[] | undefined,
  absent: number[] | undefined,
  eventOccurrenceId: number,
  type: 'student' | 'teacher',
) {
  const latest = await isLatestOccurrence(eventOccurrenceId);
  if (!latest) {
    throw new Error('EDIT_NOT_LATEST');
  }

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
    for (const personId of attended) {
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
    }
  }
  if (absent) {
    for (const personId of absent) {
      await connection.execute(
        `
        delete from attendance where person_id=? and event_occurence_id=?;
        `,
        [personId, eventOccurrenceId],
      );
    }
  }
  await connection.commit();
  connection.release();

  // Touch data version for this occurrence's attendance (type-specific)
  dataVersionsService.touchOccurrenceAttendance(eventOccurrenceId, type).catch(() => {});
}

export default { getAttendance, isLatestOccurrence, patchAttendance, getClassIdFromEventOccurrence };