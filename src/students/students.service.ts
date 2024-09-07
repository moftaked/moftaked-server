import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { CreateStudentDto } from './dto/create-student.dto';
// import { UpdateStudentDto } from './dto/update-student.dto';
import { DatabaseService } from 'src/database/database.service';
import { QueryResult, ResultSetHeader } from 'mysql2/promise';

@Injectable()
export class StudentsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async create(createStudentDto: CreateStudentDto) {
    const connection = await this.databaseService.getConnection();
    try {
      await connection.beginTransaction();
      const [studentsResult] = await connection.query<ResultSetHeader>(
        'insert into students(student_name, address, district) values (?, ?, ?);',
        [createStudentDto.student_name, createStudentDto.address, createStudentDto.district]
      );
  
      await connection.query(
        'insert into phone_numbers(student_id, phone_number) values (?, ?);',
        [studentsResult.insertId, createStudentDto.phone_number]
      );

      await connection.query(
        'insert into student_class(student_id, class_id) values (?, ?)',
        [studentsResult.insertId, createStudentDto.class_id]
      );

      await connection.commit();
    } catch (error){
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

  findOne(id: number) {
    return `This action returns a #${id} student`;
  }

  // update(id: number, updateStudentDto: UpdateStudentDto) {
  //   return `This action updates a #${id} student`;
  // }

  remove(id: number) {
    return `This action removes a #${id} student`;
  }
}
