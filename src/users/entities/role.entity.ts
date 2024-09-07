import { RowDataPacket } from 'mysql2';

export class Role implements RowDataPacket {
  [column: number]: any;
  [column: string]: any;
  ['constructor']: { name: 'RowDataPacket' };
  class_id: string;
  role: string;
}
