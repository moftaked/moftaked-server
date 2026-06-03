import { RowDataPacket } from "mysql2/promise";
import { executeQuery } from "./database.service";
import { Err, Ok } from "result2";
import { StatusCodes } from "http-status-codes";
import { Roles } from "../enums/roles.enum";
import accountsService from "./accounts.service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface rawStat extends RowDataPacket {
  [column: number]: any;
  [column: string]: any;
  ['constructor']: { name: 'RowDataPacket' };
  event_name: string;
  type: string;
  attended: number;
  total: number;
}

export interface stat {
  type: string;
  attended: number;
  total: number;
}

export interface aggregatedStat {
  event_name: string;
  stats: stat[];
}

export interface school extends RowDataPacket {
  [column: number]: any;
  [column: string]: any;
  ['constructor']: { name: 'RowDataPacket' };
  school_id: number;
  school_name: string;
}

// ---------------------------------------------------------------------------
// Access / Role helpers
// ---------------------------------------------------------------------------

/**
 * Returns a summary of what the authenticated user has access to for reports.
 * This drives the client-side reports landing page.
 */
async function getReportsAccess(accountId: number) {
  if (await accountsService.isAdmin(accountId)) {
    const allSchools = await executeQuery<RowDataPacket[]>(
      'SELECT school_id, school_name FROM schools ORDER BY school_name',
    );
    const allClasses = await executeQuery<RowDataPacket[]>(
      `SELECT c.class_id, c.class_name, s.school_name
       FROM classes c INNER JOIN schools s USING(school_id)
       ORDER BY s.school_name, c.class_name`,
    );
    return {
      isManager: true,
      isLeader: true,
      isTeacher: true,
      managedSchools: allSchools.map(s => ({ school_id: s['school_id'], school_name: s['school_name'] })),
      leaderClasses: allClasses.map(c => ({ class_id: c['class_id'], class_name: c['class_name'], school_name: c['school_name'] })),
      teacherClasses: allClasses.map(c => ({ class_id: c['class_id'], class_name: c['class_name'], school_name: c['school_name'] })),
    };
  }

  // Get all roles for the user
  const roles = await executeQuery<RowDataPacket[]>(
    `SELECT r.role, r.class_id, r.school_id, c.class_name, s.school_name
     FROM roles r
     INNER JOIN classes c USING(class_id)
     INNER JOIN schools s ON c.school_id = s.school_id
     WHERE r.account_id = ?`,
    [accountId],
  );

  // Admin bypass: full access to everything
  if (roles.some(r => r['role'] === 'admin')) {
    const allSchools = await executeQuery<RowDataPacket[]>(
      'SELECT school_id, school_name FROM schools ORDER BY school_name',
    );
    const allClasses = await executeQuery<RowDataPacket[]>(
      `SELECT c.class_id, c.class_name, s.school_name
       FROM classes c INNER JOIN schools s USING(school_id)
       ORDER BY s.school_name, c.class_name`,
    );
    return {
      isManager: true,
      isLeader: true,
      isTeacher: true,
      managedSchools: allSchools.map(s => ({ school_id: s['school_id'], school_name: s['school_name'] })),
      leaderClasses: allClasses.map(c => ({ class_id: c['class_id'], class_name: c['class_name'], school_name: c['school_name'] })),
      teacherClasses: allClasses.map(c => ({ class_id: c['class_id'], class_name: c['class_name'], school_name: c['school_name'] })),
    };
  }

  const isManager = roles.some(r => r['role'] === 'manager');
  const isLeader = roles.some(r => r['role'] === 'leader');
  const isTeacher = roles.some(r => r['role'] === 'teacher');

  // Build unique schools/classes the user manages
  const managedSchools: { school_id: number; school_name: string }[] = [];
  const leaderClasses: { class_id: number; class_name: string; school_name: string }[] = [];
  const teacherClasses: { class_id: number; class_name: string; school_name: string }[] = [];

  const seenSchools = new Set<number>();
  const seenLeaderClasses = new Set<number>();
  const seenTeacherClasses = new Set<number>();

  for (const r of roles) {
    if (r['role'] === 'manager' && !seenSchools.has(r['school_id'])) {
      seenSchools.add(r['school_id']);
      managedSchools.push({ school_id: r['school_id'], school_name: r['school_name'] });
    }
    if ((r['role'] === 'leader' || r['role'] === 'manager') && !seenLeaderClasses.has(r['class_id'])) {
      seenLeaderClasses.add(r['class_id']);
      leaderClasses.push({
        class_id: r['class_id'],
        class_name: r['class_name'],
        school_name: r['school_name'],
      });
    }
    if (r['role'] === 'teacher' && !seenTeacherClasses.has(r['class_id'])) {
      seenTeacherClasses.add(r['class_id']);
      teacherClasses.push({
        class_id: r['class_id'],
        class_name: r['class_name'],
        school_name: r['school_name'],
      });
    }
  }

  return {
    isManager,
    isLeader,
    isTeacher,
    managedSchools,
    leaderClasses,
    teacherClasses,
  };
}

// ---------------------------------------------------------------------------
// Leader Event Report (existing, kept intact)
// ---------------------------------------------------------------------------

async function getLeaderEventReport(
  eventId: string,
  eventType: string,
  date: string,
) {
  const results = await executeQuery<RowDataPacket[]>(
    `select
      date_format(occurence_date, "%d/%c") as occurence_date,
      count(distinct attendance.person_id) as attended,
      count(distinct person_class.person_id) as total
    from events
    left join event_occurence on
      events.event_id = ? and
      events.event_id = event_occurence.event_id and
      occurence_date <= ?
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
    [eventId, date, eventType],
  );

  return results;
}

// ---------------------------------------------------------------------------
// Teacher Event Report (existing, kept intact)
// ---------------------------------------------------------------------------

async function getTeacherEventReport(
  eventId: string,
  date: string,
) {
  const results = await executeQuery<RowDataPacket[]>(
    `select
      date_format(occurence_date, "%d/%c") as occurence_date,
      count(distinct attendance.person_id) as attended,
      count(distinct person_class.person_id) as total
    from events
    left join event_occurence on
      events.event_id = event_occurence.event_id and
      occurence_date<=? and
      events.event_id = ?
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
    [date, eventId],
  );

  return results;
}

// ---------------------------------------------------------------------------
// Manager Overview (existing, enhanced)
// ---------------------------------------------------------------------------

async function getManagarialReports(accountId: number, date: string) {
  let managedSchools = await getSchoolsManagedByUser(accountId);
  if (managedSchools.isErr()) return managedSchools;
  const overAllStats: {
    school_id: number;
    school_name: string;
    stats: aggregatedStat[];
  }[] = [];
  for (const school of managedSchools.unwrap()) {
    const stats = await getSchoolOverAllStats(school.school_id, date);
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

async function aggregateOverAllStats(stats: rawStat[]) {
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

async function getSchoolsManagedByUser(account_id: number) {
  const results = await executeQuery<school[]>(
    `select distinct school_id, school_name
    from roles
    inner join schools using(school_id)
    where account_id=? and role='manager'`,
    [account_id],
  );

  if (!results || results.length === 0) {
    const adminCheck = await executeQuery<RowDataPacket[]>(
      'SELECT role FROM roles WHERE account_id = ? AND role = ? LIMIT 1',
      [account_id, Roles.admin],
    );
    if (adminCheck && adminCheck.length > 0) {
      const allSchools = await executeQuery<school[]>(
        'SELECT school_id, school_name FROM schools ORDER BY school_name',
      );
      return Ok(allSchools);
    }
    return Err(StatusCodes.FORBIDDEN);
  }

  return Ok(results);
}

async function getSchoolOverAllStats(schoolId: number, date: string) {
  const results = await executeQuery<rawStat[]>(
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
  return aggregateOverAllStats(results);
}

// ---------------------------------------------------------------------------
// Class Attendance Summary
// ---------------------------------------------------------------------------

/**
 * Returns a per-event attendance summary for a class on a given date.
 * Shows each event, how many attended, total, and the attendance percentage.
 */
async function getClassAttendanceSummary(classId: number, date: string) {
  const results = await executeQuery<RowDataPacket[]>(
    `
    SELECT
      e.event_id,
      e.event_name,
      e.type as event_type,
      pc.type as person_type,
      eo.event_occurence_id,
      DATE_FORMAT(eo.occurence_date, '%Y-%m-%d') as occurence_date,
      COUNT(DISTINCT pc.person_id) as total,
      COUNT(DISTINCT a.person_id) as attended
    FROM events e
    INNER JOIN classes c ON e.class_id = c.class_id AND c.class_id = ?
    LEFT JOIN event_occurence eo ON
      e.event_id = eo.event_id AND
      eo.occurence_date = ?
    LEFT JOIN person_class pc ON
      e.class_id = pc.class_id AND
      (e.type = 'all' OR e.type = pc.type)
    LEFT JOIN attendance a ON
      eo.event_occurence_id = a.event_occurence_id AND
      pc.person_id = a.person_id
    GROUP BY e.event_id, e.event_name, e.type, pc.type, eo.event_occurence_id, eo.occurence_date
    HAVING pc.type IS NOT NULL
    ORDER BY e.event_id ASC, pc.type;
    `,
    [classId, date],
  );

  // Aggregate into a nicer structure
  const events: {
    event_id: number;
    event_name: string;
    event_type: string;
    has_occurrence: boolean;
    breakdown: {
      person_type: string;
      total: number;
      attended: number;
      absent: number;
      rate: number;
    }[];
  }[] = [];

  const eventMap = new Map<number, typeof events[0]>();

  for (const row of results) {
    let event = eventMap.get(row['event_id']);
    if (!event) {
      event = {
        event_id: row['event_id'],
        event_name: row['event_name'],
        event_type: row['event_type'],
        has_occurrence: row['event_occurence_id'] !== null,
        breakdown: [],
      };
      eventMap.set(row['event_id'], event);
      events.push(event);
    }
    const total = Number(row['total']);
    const attended = Number(row['attended']);
    event.breakdown.push({
      person_type: row['person_type'],
      total,
      attended,
      absent: total - attended,
      rate: total > 0 ? Math.round((attended / total) * 100) : 0,
    });
  }

  // Get class info
  const classInfo = await executeQuery<RowDataPacket[]>(
    `SELECT c.class_id, c.class_name, s.school_name
     FROM classes c
     INNER JOIN schools s USING(school_id)
     WHERE c.class_id = ?`,
    [classId],
  );

  return {
    class_id: classId,
    class_name: classInfo[0]?.['class_name'] ?? '',
    school_name: classInfo[0]?.['school_name'] ?? '',
    date,
    events,
  };
}

// ---------------------------------------------------------------------------
// Event Attendance Trends (enhanced)
// ---------------------------------------------------------------------------

/**
 * Returns attendance trend data for a specific event over the last N occurrences.
 * Includes detailed per-occurrence stats.
 */
async function getEventAttendanceTrends(
  eventId: number,
  personType: string,
  limit: number = 10,
) {
  const results = await executeQuery<RowDataPacket[]>(
    `
    SELECT
      eo.event_occurence_id,
      DATE_FORMAT(eo.occurence_date, '%Y-%m-%d') as occurence_date,
      DATE_FORMAT(eo.occurence_date, '%d/%c') as display_date,
      COUNT(DISTINCT pc.person_id) as total,
      COUNT(DISTINCT a.person_id) as attended
    FROM events e
    INNER JOIN event_occurence eo ON e.event_id = eo.event_id AND e.event_id = ?
    LEFT JOIN person_class pc ON
      e.class_id = pc.class_id AND pc.type = ?
    LEFT JOIN attendance a ON
      eo.event_occurence_id = a.event_occurence_id AND
      pc.person_id = a.person_id
    GROUP BY eo.event_occurence_id, eo.occurence_date
    ORDER BY eo.occurence_date DESC
    LIMIT ${Number(limit)};
    `,
    [eventId, personType],
  );

  // Get event info
  const eventInfo = await executeQuery<RowDataPacket[]>(
    `SELECT e.event_id, e.event_name, e.type as event_type, c.class_id, c.class_name
     FROM events e
     INNER JOIN classes c USING(class_id)
     WHERE e.event_id = ?`,
    [eventId],
  );

  const occurrences = results.map(row => {
    const total = Number(row['total']);
    const attended = Number(row['attended']);
    return {
      event_occurence_id: row['event_occurence_id'],
      occurence_date: row['occurence_date'],
      display_date: row['display_date'],
      total,
      attended,
      absent: total - attended,
      rate: total > 0 ? Math.round((attended / total) * 100) : 0,
    };
  });

  // Calculate aggregate stats
  const totalOccurrences = occurrences.length;
  const avgRate = totalOccurrences > 0
    ? Math.round(occurrences.reduce((sum, o) => sum + o.rate, 0) / totalOccurrences)
    : 0;
  const highestRate = totalOccurrences > 0
    ? Math.max(...occurrences.map(o => o.rate))
    : 0;
  const lowestRate = totalOccurrences > 0
    ? Math.min(...occurrences.map(o => o.rate))
    : 0;

  return {
    event_id: eventId,
    event_name: eventInfo[0]?.['event_name'] ?? '',
    event_type: eventInfo[0]?.['event_type'] ?? '',
    class_id: eventInfo[0]?.['class_id'] ?? 0,
    class_name: eventInfo[0]?.['class_name'] ?? '',
    person_type: personType,
    summary: {
      total_occurrences: totalOccurrences,
      average_rate: avgRate,
      highest_rate: highestRate,
      lowest_rate: lowestRate,
    },
    occurrences: occurrences.reverse(), // chronological order
  };
}

// ---------------------------------------------------------------------------
// Absentees List
// ---------------------------------------------------------------------------

/**
 * Returns a list of people who were absent for a specific event occurrence
 * (identified by class + event + date).
 */
async function getAbsentees(
  classId: number,
  eventId: number,
  date: string,
) {
  const results = await executeQuery<RowDataPacket[]>(
    `
    SELECT
      p.person_id,
      p.person_name,
      pc.type as person_type,
      GROUP_CONCAT(pn.phone_number SEPARATOR ', ') as phone_numbers,
      d.district_name
    FROM events e
    INNER JOIN event_occurence eo ON
      e.event_id = eo.event_id AND
      e.event_id = ? AND
      eo.occurence_date = ?
    INNER JOIN person_class pc ON
      e.class_id = pc.class_id AND
      pc.class_id = ? AND
      (e.type = 'all' OR e.type = pc.type)
    INNER JOIN persons p ON pc.person_id = p.person_id
    LEFT JOIN attendance a ON
      eo.event_occurence_id = a.event_occurence_id AND
      p.person_id = a.person_id
    LEFT JOIN phone_numbers pn ON p.person_id = pn.person_id
    LEFT JOIN districts d ON p.district_id = d.district_id
    WHERE a.person_id IS NULL
    GROUP BY p.person_id, p.person_name, pc.type, d.district_name
    ORDER BY pc.type, p.person_name;
    `,
    [eventId, date, classId],
  );

  const students = results.filter(r => r['person_type'] === 'student').map(r => ({
    person_id: r['person_id'],
    person_name: r['person_name'],
    phone_numbers: r['phone_numbers'],
    district_name: r['district_name'],
  }));

  const teachers = results.filter(r => r['person_type'] === 'teacher').map(r => ({
    person_id: r['person_id'],
    person_name: r['person_name'],
    phone_numbers: r['phone_numbers'],
    district_name: r['district_name'],
  }));

  return {
    class_id: classId,
    event_id: eventId,
    date,
    students,
    teachers,
    total_absent_students: students.length,
    total_absent_teachers: teachers.length,
  };
}

// ---------------------------------------------------------------------------
// Person Attendance History
// ---------------------------------------------------------------------------

/**
 * Returns an individual person's attendance history across all events
 * they are enrolled in.
 */
async function getPersonAttendanceHistory(
  personId: number,
  personType: string,
  limit: number = 20,
) {
  // Get person info
  const personInfo = await executeQuery<RowDataPacket[]>(
    `SELECT p.person_id, p.person_name
     FROM persons p
     WHERE p.person_id = ?`,
    [personId],
  );

  if (personInfo.length === 0) {
    return null;
  }

  // Get all events the person is in
  const events = await executeQuery<RowDataPacket[]>(
    `
    SELECT DISTINCT
      e.event_id,
      e.event_name,
      e.type as event_type,
      c.class_id,
      c.class_name
    FROM person_class pc
    INNER JOIN events e ON pc.class_id = e.class_id
    INNER JOIN classes c ON e.class_id = c.class_id
    WHERE pc.person_id = ? AND pc.type = ?
      AND (e.type = 'all' OR e.type = ?)
    ORDER BY c.class_name, e.event_name;
    `,
    [personId, personType, personType],
  );

  // For each event, get recent attendance
  const eventHistories: {
    event_id: number;
    event_name: string;
    class_id: number;
    class_name: string;
    total_occurrences: number;
    attended_count: number;
    rate: number;
    recent: {
      occurence_date: string;
      display_date: string;
      attended: boolean;
    }[];
  }[] = [];

  for (const event of events) {
    const history = await executeQuery<RowDataPacket[]>(
      `
      SELECT
        eo.event_occurence_id,
        DATE_FORMAT(eo.occurence_date, '%Y-%m-%d') as occurence_date,
        DATE_FORMAT(eo.occurence_date, '%d/%c') as display_date,
        IF(a.person_id IS NULL, 0, 1) as attended
      FROM event_occurence eo
      LEFT JOIN attendance a ON
        eo.event_occurence_id = a.event_occurence_id AND
        a.person_id = ?
      WHERE eo.event_id = ?
      ORDER BY eo.occurence_date DESC
      LIMIT ${Number(limit)};
      `,
      [personId, event['event_id']],
    );

    const totalOccurrences = history.length;
    const attendedCount = history.filter(h => Number(h['attended']) === 1).length;

    eventHistories.push({
      event_id: event['event_id'],
      event_name: event['event_name'],
      class_id: event['class_id'],
      class_name: event['class_name'],
      total_occurrences: totalOccurrences,
      attended_count: attendedCount,
      rate: totalOccurrences > 0 ? Math.round((attendedCount / totalOccurrences) * 100) : 0,
      recent: history.reverse().map(h => ({
        occurence_date: h['occurence_date'],
        display_date: h['display_date'],
        attended: Number(h['attended']) === 1,
      })),
    });
  }

  // Calculate overall attendance rate
  const totalEvents = eventHistories.reduce((sum, e) => sum + e.total_occurrences, 0);
  const totalAttended = eventHistories.reduce((sum, e) => sum + e.attended_count, 0);
  const overallRate = totalEvents > 0 ? Math.round((totalAttended / totalEvents) * 100) : 0;

  return {
    person_id: personId,
    person_name: personInfo[0]?.['person_name'] ?? '',
    person_type: personType,
    overall: {
      total_occurrences: totalEvents,
      attended: totalAttended,
      absent: totalEvents - totalAttended,
      rate: overallRate,
    },
    events: eventHistories,
  };
}

// ---------------------------------------------------------------------------
// Class Available Dates
// ---------------------------------------------------------------------------

/**
 * Returns the list of dates that have event occurrences for a given class.
 * Useful for date pickers in the reports UI.
 */
async function getClassAvailableDates(classId: number, limit: number = 30) {
  const results = await executeQuery<RowDataPacket[]>(
    `
    SELECT
      DATE_FORMAT(eo.occurence_date, '%Y-%m-%d') as \`date\`,
      DATE_FORMAT(eo.occurence_date, '%d/%c/%Y') as display_date
    FROM event_occurence eo
    INNER JOIN events e ON eo.event_id = e.event_id
    WHERE e.class_id = ?
    GROUP BY eo.occurence_date
    ORDER BY eo.occurence_date DESC
    LIMIT ${Number(limit)};
    `,
    [classId],
  );
  return results;
}

// ---------------------------------------------------------------------------
// Chronic Absentees (manager/leader feature)
// ---------------------------------------------------------------------------

/**
 * Returns people who have attended less than a threshold percentage
 * of the last N occurrences. Helps identify chronic absentees.
 */
async function getChronicAbsentees(
  classId: number,
  personType: string,
  thresholdPercent: number = 50,
) {
  const results = await executeQuery<RowDataPacket[]>(
    `
    SELECT
      p.person_id,
      p.person_name,
      e.event_id,
      e.event_name,
      COUNT(DISTINCT eo.event_occurence_id) as total_occurrences,
      COUNT(DISTINCT a.event_occurence_id) as attended_count,
      GROUP_CONCAT(DISTINCT pn.phone_number SEPARATOR ', ') as phone_numbers
    FROM events e
    INNER JOIN (
      SELECT eo2.event_id, eo2.event_occurence_id
      FROM event_occurence eo2
      INNER JOIN events e2 ON eo2.event_id = e2.event_id AND e2.class_id = ?
      INNER JOIN (
        SELECT event_id, occurence_date
        FROM event_occurence
        INNER JOIN events USING(event_id)
        WHERE events.class_id = ?
        ORDER BY occurence_date DESC
      ) ranked ON eo2.event_id = ranked.event_id
      GROUP BY eo2.event_id, eo2.event_occurence_id
    ) eo ON e.event_id = eo.event_id
    INNER JOIN person_class pc ON
      e.class_id = pc.class_id AND
      pc.type = ? AND
      (e.type = 'all' OR e.type = ?)
    INNER JOIN persons p ON pc.person_id = p.person_id
    LEFT JOIN attendance a ON
      eo.event_occurence_id = a.event_occurence_id AND
      p.person_id = a.person_id
    LEFT JOIN phone_numbers pn ON p.person_id = pn.person_id
    WHERE e.class_id = ?
    GROUP BY p.person_id, p.person_name, e.event_id, e.event_name
    HAVING total_occurrences > 0
      AND (attended_count / total_occurrences * 100) < ?
    ORDER BY (attended_count / total_occurrences) ASC, p.person_name;
    `,
    [classId, classId, personType, personType, classId, thresholdPercent],
  );

  return results.map(r => ({
    person_id: r['person_id'],
    person_name: r['person_name'],
    event_id: r['event_id'],
    event_name: r['event_name'],
    total_occurrences: Number(r['total_occurrences']),
    attended_count: Number(r['attended_count']),
    rate: Number(r['total_occurrences']) > 0
      ? Math.round((Number(r['attended_count']) / Number(r['total_occurrences'])) * 100)
      : 0,
    phone_numbers: r['phone_numbers'],
  }));
}

// ---------------------------------------------------------------------------
// Comparison Report (manager feature)
// ---------------------------------------------------------------------------

/**
 * Returns attendance comparison across multiple classes in a school
 * for a given date. Useful for managers to compare performance.
 */
async function getSchoolClassComparison(schoolId: number, date: string) {
  // todo: rename all this shit from comparison to summary
  const results = await executeQuery<RowDataPacket[]>(
    `
    SELECT
      c.class_id,
      c.class_name,
      e.event_id,
      e.event_name,
      pc.type as person_type,
      COUNT(DISTINCT pc.person_id) as total,
      COUNT(DISTINCT a.person_id) as attended
    FROM classes c
    INNER JOIN events e ON c.class_id = e.class_id
    LEFT JOIN event_occurence eo ON
      e.event_id = eo.event_id AND
      eo.occurence_date = ?
    LEFT JOIN person_class pc ON
      e.class_id = pc.class_id AND
      (e.type = 'all' OR e.type = pc.type)
    LEFT JOIN attendance a ON
      eo.event_occurence_id = a.event_occurence_id AND
      pc.person_id = a.person_id
    WHERE c.school_id = ?
    GROUP BY c.class_id, c.class_name, e.event_id, e.event_name, pc.type
    HAVING pc.type IS NOT NULL
    ORDER BY e.event_id ASC, c.class_name, pc.type;
    `,
    [date, schoolId],
  );

  const classMap = new Map<number, {
    class_id: number;
    class_name: string;
    events: {
      event_id: number;
      event_name: string;
      breakdown: {
        person_type: string;
        total: number;
        attended: number;
        rate: number;
      }[];
    }[];
  }>();

  for (const row of results) {
    let cls = classMap.get(row['class_id']);
    if (!cls) {
      cls = {
        class_id: row['class_id'],
        class_name: row['class_name'],
        events: [],
      };
      classMap.set(row['class_id'], cls);
    }

    let event = cls.events.find(ev => ev.event_id === row['event_id']);
    if (!event) {
      event = {
        event_id: row['event_id'],
        event_name: row['event_name'],
        breakdown: [],
      };
      cls.events.push(event);
    }

    const total = Number(row['total']);
    const attended = Number(row['attended']);
    event.breakdown.push({
      person_type: row['person_type'],
      total,
      attended,
      rate: total > 0 ? Math.round((attended / total) * 100) : 0,
    });
  }

  // Get school info
  const schoolInfo = await executeQuery<RowDataPacket[]>(
    `SELECT school_id, school_name FROM schools WHERE school_id = ?`,
    [schoolId],
  );

  return {
    school_id: schoolId,
    school_name: schoolInfo[0]?.['school_name'] ?? '',
    date,
    classes: Array.from(classMap.values()),
  };
}

// ---------------------------------------------------------------------------
// User-specific class role check
// ---------------------------------------------------------------------------

/**
 * Check what role the user has for a specific class.
 * Returns null if no access.
 */
async function getUserClassRole(accountId: number, classId: number) {
  if (await accountsService.isAdmin(accountId)) return 'manager';

  const roles = await executeQuery<RowDataPacket[]>(
    `SELECT role FROM roles WHERE account_id = ? AND class_id = ?`,
    [accountId, classId],
  );

  if (roles.length === 0) return null;

  // Return highest role
  if (roles.some(r => r['role'] === 'manager')) return 'manager';
  if (roles.some(r => r['role'] === 'leader')) return 'leader';
  if (roles.some(r => r['role'] === 'teacher')) return 'teacher';
  return null;
}

async function getUserPersonRole(
  accountId: number,
  personId: number,
  personType: string,
) {
  const personClasses = await executeQuery<RowDataPacket[]>(
    `SELECT class_id FROM person_class WHERE person_id = ? AND type = ?`,
    [personId, personType],
  );

  if (personClasses.length === 0) return null;

  const classIds = personClasses.map(row => Number(row['class_id']));
  const roles = await executeQuery<RowDataPacket[]>(
    `SELECT role FROM roles WHERE account_id = ? AND class_id IN (${classIds.map(() => '?').join(', ')})`,
    [accountId, ...classIds],
  );

  if (roles.length === 0) return null;

  if (roles.some(r => r['role'] === 'manager')) return 'manager';
  if (roles.some(r => r['role'] === 'leader')) return 'leader';
  if (roles.some(r => r['role'] === 'teacher')) return 'teacher';
  return null;
}

/**
 * Check if the user has manager access to a school.
 */
async function isSchoolManager(accountId: number, schoolId: number) {
  if (await accountsService.isAdmin(accountId)) return true;

  const roles = await executeQuery<RowDataPacket[]>(
    `SELECT role FROM roles WHERE account_id = ? AND school_id = ? AND role = 'manager'`,
    [accountId, schoolId],
  );
  return roles.length > 0;
}

// ---------------------------------------------------------------------------
// User Available Dates (across all classes the user belongs to)
// ---------------------------------------------------------------------------

/**
 * Returns distinct dates that have event occurrences in ANY class the
 * authenticated user has a role in. Used by the top-level /reports page
 * date picker so the user can only pick dates that actually have data.
 */
async function getUserAvailableDates(accountId: number) {
  const isAdminUser = await accountsService.isAdmin(accountId);

  let query: string;
  const params: any[] = [];

  if (isAdminUser) {
    query = `
      SELECT
        DATE_FORMAT(eo.occurence_date, '%Y-%m-%d') AS \`date\`,
        DATE_FORMAT(eo.occurence_date, '%d/%c/%Y') AS display_date
      FROM event_occurence eo
      INNER JOIN events e ON eo.event_id = e.event_id
      GROUP BY eo.occurence_date
      ORDER BY eo.occurence_date DESC
    `;
  } else {
    query = `
      SELECT
        DATE_FORMAT(eo.occurence_date, '%Y-%m-%d') AS \`date\`,
        DATE_FORMAT(eo.occurence_date, '%d/%c/%Y') AS display_date
      FROM event_occurence eo
      INNER JOIN events e ON eo.event_id = e.event_id
      INNER JOIN roles r ON e.class_id = r.class_id AND r.account_id = ?
      GROUP BY eo.occurence_date
      ORDER BY eo.occurence_date DESC
    `;
    params.push(accountId);
  }

  const results = await executeQuery<RowDataPacket[]>(query, params);
  return results;
}

export default {
  getReportsAccess,
  getLeaderEventReport,
  getTeacherEventReport,
  getManagarialReports,
  getClassAttendanceSummary,
  getEventAttendanceTrends,
  getAbsentees,
  getPersonAttendanceHistory,
  getClassAvailableDates,
  getChronicAbsentees,
  getSchoolClassComparison,
  getUserClassRole,
  getUserPersonRole,
  isSchoolManager,
  getUserAvailableDates,
};
