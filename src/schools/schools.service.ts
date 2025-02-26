import { ForbiddenException, Injectable } from '@nestjs/common';
import { RowDataPacket } from 'mysql2';
import { DatabaseService } from 'src/database/database.service';
import {
  absenceRecord,
  aggregatedStat,
  IClass,
  rawStat,
  school,
  stat,
} from 'src/types';

@Injectable()
export class SchoolsService {
  constructor(private readonly databaseService: DatabaseService) {}

  async getSchoolsManagedByUser(account_id: number) {
    const results = await this.databaseService.executeQuery<school[]>(
      `select distinct school_id, school_name 
      from roles
      inner join schools using(school_id)
      where account_id=? and role='manager'`,
      [account_id],
    );
    if (results.length <= 0) throw new ForbiddenException();

    return results;
  }

  async getSchoolsJoinedByUser(account_id: number) {
    const results = await this.databaseService.executeQuery<school[]>(
      `select distinct school_id, school_name 
      from roles
      inner join schools using(school_id)
      where account_id=?`,
      [account_id],
    );
    if (results.length <= 0) throw new ForbiddenException();

    return results;
  }

  async getSchoolsJoinedBySchoolAndUser(school_id: number, account_id: number) {
    // eslint-disable-next-line prettier/prettier
    const results = await this.databaseService.executeQuery<{[column: number]: any; [column: string]: any; ['constructor']: { name: 'RowDataPacket' }; class_id: number}[]>(
      `select distinct class_id
      from roles
      where account_id=? and school_id=?`,
      [account_id, school_id],
    );
    if (results.length <= 0) throw new ForbiddenException();

    return results;
  }

  async getClassesLeadedByUser(account_id: number) {
    const results = await this.databaseService.executeQuery<IClass[]>(
      `select distinct class_id, class_name 
      from roles
      inner join classes using(class_id)
      where account_id=? and role='leader'`,
      [account_id],
    );
    if (results.length <= 0) throw new ForbiddenException();

    return results;
  }

  async getClassesJoinedByUser(account_id: number) {
    const results = await this.databaseService.executeQuery<IClass[]>(
      `select distinct class_id, class_name 
      from roles
      inner join classes using(class_id)
      where account_id=? and role='teacher'`,
      [account_id],
    );
    if (results.length <= 0) throw new ForbiddenException();

    return results;
  }

  async getSchoolOverAllStats(schoolId: number, date: string) {
    const results = await this.databaseService.executeQuery<rawStat[]>(
      `
      select 
        events.event_name, 
        person_class.type, 
        count(attendance.person_id) as attended, 
        count(person_class.person_id) as total 
      from events 
      inner join classes on events.class_id = classes.class_id and classes.school_id = ?
      left join event_occurence on 
        events.event_id = event_occurence.event_id and 
        occurence_date=?
      left join person_class on 
        events.class_id = person_class.class_id and 
        (events.type='all' or events.type=person_class.type) 
      left join attendance on 
        event_occurence.event_occurence_id=attendance.event_occurence_id and 
        person_class.person_id=attendance.person_id 
      group by event_name, person_class.type
      having person_class.type is not null;
      `,
      [schoolId, date],
    );
    return this.aggregateOverAllStats(results);
  }

  async getClassOverAllStats(classId: number, date: string) {
    const results = await this.databaseService.executeQuery<rawStat[]>(
      `
      select 
        events.event_name, 
        person_class.type, 
        count(attendance.person_id) as attended, 
        count(person_class.person_id) as total 
      from events 
      inner join classes on events.class_id = classes.class_id and classes.class_id = ?
      left join event_occurence on 
        events.event_id = event_occurence.event_id and 
        occurence_date=?
      left join person_class on 
        events.class_id = person_class.class_id and 
        (events.type='all' or events.type=person_class.type) 
      left join attendance on 
        event_occurence.event_occurence_id=attendance.event_occurence_id and 
        person_class.person_id=attendance.person_id 
      group by event_name, person_class.type
      having person_class.type is not null;
      `,
      [classId, date],
    );
    return results;
  }

  async getTeacherOverAllStats(classId: number, date: string) {
    const results = await this.databaseService.executeQuery<rawStat[]>(
      `
      select 
        events.event_name, 
        person_class.type, 
        count(attendance.person_id) as attended, 
        count(person_class.person_id) as total 
      from events 
      inner join classes on events.class_id = classes.class_id and classes.class_id = ?
      left join event_occurence on 
        events.event_id = event_occurence.event_id and 
        occurence_date=?
      left join person_class on 
        events.class_id = person_class.class_id and 
        (events.type='all' or events.type=person_class.type) 
      left join attendance on 
        event_occurence.event_occurence_id=attendance.event_occurence_id and 
        person_class.person_id=attendance.person_id 
      group by event_name, person_class.type
      having person_class.type ='student';
      `,
      [classId, date],
    );
    return results;
  }

  aggregateOverAllStats(stats: rawStat[]) {
    const result: aggregatedStat[] = [];
    const hash = new Map<string, stat[]>();
    stats.forEach((rawStat) => {
      if (hash.has(rawStat.event_name) == false) {
        hash.set(rawStat.event_name, [
          {
            type: rawStat.type,
            total: rawStat.total,
            attended: rawStat.attended,
          },
        ]);
      } else {
        hash.get(rawStat.event_name)?.push({
          type: rawStat.type,
          total: rawStat.total,
          attended: rawStat.attended,
        });
      }
    });

    hash.forEach((statsArray, event_name) => {
      result.push({ event_name, stats: statsArray });
    });

    return result;
  }

  async getManagarialReports(accountId: number, date: string) {
    const managedSchools = await this.getSchoolsManagedByUser(accountId);
    const overAllStats: [
      { school_id: number; school_name: string; stats: aggregatedStat[] },
    ] = [] as unknown[] as [
      { school_id: number; school_name: string; stats: aggregatedStat[] },
    ];
    for (const school of managedSchools) {
      const stats = await this.getSchoolOverAllStats(school.school_id, date);
      overAllStats.push({
        school_id: school.school_id,
        school_name: school.school_name,
        stats,
      });
    }
    return {
      overAllStats,
    };
  }

  async getLeaderReports(accountId: number, date: string) {
    const leadedClasses = await this.getClassesLeadedByUser(accountId);
    const overAllStats: unknown[] = [];
    for (const _class of leadedClasses) {
      const stats = await this.getClassOverAllStats(_class.class_id, date);
      overAllStats.push({
        class_id: _class.class_id,
        class_name: _class.class_name,
        stats,
      });
    }
    return {
      overAllStats,
    };
  }

  async getTeacherReports(accountId: number, date: string) {
    const joinedClasses = await this.getClassesJoinedByUser(accountId);
    const overAllStats: unknown[] = [];
    for (const _class of joinedClasses) {
      const stats = await this.getTeacherOverAllStats(_class.class_id, date);
      overAllStats.push({
        class_id: _class.class_id,
        class_name: _class.class_name,
        stats,
      });
    }
    return {
      overAllStats,
    };
  }

  async getManagarialEventReport(
    schoolId: number,
    eventName: string,
    eventType: string,
    date: string,
  ) {
    const results = await this.databaseService.executeQuery<RowDataPacket[]>(
      `select
        date_format(occurence_date, "%d/%c") as occurence_date,
        count(distinct attendance.person_id) as attended, 
        count(distinct person_class.person_id) as total 
      from events 
      inner join classes on 
        events.class_id = classes.class_id and classes.school_id = ?
      left join event_occurence on 
        events.event_id = event_occurence.event_id and 
        occurence_date<=? and 
        events.event_name = ?
      left join person_class on 
        events.class_id = person_class.class_id and person_class.type = ?
      left join attendance on 
        event_occurence.event_occurence_id=attendance.event_occurence_id and 
        person_class.person_id=attendance.person_id
      group by occurence_date
      having occurence_date is not null
      order by DATE(occurence_date) desc
      limit 5;
      `,
      [schoolId, date, eventName, eventType],
    );

    return { length: results.length, results };
  }

  async getLeaderEventReport(
    classId: number,
    eventName: string,
    eventType: string,
    date: string,
  ) {
    const results = await this.databaseService.executeQuery<RowDataPacket[]>(
      `select
        date_format(occurence_date, "%d/%c") as occurence_date,
        count(distinct attendance.person_id) as attended, 
        count(distinct person_class.person_id) as total 
      from events 
      inner join classes on 
        events.class_id = classes.class_id and classes.class_id = ?
      left join event_occurence on 
        events.event_id = event_occurence.event_id and 
        occurence_date<=? and 
        events.event_name = ?
      left join person_class on 
        events.class_id = person_class.class_id and person_class.type = ?
      left join attendance on 
        event_occurence.event_occurence_id=attendance.event_occurence_id and 
        person_class.person_id=attendance.person_id
      group by occurence_date
      having occurence_date is not null
      order by DATE(occurence_date) desc
      limit 5;
      `,
      [classId, date, eventName, eventType],
    );

    return { length: results.length, results };
  }

  async getTeacherEventReport(
    classId: number,
    eventName: string,
    date: string,
  ) {
    const results = await this.databaseService.executeQuery<RowDataPacket[]>(
      `select
        date_format(occurence_date, "%d/%c") as occurence_date,
        count(distinct attendance.person_id) as attended, 
        count(distinct person_class.person_id) as total 
      from events 
      inner join classes on 
        events.class_id = classes.class_id and classes.class_id = ?
      left join event_occurence on 
        events.event_id = event_occurence.event_id and 
        occurence_date<=? and 
        events.event_name = ?
      left join person_class on 
        events.class_id = person_class.class_id and person_class.type = 'student'
      left join attendance on 
        event_occurence.event_occurence_id=attendance.event_occurence_id and 
        person_class.person_id=attendance.person_id
      group by occurence_date
      having occurence_date is not null
      order by DATE(occurence_date) desc
      limit 5;
      `,
      [classId, date, eventName],
    );

    return { length: results.length, results };
  }

  async getSchoolAbsentPeople(
    userId: number,
    type: string,
    occurenceCount: number,
    minCount: number,
  ) {
    const manageSchools = await this.getSchoolsManagedByUser(userId);
    const result = [];
    for (const school of manageSchools) {
      const results = await this.databaseService.executeQuery<absenceRecord[]>(
        `
        select 
          count(person_class.person_id) - count(attendance.person_id) as absent,
          classes.class_name,
          events.event_name, 
          persons.person_name,
          person_class.type
        from person_class 
        inner join classes on 
          (? = 'all' or person_class.type = ?) and
          person_class.class_id = classes.class_id and 
          classes.school_id=?
        inner join persons using(person_id) 
        inner join events on 
          (events.type = 'all' or events.type = person_class.type) and 
          classes.class_id = events.class_id 
        inner join(
          SELECT 
            event_id, 
            event_occurence_id,
            ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY occurence_date DESC) AS rn 
          from event_occurence
        ) AS ranked_occurrences on 
          ranked_occurrences.rn <= ? and 
          events.event_id = ranked_occurrences.event_id 
        left join attendance on 
          person_class.person_id = attendance.person_id and 
          ranked_occurrences.event_occurence_id = attendance.event_occurence_id 
        group by classes.class_name, events.event_id, person_class.type, person_class.person_id
        having absent >= ?
        order by classes.class_name, events.event_name, persons.person_name;
        `,
        [type, type, school.school_id, occurenceCount, minCount],
      );
      result.push({
        school_id: '' + school.school_id,
        school_name: school.school_name,
        classes: this.aggregateAbsenceReport(results),
      });
    }
    return { schools: result };
  }

  async getClassAbsentPeople(
    userId: number,
    type: string,
    occurenceCount: number,
    minCount: number,
  ) {
    const joinedSchools = await this.getSchoolsJoinedByUser(userId);
    const result = [];
    const results: absenceRecord[] = [] as unknown[] as absenceRecord[];
    for (const school of joinedSchools) {
      const joinedClasses = await this.getSchoolsJoinedBySchoolAndUser(
        school.school_id,
        userId,
      );
      for (const joinedClass of joinedClasses) {
        // eslint-disable-next-line prettier/prettier
        const classResults = await this.databaseService.executeQuery<absenceRecord[]>(
          `
          select 
            count(person_class.person_id) - count(attendance.person_id) as absent,
            classes.class_name,
            events.event_name, 
            persons.person_name,
            person_class.type
          from person_class 
          inner join classes on 
            (? = 'all' or person_class.type = ?) and
            person_class.class_id = classes.class_id and 
            classes.class_id=?
          inner join persons using(person_id) 
          inner join events on 
            (events.type = 'all' or events.type = person_class.type) and 
            classes.class_id = events.class_id 
          inner join(
            SELECT 
              event_id, 
              event_occurence_id,
              ROW_NUMBER() OVER (PARTITION BY event_id ORDER BY occurence_date DESC) AS rn 
            from event_occurence
          ) AS ranked_occurrences on 
            ranked_occurrences.rn <= ? and 
            events.event_id = ranked_occurrences.event_id 
          left join attendance on 
            person_class.person_id = attendance.person_id and 
            ranked_occurrences.event_occurence_id = attendance.event_occurence_id 
          group by classes.class_name, events.event_id, person_class.type, person_class.person_id
          having absent >= ?;
          `,
          [type, type, joinedClass.class_id, occurenceCount, minCount],
        );
        results.push(...classResults);
      }
      result.push({
        school_id: '' + school.school_id,
        school_name: school.school_name,
        classes: this.aggregateAbsenceReport(results),
      });
    }
    return { schools: result };
  }

  aggregateAbsenceReport(records: absenceRecord[]) {
    const aggregated: any = {};
    type events = [
      {
        event_name: string;
        records: [{ person_name: string; absent: number }];
      },
    ];
    type types = [{ type: string; events: events }];
    type school = { class_name: string; types: types };
    const result: school[] = [] as unknown[] as school[];

    for (const record of records) {
      if (aggregated[record.class_name]) {
        if (aggregated[record.class_name][record.type]) {
          if (
            aggregated[record.class_name][record.type][record.event_name] ==
            undefined
          ) {
            aggregated[record.class_name][record.type][record.event_name] = [];
          }
        } else {
          aggregated[record.class_name][record.type] = {};
          aggregated[record.class_name][record.type][record.event_name] = [];
        }
      } else {
        aggregated[record.class_name] = {};
        aggregated[record.class_name][record.type] = {};
        aggregated[record.class_name][record.type][record.event_name] = [];
      }
      aggregated[record.class_name][record.type][record.event_name].push({
        person_name: record.person_name,
        absent: record.absent,
      });
    }

    for (const class_name of Object.keys(aggregated)) {
      const types = [] as unknown[] as types;
      for (const type of Object.keys(aggregated[class_name])) {
        const events: events = [] as unknown[] as events;
        for (const event_name of Object.keys(aggregated[class_name][type])) {
          events.push({
            event_name,
            records: aggregated[class_name][type][event_name],
          });
        }
        types.push({ type, events });
      }
      result.push({ class_name, types });
    }
    return result;
  }
}
