import mysql from 'mysql2/promise';

let pool: mysql.Pool | undefined;

export function init(
  user: string,
  password: string,
  database: string,
  host: string,
  port: number,
) {
  pool = mysql.createPool({user, password, database, host, port});
}

export async function executeQuery<T extends mysql.QueryResult>(
  queryText: string,
  values: unknown[] = [],
) {
  if (!pool) {
    throw new Error('the database connection pool was not initiated');
  }

  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute<T>(queryText, values);
    return rows;
  } finally {
    connection.release();
  }
}

export async function getConnection() {
  if (!pool) {
    throw new Error('the database connection pool was not initiated');
  }
  const connection = await pool.getConnection();
  return connection;
}
