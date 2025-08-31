import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { executeQuery, getConnection } from './database.service';
import { CreatePersonDto, UpdatePersonDto } from '../schemas/persons.schemas';

interface phoneNumbersIds extends RowDataPacket {
  [column: number]: unknown;
  [column: string]: unknown;
  ['constructor']: { name: 'RowDataPacket' };
  phone_number_id: number;
}

export interface classIds extends RowDataPacket {
  [column: number]: unknown;
  [column: string]: unknown;
  ['constructor']: { name: 'RowDataPacket' };
  class_id: number;
}

async function createPerson(
  type: 'student' | 'teacher',
  data: CreatePersonDto,
) {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const [personResult] = await connection.query<ResultSetHeader>(
      'insert into persons(person_name, address, district_id, notes) values (?, ?, ?, ?);',
      [
        data.name.trim(),
        data.address.trim(),
        data.district_id,
        data.notes?.trim(),
      ],
    );

    await connection.query(
      'insert into phone_numbers(person_id, phone_number) values (?, ?);',
      [personResult.insertId, data.phone_number.trim()],
    );

    if (data.second_phone_number !== undefined) {
      await connection.query(
        'insert into phone_numbers(person_id, phone_number) values (?, ?);',
        [personResult.insertId, data.second_phone_number.trim()],
      );
    }

    await connection.query(
      'insert into person_class(person_id, class_id, type) values (?, ?, ?)',
      [personResult.insertId, data.class_id, type],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updatePerson(personId: number, person: UpdatePersonDto) {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const firstQueryResult = await connection.query<ResultSetHeader>(
      `
        update persons 
        set person_name=?, address=?, district_id=?, notes=? 
        where person_id=? and person_id in (select person_id from person_class where type='student' and person_id=?);`,
      [
        person.name.trim(),
        person.address.trim(),
        person.district_id,
        person.notes?.trim(),
        personId,
        personId,
      ],
    );
    if (firstQueryResult[0].affectedRows === 0) {
      return 0;
    }
    const phoneNumbersIds = await executeQuery<phoneNumbersIds[]>(
      'select phone_number_id from phone_numbers where person_id=?;',
      [personId],
    );
    if (phoneNumbersIds[0]) {
      await connection.query(
        'update phone_numbers set phone_number=? where person_id=? and phone_number_id=?',
        [
          person.phone_number.trim(),
          personId,
          phoneNumbersIds[0].phone_number_id,
        ],
      );
    }

    if (person.second_phone_number !== undefined) {
      if (phoneNumbersIds[1] === undefined)
        await connection.query(
          'insert into phone_numbers(person_id, phone_number) values (?, ?);',
          [personId, person.second_phone_number.trim()],
        );
      else
        await connection.query(
          'update phone_numbers set phone_number=? where person_id=? and phone_number_id=?',
          [
            person.second_phone_number.trim(),
            personId,
            phoneNumbersIds[1].phone_number_id,
          ],
        );
    } else if (phoneNumbersIds[1]) {
      await connection.query(
        'delete from phone_numbers where phone_number_id=?',
        [phoneNumbersIds[1].phone_number_id],
      );
    }

    await connection.commit();
    return firstQueryResult[0].affectedRows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getPersonById(personId: number) {
  const results = await executeQuery(
    `select 
      person_id, 
      person_name, 
      address, 
      photo_link, 
      notes, 
      district_name 
      group_concat(phone_numbers.phone_number separator ', ') as phone_numbers
    from persons 
    inner join districts using(district_id) 
    inner join phone_numbers using(person_id)
    where person_id = ?`,
    [personId],
  );
  return results;
}

async function getJoinedClasses(personId: number, type: 'student' | 'teacher') {
  const results = await executeQuery<classIds[]>(
    `select class_id from person_class
    where person_id = ? and type = ?`,
    [personId, type],
  );
  return results;
}

async function unassignPerson(personId: number, classId: number, type: 'student' | 'teacher') {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<ResultSetHeader>(
      'delete from person_class where person_id=? and class_id=? and type=?',
      [personId, classId, type],
    );
    if (result.affectedRows === 0) {
      return 0;
    }
    await connection.commit();
    deletePersonIfNotInAnyClass(personId);
    return result.affectedRows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deletePersonIfNotInAnyClass(personId: number) {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.query<ResultSetHeader>(
      'delete from persons where person_id=? and person_id not in (select distinct person_id from person_class);',
      [personId],
    );
    await connection.commit();
    return result.affectedRows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export default {
  createPerson,
  getPersonById,
  updatePerson,
  getJoinedClasses,
  unassignPerson,
};
