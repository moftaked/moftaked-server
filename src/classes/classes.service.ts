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
        person_id as student_id, 
        person_name as student_name, 
        address, 
        group_concat(phone_number separator ', ') as phone_numbers,
        district,
        notes
      from persons 
      inner join 
        person_class using(person_id) 
      left join 
        phone_numbers using(person_id) 
      where class_id = ? and person_class.type = 'student'
      group by person_id;`,
      [id],
    );

    const metadata = await this.databaseService.executeQuery(
      `
      select 
        count(person_id) as count 
      from 
        person_class 
      where 
        class_id = ? and type = 'student';`,
      [id],
    );
    return { students, metadata };
  }

  async getTeachers(id: number) {
    const teachers = await this.databaseService.executeQuery(
      `
      select 
        person_id as teacher_id, 
        person_name as teacher_name, 
        address, 
        group_concat(phone_number separator ', ') as phone_numbers,
        district,
        notes
      from persons 
      inner join 
        person_class using(person_id) 
      left join 
        phone_numbers using(person_id) 
      where class_id = ? and person_class.type = 'teacher'
      group by person_id;`,
      [id],
    );

    const metadata = await this.databaseService.executeQuery(
      `
      select 
        count(person_id) as count 
      from 
        person_class 
      where 
        class_id = ? and type = 'teacher';`,
      [id],
    );
    return { teachers, metadata };
  }

  async getStudentsEvents(classId: number) {
    const events = await this.databaseService.executeQuery(
      `select event_id, event_name from events where class_id=? and (type='student' or type='all')`,
      [classId],
    );
    return {
      events,
    };
  }

  async getTeachersEvents(classId: number) {
    const events = await this.databaseService.executeQuery(
      `select event_id, event_name from events where class_id=? and (type='teacher' or type='all')`,
      [classId],
    );
    return {
      events,
    };
  }

  async getStudentsEvent(eventId: number) {
    const events = await this.databaseService.executeQuery(
      `select event_id, event_name from events where event_id=? and (type='student' or type='all')`,
      [eventId],
    );
    return {
      events,
    };
  }

  async getTeachersEvent(eventId: number) {
    const events = await this.databaseService.executeQuery(
      `select event_id, event_name from events where event_id=? and (type='teacher' or type='all')`,
      [eventId],
    );
    return {
      events,
    };
  }
}
