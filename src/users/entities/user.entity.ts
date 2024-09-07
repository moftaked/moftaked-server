import { RowDataPacket } from 'mysql2';

export class User implements RowDataPacket {
  [column: number]: any;
  [column: string]: any;
  ['constructor']: { name: 'RowDataPacket' };
  account_id: number;
  username: string;
  password: string;
  real_name: string;
}
