import { Inject, Injectable } from '@nestjs/common';
import { Pool, QueryResult } from 'mysql2/promise';

@Injectable()
export class DatabaseService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  async executeQuery<T extends QueryResult>(
    queryText: string,
    values: any[] = [],
  ) {
    const connection = await this.pool.getConnection();
    try {
      const [rows] = await connection.query<T>(queryText, values);
      console.log('returning rows...')
      return rows;
    } finally {
      console.log('releasing connection...')
      connection.release();
    }
  }

  async getConnection() {
    const connection = await this.pool.getConnection();
    return connection;
  }
}
