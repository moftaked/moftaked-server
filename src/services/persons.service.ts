import { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { executeQuery, getConnection } from "./database.service";
import { CreatePersonDto, UpdatePersonDto } from "../schemas/persons.schemas";

interface phoneNumbersIds extends RowDataPacket {
  [column: number]: any;
  [column: string]: any;
  ['constructor']: { name: 'RowDataPacket' };
  phone_number_id: number;
}

async function createPerson(type: 'student' | 'teacher', data: CreatePersonDto) {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const [personResult] = await connection.query<ResultSetHeader>(
      'insert into persons(person_name, address, district_id, notes) values (?, ?, ?, ?);',
      [
        data.name,
        data.address,
        data.district_id,
        data.notes,
      ],
    );

    await connection.query(
      'insert into phone_numbers(person_id, phone_number) values (?, ?);',
      [personResult.insertId, data.phone_number],
    );

    if (data.second_phone_number != undefined) {
      await connection.query(
        'insert into phone_numbers(person_id, phone_number) values (?, ?);',
        [personResult.insertId, data.second_phone_number],
      );
    }

    await connection.query(
      `insert into person_class(person_id, class_id, type) values (?, ?, ?)`,
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
          person.name,
          person.address,
          person.district_id,
          person.notes,
          personId,
          personId,
        ],
      );
      if (firstQueryResult[0].affectedRows == 0) {
        return 0;
      }
      const phoneNumbersIds = await executeQuery<phoneNumbersIds[]>(
        'select phone_number_id from phone_numbers where person_id=?;',
         [personId],
        );
      if (phoneNumbersIds[0]) {
        await connection.query(
          'update phone_numbers set phone_number=? where person_id=? and phone_number_id=?',
          [person.phone_number, personId, phoneNumbersIds[0].phone_number_id],
        );
      }

      if (person.second_phone_number != undefined) {
        if (phoneNumbersIds[1] == undefined)
          await connection.query(
            'insert into phone_numbers(person_id, phone_number) values (?, ?);',
            [personId, person.second_phone_number],
          );
        else
          await connection.query(
            'update phone_numbers set phone_number=? where person_id=? and phone_number_id=?',
            [
              person.second_phone_number,
              personId,
              phoneNumbersIds[1].phone_number_id,
            ],
          );
      } else if (phoneNumbersIds[1]) {
        await connection.query(
          'delete from phone_numbers where phone_number_id=?',
          [phoneNumbersIds[1].phone_number_id]
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
  try {
    const results = await executeQuery(
      'select * from persons where person_id = ?',
      [personId],
    );
    return results;
  } catch (error) {
    throw error;
  }
}

export default {
  createPerson,
  getPersonById,
  updatePerson,
};