import { generate } from 'generate-password';
import bcrypt from 'bcrypt';
import { getConnection } from './database.service';
import { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { executeQuery } from './database.service';
import { User } from '../types';

async function generatePassword() {
  return new Promise<string>(resolve => {
    const password = generate({
      length: 12,
      numbers: true,
      uppercase: true,
      lowercase: true,
      symbols: true,
      strict: true,
    });
    resolve(password);
  });
}

async function createAccount(
  username: string,
  name: string,
  password?: string,
) {
  if (password === undefined) {
    password = await generatePassword();
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
  return { userId, password };
}

async function getAccountId(username: string, connection?: PoolConnection) {
  if (connection === undefined) {
    connection = await getConnection();
  }
  const [rows] = await connection.execute<[User]>(
    'select account_id from accounts where username = ?',
    [username],
  );
  if (rows.length !== 1) throw new Error('user not found');
  // to do: implement better error type
  return rows[0].account_id;
}

async function isAdmin(accountId: number) {
  const rows = await executeQuery<RowDataPacket[]>(
    'select is_admin from accounts where account_id = ? limit 1',
    [accountId],
  );
  return rows[0]?.['is_admin'] === 1;
}

export default { createAccount, getAccountId, isAdmin };
