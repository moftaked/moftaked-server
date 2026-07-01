import { RowDataPacket } from 'mysql2';
import { StatusCodes } from 'http-status-codes';
import createHttpError from 'http-errors';
import { executeQuery, getConnection } from './database.service';
import dataVersionsService from './data-versions.service';
import {
  CreateEquipmentGroupDto,
  UpdateEquipmentGroupDto,
  AddMemberDto,
  UpdateMemberDto,
  CreateSubgroupDto,
  UpdateSubgroupDto,
  CreateEquipmentDto,
  UpdateEquipmentDto,
} from '../schemas/equipment.schemas';

// ---- Authorization helpers ----

async function isOrganizer(accountId: number, groupId: number): Promise<boolean> {
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT 1 FROM equipment_group_members WHERE account_id = ? AND group_id = ? AND access_level = ?',
    [accountId, groupId, 'organizer'],
  );
  return rows.length > 0;
}

async function hasViewAccess(accountId: number, groupId: number): Promise<boolean> {
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT 1 FROM equipment_group_members WHERE account_id = ? AND group_id = ?',
    [accountId, groupId],
  );
  return rows.length > 0;
}

// ---- Groups ----

async function createGroup(data: CreateEquipmentGroupDto, createdBy: number): Promise<number> {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute<RowDataPacket[]>(
      'INSERT INTO equipment_groups (group_name, created_by) VALUES (?, ?)',
      [data.group_name, createdBy],
    );
    const groupId = (result as any).insertId;
    await connection.execute(
      'INSERT INTO equipment_group_members (group_id, account_id, access_level) VALUES (?, ?, ?)',
      [groupId, createdBy, 'organizer'],
    );
    await connection.commit();
    dataVersionsService.touchEquipmentGroups().catch(() => {});
    dataVersionsService.touchEquipmentGroupItems(groupId).catch(() => {});
    return groupId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getUserGroups(userId: number): Promise<RowDataPacket[]> {
  return executeQuery<RowDataPacket[]>(
    `SELECT eg.group_id, eg.group_name, egm.access_level
     FROM equipment_groups eg
     INNER JOIN equipment_group_members egm ON eg.group_id = egm.group_id
     WHERE egm.account_id = ?
     ORDER BY eg.group_name`,
    [userId],
  );
}

async function updateGroup(groupId: number, data: UpdateEquipmentGroupDto): Promise<void> {
  if (data.group_name === undefined) return;
  await executeQuery(
    'UPDATE equipment_groups SET group_name = ? WHERE group_id = ?',
    [data.group_name, groupId],
  );
  dataVersionsService.touchEquipmentGroupItems(groupId).catch(() => {});
}

async function deleteGroup(groupId: number): Promise<void> {
  await executeQuery('DELETE FROM equipment_groups WHERE group_id = ?', [groupId]);
  dataVersionsService.touchEquipmentGroupItems(groupId).catch(() => {});
  dataVersionsService.touchEquipmentGroups().catch(() => {});
}

// ---- Subgroups ----

async function createSubgroup(groupId: number, data: CreateSubgroupDto): Promise<number> {
  const result = await executeQuery<RowDataPacket[]>(
    'INSERT INTO equipment_subgroups (group_id, name) VALUES (?, ?)',
    [groupId, data.name],
  );
  dataVersionsService.touchEquipmentGroupItems(groupId).catch(() => {});
  return (result as any).insertId;
}

async function getSubgroups(groupId: number): Promise<RowDataPacket[]> {
  return executeQuery<RowDataPacket[]>(
    'SELECT subgroup_id, name FROM equipment_subgroups WHERE group_id = ?',
    [groupId],
  );
}

async function updateSubgroup(subgroupId: number, groupId: number, data: UpdateSubgroupDto): Promise<void> {
  await executeQuery(
    'UPDATE equipment_subgroups SET name = ? WHERE subgroup_id = ? AND group_id = ?',
    [data.name, subgroupId, groupId],
  );
  dataVersionsService.touchEquipmentGroupItems(groupId).catch(() => {});
}

async function deleteSubgroup(subgroupId: number, groupId: number): Promise<void> {
  await executeQuery(
    'DELETE FROM equipment_subgroups WHERE subgroup_id = ? AND group_id = ?',
    [subgroupId, groupId],
  );
  dataVersionsService.touchEquipmentGroupItems(groupId).catch(() => {});
}

// ---- Members ----

async function addMember(groupId: number, data: AddMemberDto): Promise<void> {
  const [account] = await executeQuery<RowDataPacket[]>(
    'SELECT account_id FROM accounts WHERE username = ?',
    [data.username],
  );
  if (!account) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'المستخدم غير موجود');
  }
  await executeQuery(
    'INSERT INTO equipment_group_members (group_id, account_id, access_level) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE access_level = ?',
    [groupId, account['account_id'], data.access_level, data.access_level],
  );
}

async function getMembers(groupId: number): Promise<RowDataPacket[]> {
  return executeQuery<RowDataPacket[]>(
    `SELECT egm.id, egm.account_id, egm.access_level, a.username, a.real_name
     FROM equipment_group_members egm
     INNER JOIN accounts a ON egm.account_id = a.account_id
     WHERE egm.group_id = ?
     ORDER BY egm.access_level`,
    [groupId],
  );
}

async function updateMember(memberId: number, groupId: number, data: UpdateMemberDto): Promise<void> {
  await executeQuery(
    'UPDATE equipment_group_members SET access_level = ? WHERE id = ? AND group_id = ?',
    [data.access_level, memberId, groupId],
  );
}

async function removeMember(memberId: number, groupId: number): Promise<void> {
  await executeQuery(
    'DELETE FROM equipment_group_members WHERE id = ? AND group_id = ?',
    [memberId, groupId],
  );
}

// ---- Equipment Items ----

async function createItem(groupId: number, data: CreateEquipmentDto): Promise<number> {
  const result = await executeQuery<RowDataPacket[]>(
    'INSERT INTO equipment (group_id, subgroup_id, name, description, quantity) VALUES (?, ?, ?, ?, ?)',
    [groupId, data.subgroup_id ?? null, data.name, data.description ?? null, data.quantity],
  );
  dataVersionsService.touchEquipmentGroupItems(groupId).catch(() => {});
  return (result as any).insertId;
}

async function getItems(
  groupId: number,
  subgroupId?: number,
  search?: string,
): Promise<RowDataPacket[]> {
  let query = `SELECT e.equipment_id, e.group_id, e.subgroup_id, e.name, e.description, e.quantity, e.photo
               FROM equipment e
               WHERE e.group_id = ?`;
  const values: unknown[] = [groupId];

  if (subgroupId !== undefined) {
    query += ' AND e.subgroup_id = ?';
    values.push(subgroupId);
  }

  if (search) {
    query += ' AND e.name LIKE ?';
    values.push(`%${search}%`);
  }

  return executeQuery<RowDataPacket[]>(query, values);
}

async function getItemById(itemId: number): Promise<RowDataPacket | undefined> {
  const rows = await executeQuery<RowDataPacket[]>(
    `SELECT e.equipment_id, e.group_id, e.subgroup_id, e.name, e.description, e.quantity, e.photo
     FROM equipment e
     WHERE e.equipment_id = ?`,
    [itemId],
  );
  return rows[0];
}

async function getItemGroupId(itemId: number): Promise<number | null> {
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT group_id FROM equipment WHERE equipment_id = ?',
    [itemId],
  );
  return rows[0] ? rows[0]['group_id'] : null;
}

async function updateItem(itemId: number, data: UpdateEquipmentDto): Promise<number | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (data.name !== undefined) {
    sets.push('name = ?');
    values.push(data.name);
  }
  if (data.description !== undefined) {
    sets.push('description = ?');
    values.push(data.description);
  }
  if (data.quantity !== undefined) {
    sets.push('quantity = ?');
    values.push(data.quantity);
  }
  if (data.subgroup_id !== undefined) {
    sets.push('subgroup_id = ?');
    values.push(data.subgroup_id);
  }
  if (sets.length === 0) return null;
  values.push(itemId);
  await executeQuery(
    `UPDATE equipment SET ${sets.join(', ')} WHERE equipment_id = ?`,
    values,
  );
  const groupId = await getItemGroupId(itemId);
  if (groupId) {
    dataVersionsService.touchEquipmentGroupItems(groupId).catch(() => {});
  }
  return groupId;
}

async function deleteItem(itemId: number): Promise<number | null> {
  const groupId = await getItemGroupId(itemId);
  if (!groupId) return null;
  await executeQuery('DELETE FROM equipment WHERE equipment_id = ?', [itemId]);
  dataVersionsService.touchEquipmentGroupItems(groupId).catch(() => {});
  return groupId;
}

async function updateItemPhoto(itemId: number, photo: string): Promise<number | null> {
  const groupId = await getItemGroupId(itemId);
  if (!groupId) return null;
  await executeQuery('UPDATE equipment SET photo = ? WHERE equipment_id = ?', [photo, itemId]);
  dataVersionsService.touchEquipmentGroupItems(groupId).catch(() => {});
  return groupId;
}

async function getEquipmentIdByPhoto(baseFilename: string): Promise<number | null> {
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT equipment_id FROM equipment WHERE photo = ?',
    [baseFilename],
  );
  return rows[0] ? rows[0]['equipment_id'] : null;
}

async function getAccessibleGroupIds(userId: number): Promise<number[]> {
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT group_id FROM equipment_group_members WHERE account_id = ?',
    [userId],
  );
  return rows.map(r => r['group_id']);
}

async function ensureTables(): Promise<void> {
  await executeQuery(
    `CREATE TABLE IF NOT EXISTS equipment_groups (
      group_id INT AUTO_INCREMENT PRIMARY KEY,
      group_name VARCHAR(255) NOT NULL,
      created_by INT NOT NULL,
      FOREIGN KEY (created_by) REFERENCES accounts(account_id)
    )`,
  );
  await executeQuery(
    `CREATE TABLE IF NOT EXISTS equipment_group_members (
      id INT AUTO_INCREMENT PRIMARY KEY,
      group_id INT NOT NULL,
      account_id INT NOT NULL,
      access_level ENUM('organizer', 'member') NOT NULL DEFAULT 'member',
      FOREIGN KEY (group_id) REFERENCES equipment_groups(group_id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(account_id),
      UNIQUE KEY unique_member (group_id, account_id)
    )`,
  );
  await executeQuery(
    `CREATE TABLE IF NOT EXISTS equipment_subgroups (
      subgroup_id INT AUTO_INCREMENT PRIMARY KEY,
      group_id INT NOT NULL,
      name VARCHAR(255) NOT NULL,
      FOREIGN KEY (group_id) REFERENCES equipment_groups(group_id) ON DELETE CASCADE
    )`,
  );
  await executeQuery(
    `CREATE TABLE IF NOT EXISTS equipment (
      equipment_id INT AUTO_INCREMENT PRIMARY KEY,
      group_id INT NOT NULL,
      subgroup_id INT DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      quantity INT NOT NULL DEFAULT 1,
      photo VARCHAR(255) DEFAULT NULL,
      FOREIGN KEY (group_id) REFERENCES equipment_groups(group_id) ON DELETE CASCADE,
      FOREIGN KEY (subgroup_id) REFERENCES equipment_subgroups(subgroup_id) ON DELETE SET NULL
    )`,
  );
}

export default {
  ensureTables,
  isOrganizer,
  hasViewAccess,
  createGroup,
  getUserGroups,
  updateGroup,
  deleteGroup,
  createSubgroup,
  getSubgroups,
  updateSubgroup,
  deleteSubgroup,
  addMember,
  getMembers,
  updateMember,
  removeMember,
  createItem,
  getItems,
  getItemById,
  getItemGroupId,
  updateItem,
  deleteItem,
  updateItemPhoto,
  getEquipmentIdByPhoto,
  getAccessibleGroupIds,
};
