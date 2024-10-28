import { Injectable } from '@nestjs/common';
import { DatabaseService } from 'src/database/database.service';
import { RowDataPacket } from 'mysql2';
import { CreateAttendanceDto } from './dto/create-attendance.dto';

export interface Occurence extends RowDataPacket {
  event_occurence_id: number;
}

@Injectable()
export class EventsService {
  constructor(private databaseService: DatabaseService) {}

  findAll() {
    return `This action returns all events`;
  }

  async findOne(id: number) {
    const events = await this.databaseService.executeQuery(
      'select event_id, class_id, event_name from events where event_id=?',
      [id],
    );
    return { events };
  }

  async createStudentsEventOccurence(eventId: number) {
    await this.databaseService.executeQuery(
      'insert ignore into event_occurence(event_id, occurence_date) values(?, curdate());',
      [eventId],
    );
  }

  // todo: a teacher can make teacher event occurence
  async createTeachersEventOccurence(eventId: number) {
    await this.databaseService.executeQuery(
      'insert ignore into event_occurence(event_id, occurence_date) values(?, curdate());',
      [eventId],
    );
  }

  async getLastOccurenceId(id: number) {
    const occurences = await this.databaseService.executeQuery<Occurence[]>(
      'select event_occurence_id from event_occurence where event_id=? order by event_occurence_id desc limit 1;',
      [id],
    );
    return { occurences };
  }

  async getStudentAttendance(occurenceId: number, classId: number) {
    const attendance = await this.databaseService.executeQuery(
      `
      select 
        persons.person_id, 
        persons.person_name, 
        if(attendance.person_id is null, 0, 1) as attended 
        from event_occurence 
        inner join events on event_occurence.event_id = events.event_id and events.class_id = ?
        inner join person_class
          on 
            events.class_id = person_class.class_id
            and person_class.type = 'student'
        inner join persons using(person_id) 
        left join attendance 
          on 
            attendance.event_occurence_id = event_occurence.event_occurence_id 
            and attendance.person_id = persons.person_id 
        where event_occurence.event_occurence_id=?;

      `,
      [classId, occurenceId],
    );
    const date = await this.databaseService.executeQuery(
      'select occurence_date from event_occurence where event_occurence_id=?;',
      [occurenceId],
    );
    return {
      attendance,
      date,
    };
  }

  async getTeacherAttendance(occurenceId: number, classId: number) {
    const attendance = await this.databaseService.executeQuery(
      `
      select 
        persons.person_id, 
        persons.person_name, 
        if(attendance.person_id is null, 0, 1) as attended 
        from event_occurence 
        inner join events on event_occurence.event_id = events.event_id and events.class_id = ?
        inner join person_class
          on 
            events.class_id = person_class.class_id
            and person_class.type = 'teacher'
        inner join persons using(person_id) 
        left join attendance 
          on 
            attendance.event_occurence_id = event_occurence.event_occurence_id 
            and attendance.person_id = persons.person_id 
        where event_occurence.event_occurence_id=?;
      `,
      [classId, occurenceId],
    );
    const date = await this.databaseService.executeQuery(
      'select occurence_date from event_occurence where event_occurence_id=?;',
      [occurenceId],
    );
    return {
      attendance,
      date,
    };
  }

  async addStudentsAttendance(
    classId: number,
    occurenceId: number,
    attendanceDto: CreateAttendanceDto,
  ) {
    attendanceDto.attendance.forEach(async (person_id) => {
      await this.databaseService.executeQuery(
        `
        insert ignore into 
        attendance(person_id, event_occurence_id) 
          select distinct ? as person_id, ? as event_occurence_id from person_class 
          where ? in 
            (select person_id from person_class where class_id=? and type='student');
        `,
        [person_id, occurenceId, person_id, classId],
      );
    });
  }

  async addTeachersAttendance(
    classId: number,
    occurenceId: number,
    attendanceDto: CreateAttendanceDto,
  ) {
    attendanceDto.attendance.forEach(async (person_id) => {
      await this.databaseService.executeQuery(
        `
        insert ignore into 
        attendance(person_id, event_occurence_id) 
          select distinct ? as person_id, ? as event_occurence_id from person_class 
          where ? in 
            (select person_id from person_class where class_id=? and type='teacher');
        `,
        [person_id, occurenceId, person_id, classId],
      );
    });
  }

  deleteStudentsAttendance(
    occurenceId: number,
    attendanceDto: CreateAttendanceDto,
  ) {
    attendanceDto.absence?.forEach(async (person_id) => {
      await this.databaseService.executeQuery(
        `
        delete from attendance where person_id=? and event_occurence_id=?
        `,
        [person_id, occurenceId],
      );
    });
  }

  // todo: a normal teacher can remove another teacher attendance lol
  deleteTeachersAttendance(
    occurenceId: number,
    attendanceDto: CreateAttendanceDto,
  ) {
    attendanceDto.absence?.forEach(async (person_id) => {
      await this.databaseService.executeQuery(
        `
        delete from attendance where person_id=? and event_occurence_id=?
        `,
        [person_id, occurenceId],
      );
    });
  }
}
