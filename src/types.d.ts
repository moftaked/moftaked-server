import { Role } from 'src/users/entities/role.entity';
import { RowDataPacket } from 'mysql2';

export interface authorizedRequest extends Request {
  user: reqUser;
}

export interface classId extends RowDataPacket {
  [column: number]: any;
  [column: string]: any;
  ['constructor']: { name: 'RowDataPacket' };
  class_id: number;
}

export interface rawStat extends RowDataPacket {
  [column: number]: any;
  [column: string]: any;
  ['constructor']: { name: 'RowDataPacket' };
  event_name: string;
  type: string;
  attended: number;
  total: number;
}

export interface stat {
  type: string;
  attended: number;
  total: number;
}

export interface aggregatedStat {
  event_name: string;
  stats: stat[];
}

export interface school extends RowDataPacket {
  [column: number]: any;
  [column: string]: any;
  ['constructor']: { name: 'RowDataPacket' };
  school_id: number;
  school_name: string;
}

export interface reqUser {
  sub: number;
  username: string;
  roles: Role[];
}
