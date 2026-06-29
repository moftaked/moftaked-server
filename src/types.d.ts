import { RowDataPacket } from 'mysql2';

export interface User extends RowDataPacket {
  [column: number]: unknown;
  [column: string]: unknown;
  ['constructor']: { name: 'RowDataPacket' };
  account_id: number;
  username: string;
  password: string;
  real_name: string;
}

export type DbConfig = {
  host: string;
  database: string;
  user: string;
  password: string;
  port: number;
};

export interface RefreshTokenRow extends RowDataPacket {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: string;
  created_at: string;
  revoked_at: string | null;
}
