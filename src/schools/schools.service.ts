import { ForbiddenException, Injectable } from '@nestjs/common';
import { RowDataPacket } from 'mysql2';
import { DatabaseService } from 'src/database/database.service';
import { aggregatedStat, rawStat, school, stat } from 'src/types';

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
      order by occurence_date asc
      limit 5;
      `,
      [schoolId, date, eventName, eventType],
    );

    return { length: results.length, results };
  }
}
