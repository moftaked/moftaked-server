import * as arabic from "@flowdegree/arabic-strings";
import { executeQuery, getConnection, init } from "../services/database.service";
import { RowDataPacket } from "mysql2";
import 'dotenv/config';
import { DbConfig } from "../types";
import { stdout } from "node:process";

if (!process.env['DB_HOST']) throw new Error('DB_HOST is not defined');
if (!process.env['DB_NAME']) throw new Error('DB_NAME is not defined');
if (!process.env['DB_USER']) throw new Error('DB_USER is not defined');
if (!process.env['DB_PASSWORD']) throw new Error('DB_PASSWORD is not defined');
if (!process.env['DB_PORT']) throw new Error('DB_PORT is not defined');

const dbConfig: DbConfig = {
  host: process.env['DB_HOST'],
  database: process.env['DB_NAME'],
  user: process.env['DB_USER'],
  password: process.env['DB_PASSWORD'],
  port: parseInt(process.env['DB_PORT'], 10),
};

init(
  dbConfig.user,
  dbConfig.password,
  dbConfig.database,
  dbConfig.host,
  dbConfig.port,
);

(async () => {
  const unprocessedNames = await executeQuery<RowDataPacket[]>(
    'select person_id, person_name from persons where normalized_person_name is null'
  );
  
  const connection = await getConnection();
  await connection.beginTransaction();
  unprocessedNames.forEach(person => {
    const normalizedName = arabic.sanitize(person['person_name'])
    connection.execute(`
      update persons 
      set normalized_person_name = ? 
      where person_id = ?`, 
      [normalizedName, person['person_id']]
    );
    stdout.write('.')
  });
  connection.commit();
  stdout.write('completed')
})()
