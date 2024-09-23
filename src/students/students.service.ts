import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { CreateStudentDto } from './dto/create-student.dto';
import { DatabaseService } from 'src/database/database.service';
import { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { UpdateStudentDto } from './dto/update-student.dto';

class phoneNumbersIds implements RowDataPacket {
  [column: number]: any;
  [column: string]: any;
  ['constructor']: { name: 'RowDataPacket' };
  phone_number_id: number;
}

@Injectable()
export class StudentsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createStudentDto: CreateStudentDto) {
    const connection = await this.databaseService.getConnection();
    try {
      await connection.beginTransaction();
      const [studentsResult] = await connection.query<ResultSetHeader>(
        'insert into students(student_name, address, district, notes) values (?, ?, ?, ?);',
        [
          createStudentDto.student_name,
          createStudentDto.address,
          createStudentDto.district,
          createStudentDto.notes,
        ],
      );

      await connection.query(
        'insert into phone_numbers(student_id, phone_number) values (?, ?);',
        [studentsResult.insertId, createStudentDto.phone_number],
      );

      if (createStudentDto.second_phone_number != undefined) {
        await connection.query(
          'insert into phone_numbers(student_id, phone_number) values (?, ?);',
          [studentsResult.insertId, createStudentDto.second_phone_number],
        );
      }

      await connection.query(
        'insert into student_class(student_id, class_id) values (?, ?)',
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

  async findAll() {
    const results = await this.databaseService.executeQuery(
      'SELECT student_name, address FROM students;',
    );
    return results;
  }

  async findOne(id: string) {
    const students = await this.databaseService.executeQuery(
      `
      select 
        student_name, 
        address, 
        group_concat(phone_number separator ', ') as phone_numbers,
        district,
        notes
      from students 
      left join 
        phone_numbers using(student_id) 
      where student_id=?;`,
      [id],
    );
    return { students };
  }

  async update(id: string, student: UpdateStudentDto) {
    const connection = await this.databaseService.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query<ResultSetHeader>(
        'update students set student_name=?, address=?, district=?, notes=? where student_id=?;',
        [
          student.student_name,
          student.address,
          student.district,
          student.notes,
          id,
        ],
      );
      const phoneNumbersIds = await this.databaseService.executeQuery<phoneNumbersIds[]>(
        'select phone_number_id from phone_numbers where student_id=?;',
        [id]
      );
      await connection.query(
        'update phone_numbers set phone_number=? where student_id=? and phone_number_id=?',
        [student.phone_number, id, phoneNumbersIds[0].phone_number_id]
      );

      if (student.second_phone_number != undefined) {
        if (phoneNumbersIds[1] == undefined)
          await connection.query(
            'insert into phone_numbers(student_id, phone_number) values (?, ?);',
            [id, student.second_phone_number],
          );
        else
          await connection.query(
            'update phone_numbers set phone_number=? where student_id=? and phone_number_id=?',
            [
              student.second_phone_number,
              id,
              phoneNumbersIds[1].phone_number_id,
            ],
          );
      }

      await connection.commit();
    } catch (error) {
      Logger.error(error, error.stack);
      await connection.rollback();
      throw new InternalServerErrorException();
    } finally {
      connection.release();
    }
  }
}
