import mysql from 'mysql2/promise';

let pool: mysql.Pool | undefined;

export function init(
  user: string,
  password: string,
  database: string,
  host: string,
  port: number,
) {
  pool = mysql.createPool({ user, password, database, host, port, connectionLimit: 50 });
}

export async function executeQuery<T extends mysql.QueryResult>(
  queryText: string,
  values: unknown[] = [],
  timeoutMs = 5000,
) {
  if (!pool) {
    throw new Error('the database connection pool was not initiated');
  }

  const connection = await Promise.race([
    pool.getConnection(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`pool.getConnection() timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
  try {
    const [rows] = await connection.execute<T>(queryText, values);
    return rows;
  } finally {
    connection.release();
  }
}

export async function getConnection(timeoutMs = 5000) {
  if (!pool) {
    throw new Error('the database connection pool was not initiated');
  }
  const connection = await Promise.race([
    pool.getConnection(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`pool.getConnection() timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
  return connection;
}

export async function end() {
  if (pool) {
    pool.end();
    pool = undefined;
  }
}
