import { RowDataPacket } from 'mysql2';

export enum Roles {
  teacher = 'teacher',
  leader = 'leader',
  manager = 'manager',
}

export class Role implements RowDataPacket {
  [column: number]: any;
  [column: string]: any;
  ['constructor']: { name: 'RowDataPacket' };
  class_id: number;
  role: Roles;
}