import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { executeQuery, getConnection } from './database.service';
import { CreatePersonDto, UpdatePersonDto } from '../schemas/persons.schemas';
import * as arabic from '@flowdegree/arabic-strings';
import dataVersionsService from './data-versions.service';

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
      'insert into persons(person_name, normalized_person_name, address, district_id, notes) values (?, ?, ?, ?, ?);',
      [
        data.name.trim(),
        arabic.sanitize(data.name.trim()),
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

    // Touch data version for the class this person was added to
    const versionKey = type === 'student'
      ? dataVersionsService.classStudentsKey(data.class_id)
      : dataVersionsService.classTeachersKey(data.class_id);
    dataVersionsService.touch(versionKey).catch(() => {});
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
        set person_name=?, normalized_person_name=?, address=?, district_id=?, notes=? 
        where person_id=? and person_id in (select person_id from person_class where type='student' and person_id=?);`,
      [
        person.name.trim(),
        arabic.sanitize(person.name.trim()),
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

    // Touch data versions for all classes the person belongs to
    const allClasses = await executeQuery<classIds[]>(
      'SELECT class_id, type FROM person_class WHERE person_id = ?',
      [personId],
    );
    const touchKeys: string[] = [];
    for (const c of allClasses) {
      if (c['type'] === 'student') {
        touchKeys.push(dataVersionsService.classStudentsKey(c.class_id));
      } else if (c['type'] === 'teacher') {
        touchKeys.push(dataVersionsService.classTeachersKey(c.class_id));
      }
    }
    if (touchKeys.length > 0) {
      dataVersionsService.touch(...touchKeys).catch(() => {});
    }

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
      district_name,
      group_concat(phone_numbers.phone_number separator ', ') as phone_numbers
    from persons 
    left join districts using(district_id) 
    left join phone_numbers using(person_id)
    where person_id = ?
    group by person_id`,
    [personId],
  );
  return results;
}

async function searchByName(name: string, type: 'student' | 'teacher', classIds: number[]) {
  if (classIds.length === 0) return [];
  const searchTerm = '%' + arabic.sanitize(name).replaceAll(' ', '%') + '%';
  const results = await executeQuery(
    `select distinct 
      person_id, 
      person_name,
      photo_link,
      group_concat(person_class.class_id separator ', ') as classIds 
    from persons 
    inner join person_class using(person_id)
    where type = ? and class_id in (${classIds.map(() => '?').join(',')}) and COALESCE(normalized_person_name, person_name) like ?
    group by person_id
    `,
    [type, ...classIds, searchTerm]
  );
  return results;
}

async function updatePersonPhoto(personId: number, photoLink: string) {
  const result = await executeQuery<ResultSetHeader>(
    'update persons set photo_link = ? where person_id = ?',
    [photoLink, personId],
  );
  return result;
}

async function getPersonClasses(personId: number) {
  const results = await executeQuery(
    `select 
      person_class.class_id,
      class_name,
      school_name,
      person_class.type
    from person_class
    inner join classes using(class_id)
    inner join schools using(school_id)
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

    // Touch data version for the class
    const versionKey = type === 'student'
      ? dataVersionsService.classStudentsKey(classId)
      : dataVersionsService.classTeachersKey(classId);
    dataVersionsService.touch(versionKey).catch(() => {});

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
  searchByName,
  updatePerson,
  updatePersonPhoto,
  getJoinedClasses,
  getPersonClasses,
  unassignPerson,
};
