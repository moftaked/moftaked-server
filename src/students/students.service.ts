import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateStudentDto } from './dto/create-student.dto';
import { DatabaseService } from 'src/database/database.service';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { UpdateStudentDto } from './dto/update-student.dto';
import { classId } from 'src/types';

class phoneNumbersIds implements RowDataPacket {
  [column: number]: any;
  [column: string]: any;
  ['constructor']: { name: 'RowDataPacket' };
  phone_number_id: number;
}

@Injectable()
export class StudentsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getClassIdsByStudentId(student_id: number) {
    const results = await this.databaseService.executeQuery<classId[]>(
      'select class_id from person_class where person_id=?;',
      [student_id]
    );
    return results;
  }

  async create(createStudentDto: CreateStudentDto) {
    const connection = await this.databaseService.getConnection();
    try {
      await connection.beginTransaction();
      const [studentsResult] = await connection.query<ResultSetHeader>(
        'insert into persons(person_name, address, district, notes) values (?, ?, ?, ?);',
        [
          createStudentDto.student_name,
          createStudentDto.address,
          createStudentDto.district,
          createStudentDto.notes,
        ],
      );

      await connection.query(
        'insert into phone_numbers(person_id, phone_number) values (?, ?);',
        [studentsResult.insertId, createStudentDto.phone_number],
      );

      if (createStudentDto.second_phone_number != undefined) {
        await connection.query(
          'insert into phone_numbers(person_id, phone_number) values (?, ?);',
          [studentsResult.insertId, createStudentDto.second_phone_number],
        );
      }

      await connection.query(
        `insert into person_class(person_id, class_id, type) values (?, ?, 'student')`,
        [studentsResult.insertId, createStudentDto.class_id],
      );

      await connection.commit();
    } catch (error) {
      Logger.error(error, error.stack);
      await connection.rollback();
      throw new InternalServerErrorException();
    } finally {
      connection.release();
    }
  }

  async findOne(id: number) {
    const students = await this.databaseService.executeQuery(
      `
      select 
        person_name as student_name, 
        address, 
        group_concat(phone_number separator ', ') as phone_numbers,
        district,
        notes
      from persons 
      left join 
        phone_numbers using(person_id) 
      inner join
        person_class using(person_id)
      where person_id=? and person_class.type='student';`,
      [id],
    );
    return { students };
  }


  // todo: fix updating non-existent records, prevent updating teachers
  async update(id: number, student: UpdateStudentDto) {
    const connection = await this.databaseService.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query<ResultSetHeader>(
        'update persons set person_name=?, address=?, district=?, notes=? where person_id=?;',
        [
          student.student_name,
          student.address,
          student.district,
          student.notes,
          id,
        ],
      );
      const phoneNumbersIds = await this.databaseService.executeQuery<phoneNumbersIds[]>(
        'select phone_number_id from phone_numbers where person_id=?;',
        [id]
      );
      await connection.query(
        'update phone_numbers set phone_number=? where person_id=? and phone_number_id=?',
        [student.phone_number, id, phoneNumbersIds[0].phone_number_id]
      );

      if (student.second_phone_number != undefined) {
        if (phoneNumbersIds[1] == undefined)
          await connection.query(
            'insert into phone_numbers(person_id, phone_number) values (?, ?);',
            [id, student.second_phone_number],
          );
        else
          await connection.query(
            'update phone_numbers set phone_number=? where person_id=? and phone_number_id=?',
            [
              student.second_phone_number,
              id,
              phoneNumbersIds[1].phone_number_id,
            ],
          );
      } else if (phoneNumbersIds[1]) {
        await connection.query(
          'delete from phone_numbers where phone_number_id=?',
          [phoneNumbersIds[1].phone_number_id]
        )
      }

      await connection.commit();
    } catch (error) {
      Logger.error(error);
      await connection.rollback();
      throw new InternalServerErrorException();
    } finally {
      connection.release();
    }
  }

  // fix preventing deleting teachers
  async delete(id: number) {
    const result = await this.databaseService.executeQuery<ResultSetHeader>(
      'delete from persons where person_id = ?;',
      [id]
    );
    if(result.affectedRows == 0)
      throw new NotFoundException();
    return {
      affectedRows: result.affectedRows
    };
  }
}
