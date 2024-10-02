import { Request } from "express";
import { Role } from 'src/users/entities/role.entity';
import { RowDataPacket } from 'mysql2';


export interface authorizedRequest extends Request{
    user: reqUser
}

export interface classId implements RowDataPacket {
  [column: number]: any;
  [column: string]: any;
  ['constructor']: { name: 'RowDataPacket' };
  class_id: number;
}

export interface reqUser {
    sub: number;
    username: string;
    roles: Role[];
}