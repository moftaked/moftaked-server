import { generate } from 'generate-password';
import bcrypt from 'bcrypt';
import { getConnection } from './database.service';
import { PoolConnection, ResultSetHeader } from 'mysql2/promise';
import { User } from '../types';

async function generatePassword() {
  return new Promise<string>((resolve) => {
      const password = generate({
        length: 8,
        numbers: true,
        uppercase: true,
        lowercase: true,
      });
      resolve(password);
    });
}

async function createAccount(username: string, name: string, password?: string) {
  if(password == undefined) {
    password = await generatePassword()
  }

  const hash = await bcrypt.hash(password, 10);
  const connection = await getConnection();
  let userId: number;
    try {
      await connection.beginTransaction();
      const [insertUserResult] = await connection.query<ResultSetHeader>(
        'insert into accounts(username, password, real_name) values (?, ?, ?);',
        [username, hash, name],
      );
      userId = insertUserResult.insertId;
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    return {userId, password};
}

async function getAccountId(username: string, connection?: PoolConnection) {
  if(connection == undefined) {
    connection = await getConnection();
  }
  const [rows] = await connection.execute<[User]>('select account_id from accounts where username = ?', [username]);
  if(rows.length != 1) throw new Error('user not found');
  // to do: implement better error type
  return rows[0].account_id;
}

export default { createAccount, getAccountId }