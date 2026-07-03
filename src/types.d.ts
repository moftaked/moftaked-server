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

export type ReservationState = 'draft' | 'waiting_for_approval' | 'reserved' | 'waiting_for_pickup' | 'picked_up' | 'waiting_for_return' | 'returned' | 'completed';

export type ReviewerStatus = 'pending' | 'approved' | 'rejected';

export interface ReservationRow extends RowDataPacket {
  reservation_id: number;
  class_id: number;
  receiver_account_id: number;
  pickup_datetime: string;
  return_datetime: string;
  state: ReservationState;
  notes: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface ReservationEquipmentRow extends RowDataPacket {
  reservation_equipment_id: number;
  reservation_id: number;
  equipment_id: number;
  quantity: number;
}

export interface ReservationReviewerRow extends RowDataPacket {
  reservation_reviewer_id: number;
  reservation_id: number;
  account_id: number;
  is_default: number;
  status: ReviewerStatus;
  reviewed_at: string | null;
  created_at: string;
}

export interface ReservationHistoryRow extends RowDataPacket {
  reservation_history_id: number;
  reservation_id: number;
  account_id: number;
  action: string;
  details: string | null;
  created_at: string;
}

export interface FcmTokenRow extends RowDataPacket {
  fcm_token_id: number;
  account_id: number;
  token: string;
  device_info: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferenceRow extends RowDataPacket {
  preference_id: number;
  account_id: number;
  notification_type: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}
