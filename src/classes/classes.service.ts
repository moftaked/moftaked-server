import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';

@Injectable()
export class ClassesService {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAll() {
    const classes = await this.databaseService.executeQuery(
      'select class_id, class_name from classes;',
    );
    return classes;
  }

  async findOne(id: number) {
    const result = await this.databaseService.executeQuery(
      'select class_id, class_name from classes where class_id = ?;',
      [id],
    );
    return result;
  }

  async getStudents(id: number) {
    const students = await this.databaseService.executeQuery(
      `
      select 
        student_id, 
        student_name, 
        address, 
        group_concat(phone_number separator ', ') as phone_numbers,
        district,
        notes
      from students 
      inner join 
        student_class using(student_id) 
      left join 
        phone_numbers using(student_id) 
      where class_id = ? 
      group by student_id;`,
      [id],
    );

    const metadata = await this.databaseService.executeQuery(
      'select count(student_id) as count from student_class where class_id = ?',
      [id],
    );
    return { students, metadata };
  }
}
