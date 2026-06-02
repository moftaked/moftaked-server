import mysql from 'mysql2/promise';
import { init, end } from '../../src/services/database.service';
import path from 'path';
import fs from 'fs';

const dbConfig = {
  host: process.env['DB_HOST'] ?? 'localhost',
  database: process.env['DB_NAME'] ?? 'moftaked',
  user: process.env['DB_USER'] ?? 'tony',
  password: process.env['DB_PASSWORD'] ?? '',
  port: parseInt(process.env['DB_PORT'] ?? '3306', 10),
};

let adminPool: mysql.Pool | undefined;
let helperPool: mysql.Pool | undefined;
let testDbName: string | undefined;

/**
 * Creates a temporary test database with a unique name, applies the full
 * schema DDL, and initialises the app's database.service pool to point at it.
 *
 * Call this in `beforeAll()` of each integration test suite.
 */
export async function createTestDatabase(): Promise<string> {
  testDbName = `moftaked_test_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  // Connect without a specific database so we can CREATE DATABASE
  adminPool = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 2,
  });

  await adminPool.query(`CREATE DATABASE \`${testDbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);

  // Apply schema DDL
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

  const schemaPool = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: testDbName,
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 2,
  });

  await schemaPool.query(schemaSql);

  helperPool = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: testDbName,
    multipleStatements: true,
    waitForConnections: true,
    connectionLimit: 50,
  });

  await schemaPool.end();

  // Point the application's database.service at the test DB
  init(dbConfig.user, dbConfig.password, testDbName, dbConfig.host, dbConfig.port);

  return testDbName;
}

/**
 * All table names in the schema, in an order that is safe to truncate
 * (child tables first, parents last). Because we disable FK checks this
 * ordering isn't strictly necessary, but it documents the dependency graph.
 */
const ALL_TABLES = [
  'attendance',
  'event_occurence',
  'events',
  'person_class',
  'phone_numbers',
  'roles',
  'data_versions',
  'classes',
  'accounts',
  'persons',
  'districts',
  'schools',
];

/**
 * Truncates every table in the test database so each individual test starts
 * with a clean slate. Uses `SET FOREIGN_KEY_CHECKS=0` so order doesn't matter.
 *
 * Call this in `beforeEach()` of each integration test suite.
 */
export async function truncateAllTables(): Promise<void> {
  if (!helperPool || !testDbName) {
    throw new Error('truncateAllTables called before createTestDatabase');
  }

  const statements = [
    'SET FOREIGN_KEY_CHECKS=0;',
    ...ALL_TABLES.map((t) => `DELETE FROM \`${t}\`;`),
    'SET FOREIGN_KEY_CHECKS=1;',
  ].join('\n');

  await helperPool.query(statements);
}

/**
 * Drops the temporary test database and closes the admin connection pool.
 *
 * Call this in `afterAll()` of each integration test suite.
 */
export async function dropTestDatabase(): Promise<void> {
  // Close the application's database.service pool first so Jest can exit cleanly
  await end();

  // Close the helper pool before dropping the database
  if (helperPool) {
    await helperPool.end();
    helperPool = undefined;
  }

  if (adminPool && testDbName) {
    try {
      await adminPool.query(`DROP DATABASE IF EXISTS \`${testDbName}\``);
    } catch {
      // Best-effort cleanup — don't let drop failures break the test run
      console.error(`Warning: failed to drop test database ${testDbName}`);
    }
    await adminPool.end();
    adminPool = undefined;
    testDbName = undefined;
  }
}

/**
 * Returns the current test database name (useful for debugging).
 */
export function getTestDbName(): string | undefined {
  return testDbName;
}

// ---------------------------------------------------------------------------
// Common seed-data helpers
// ---------------------------------------------------------------------------

export interface SeedSchool {
  school_id?: number;
  school_name: string;
}

export interface SeedDistrict {
  district_id?: number;
  district_name: string;
}

export interface SeedAccount {
  account_id?: number;
  username: string;
  password: string; // already-hashed bcrypt string
  real_name: string;
}

export interface SeedPerson {
  person_id?: number;
  person_name: string;
  address: string;
  district_id: number;
  normalized_person_name?: string;
  notes?: string;
  photo_link?: string;
}

export interface SeedClass {
  class_id?: number;
  class_name: string;
  school_id: number;
}

export interface SeedRole {
  role_id?: number;
  account_id: number;
  class_id: number;
  role: 'teacher' | 'leader' | 'manager';
  school_id: number;
}

export interface SeedEvent {
  event_id?: number;
  class_id: number;
  event_name: string;
  type: 'student' | 'teacher' | 'all';
}

export interface SeedEventOccurrence {
  event_occurence_id?: number;
  event_id: number;
  occurence_date: string; // 'YYYY-MM-DD'
}

export interface SeedPersonClass {
  person_class_id?: number;
  person_id: number;
  class_id: number;
  type: 'student' | 'teacher';
}

export interface SeedPhoneNumber {
  phone_number_id?: number;
  person_id: number;
  phone_number: string;
}

export interface SeedData {
  schools?: SeedSchool[];
  districts?: SeedDistrict[];
  accounts?: SeedAccount[];
  persons?: SeedPerson[];
  classes?: SeedClass[];
  roles?: SeedRole[];
  events?: SeedEvent[];
  eventOccurrences?: SeedEventOccurrence[];
  personClasses?: SeedPersonClass[];
  phoneNumbers?: SeedPhoneNumber[];
}

/**
 * Inserts common test fixtures into the test database. Inserts are done in
 * dependency order (schools/districts first, then accounts/persons, then
 * child tables). Returns the inserted IDs keyed by table.
 *
 * The returned ID arrays correspond positionally to the input arrays.
 */
export async function seedTestData(data: SeedData): Promise<{
  schoolIds: number[];
  districtIds: number[];
  accountIds: number[];
  personIds: number[];
  classIds: number[];
  roleIds: number[];
  eventIds: number[];
  eventOccurrenceIds: number[];
  personClassIds: number[];
  phoneNumberIds: number[];
}> {
  if (!helperPool || !testDbName) {
    throw new Error('seedTestData called before createTestDatabase');
  }

  const result = {
    schoolIds: [] as number[],
    districtIds: [] as number[],
    accountIds: [] as number[],
    personIds: [] as number[],
    classIds: [] as number[],
    roleIds: [] as number[],
    eventIds: [] as number[],
    eventOccurrenceIds: [] as number[],
    personClassIds: [] as number[],
    phoneNumberIds: [] as number[],
  };

  {
    // Schools
    for (const s of data.schools ?? []) {
      const [res] = await helperPool!.execute<mysql.ResultSetHeader>(
        'INSERT INTO schools (school_name) VALUES (?)',
        [s.school_name],
      );
      s.school_id = res.insertId;
      result.schoolIds.push(res.insertId);
    }

    // Districts
    for (const d of data.districts ?? []) {
      const [res] = await helperPool!.execute<mysql.ResultSetHeader>(
        'INSERT INTO districts (district_name) VALUES (?)',
        [d.district_name],
      );
      d.district_id = res.insertId;
      result.districtIds.push(res.insertId);
    }

    // Persons (depends on districts)
    for (const p of data.persons ?? []) {
      const [res] = await helperPool!.execute<mysql.ResultSetHeader>(
        'INSERT INTO persons (person_name, address, district_id, normalized_person_name, notes, photo_link) VALUES (?, ?, ?, ?, ?, ?)',
        [
          p.person_name,
          p.address,
          p.district_id,
          p.normalized_person_name ?? null,
          p.notes ?? null,
          p.photo_link ?? null,
        ],
      );
      p.person_id = res.insertId;
      result.personIds.push(res.insertId);
    }

    // Accounts (depends on persons — person_id is optional FK)
    for (const a of data.accounts ?? []) {
      const [res] = await helperPool!.execute<mysql.ResultSetHeader>(
        'INSERT INTO accounts (username, password, real_name) VALUES (?, ?, ?)',
        [a.username, a.password, a.real_name],
      );
      a.account_id = res.insertId;
      result.accountIds.push(res.insertId);
    }

    // Classes (depends on schools)
    for (const c of data.classes ?? []) {
      const [res] = await helperPool!.execute<mysql.ResultSetHeader>(
        'INSERT INTO classes (class_name, school_id) VALUES (?, ?)',
        [c.class_name, c.school_id],
      );
      c.class_id = res.insertId;
      result.classIds.push(res.insertId);
    }

    // Phone numbers (depends on persons)
    for (const pn of data.phoneNumbers ?? []) {
      const [res] = await helperPool!.execute<mysql.ResultSetHeader>(
        'INSERT INTO phone_numbers (person_id, phone_number) VALUES (?, ?)',
        [pn.person_id, pn.phone_number],
      );
      pn.phone_number_id = res.insertId;
      result.phoneNumberIds.push(res.insertId);
    }

    // Person-class assignments (depends on persons + classes)
    for (const pc of data.personClasses ?? []) {
      const [res] = await helperPool!.execute<mysql.ResultSetHeader>(
        'INSERT INTO person_class (person_id, class_id, type) VALUES (?, ?, ?)',
        [pc.person_id, pc.class_id, pc.type],
      );
      pc.person_class_id = res.insertId;
      result.personClassIds.push(res.insertId);
    }

    // Events (depends on classes)
    for (const e of data.events ?? []) {
      const [res] = await helperPool!.execute<mysql.ResultSetHeader>(
        'INSERT INTO events (class_id, event_name, type) VALUES (?, ?, ?)',
        [e.class_id, e.event_name, e.type],
      );
      e.event_id = res.insertId;
      result.eventIds.push(res.insertId);
    }

    // Event occurrences (depends on events)
    for (const eo of data.eventOccurrences ?? []) {
      const [res] = await helperPool!.execute<mysql.ResultSetHeader>(
        'INSERT INTO event_occurence (event_id, occurence_date) VALUES (?, ?)',
        [eo.event_id, eo.occurence_date],
      );
      eo.event_occurence_id = res.insertId;
      result.eventOccurrenceIds.push(res.insertId);
    }

    // Roles (depends on accounts + classes + schools)
    for (const r of data.roles ?? []) {
      const [res] = await helperPool!.execute<mysql.ResultSetHeader>(
        'INSERT INTO roles (account_id, class_id, role, school_id) VALUES (?, ?, ?, ?)',
        [r.account_id, r.class_id, r.role, r.school_id],
      );
      r.role_id = res.insertId;
      result.roleIds.push(res.insertId);
    }
  }

  return result;
}