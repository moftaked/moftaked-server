/* eslint-disable prettier/prettier */
import { ForbiddenException, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { DatabaseService } from 'src/database/database.service';
import { ResultSetHeader } from 'mysql2/promise';
import { phoneNumbersIds } from 'src/students/students.service';
import { classId } from 'src/types';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
@Injectable()
export class TeachersService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getClassIdsByTeacherId(teacher_id: number) {
    const results = await this.databaseService.executeQuery<classId[]>(
      'select class_id from person_class where person_id=?;',
      [teacher_id],
    );
    return results;
  }
  
  async create(createTeacherDto: CreateTeacherDto) {
    const connection = await this.databaseService.getConnection();
    try {
      await connection.beginTransaction();
      const [studentsResult] = await connection.query<ResultSetHeader>(
        'insert into persons(person_name, address, district, notes) values (?, ?, ?, ?);',
        [
          createTeacherDto.teacher_name,
          createTeacherDto.address,
          createTeacherDto.district,
          createTeacherDto.notes,
        ],
      );

      await connection.query(
        'insert into phone_numbers(person_id, phone_number) values (?, ?);',
        [studentsResult.insertId, createTeacherDto.phone_number],
      );

      if (createTeacherDto.second_phone_number != undefined) {
        await connection.query(
          'insert into phone_numbers(person_id, phone_number) values (?, ?);',
          [studentsResult.insertId, createTeacherDto.second_phone_number],
        );
      }

      await connection.query(
        `insert into person_class(person_id, class_id, type) values (?, ?, 'teacher')`,
        [studentsResult.insertId, createTeacherDto.class_id],
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

  findAll() {
    return `This action returns all teachers`;
  }

  async findOne(id: number) {
    const teachers = await this.databaseService.executeQuery(
      `
      select 
        person_name as teacher_name, 
        address, 
        group_concat(phone_number separator ', ') as phone_numbers,
        district,
        notes
      from persons 
      left join 
        phone_numbers using(person_id) 
      inner join
        person_class using(person_id)
      where person_id=? and person_class.type='teacher';`,
      [id],
    );
    return { teachers };
  }

  async update(id: number, teacher: UpdateTeacherDto) {
    const connection = await this.databaseService.getConnection();
    try {
      await connection.beginTransaction();
      const firstQueryResult = await connection.query<ResultSetHeader>(
        `
        update persons 
        set person_name=?, address=?, district=?, notes=? 
        where person_id=? and person_id in (select person_id from person_class where type='teacher' and person_id=?);`,
        [
          teacher.teacher_name,
          teacher.address,
          teacher.district,
          teacher.notes,
          id,
          id,
        ],
      );
      if (firstQueryResult[0].affectedRows == 0) {
        throw new ForbiddenException();
      }
      const phoneNumbersIds = await this.databaseService.executeQuery<phoneNumbersIds[]>(
        'select phone_number_id from phone_numbers where person_id=?;',
         [id],
        );
      await connection.query(
        'update phone_numbers set phone_number=? where person_id=? and phone_number_id=?',
        [teacher.phone_number, id, phoneNumbersIds[0].phone_number_id],
      );

      if (teacher.second_phone_number != undefined) {
        if (phoneNumbersIds[1] == undefined)
          await connection.query(
            'insert into phone_numbers(person_id, phone_number) values (?, ?);',
            [id, teacher.second_phone_number],
          );
        else
          await connection.query(
            'update phone_numbers set phone_number=? where person_id=? and phone_number_id=?',
            [
              teacher.second_phone_number,
              id,
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
    } catch (error) {
      Logger.error(error);
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async remove(id: number) {
    const result = await this.databaseService.executeQuery<ResultSetHeader>(
      `
      delete from persons 
      where 
        person_id = ? and
        person_id in (select person_id from person_class where type='teacher' and person_id=?);
      `,
      [id, id],
    );
    if (result.affectedRows == 0) throw new ForbiddenException();
    return {
      affectedRows: result.affectedRows,
    };
  }
}
