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

export interface EquipmentGroupRow extends RowDataPacket {
  group_id: number;
  group_name: string;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface EquipmentSubgroupRow extends RowDataPacket {
  subgroup_id: number;
  group_id: number;
  name: string;
  created_at: string;
}

export interface EquipmentRow extends RowDataPacket {
  equipment_id: number;
  group_id: number;
  subgroup_id: number | null;
  parent_equipment_id: number | null;
  name: string;
  description: string | null;
  quantity: number;
  photo: string | null;
  created_at: string;
  updated_at: string;
}

export interface EquipmentGroupMemberRow extends RowDataPacket {
  id: number;
  group_id: number;
  account_id: number;
  access_level: 'organizer' | 'member';
  created_at: string;
}
