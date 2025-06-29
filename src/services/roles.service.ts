import { RowDataPacket } from 'mysql2/promise';
import { Roles } from '../enums/roles.enum';
import accountsService from './accounts.service';
import { executeQuery, getConnection } from './database.service';

async function getRoles(accountId: number, schoolId?: number, classId?: number) {
  let queryStr = 'select class_id, role, school_id from roles where account_id = ?';
  const queryParams = [accountId];
  if(schoolId !== undefined) {
    queryStr = queryStr + 'and school_id = ?';
    queryParams.push(schoolId);
  }
  if(classId !== undefined) {
    queryStr = queryStr + 'and class_id = ?';
    queryParams.push(classId);
  }

  const roles = await executeQuery<RowDataPacket[]>(
    queryStr,
    queryParams,
  );

  return roles;
}

async function addRole(user: number | string, classId: number, role: Roles) {
  const connection = await getConnection();
  try {
      await connection.beginTransaction();
      let userId: number;
      if(typeof user == 'number') {
        userId = user;
      } else {
        userId = await accountsService.getAccountId(user, connection);
      }
      await connection.execute(
        `insert into roles(account_id, class_id, role, school_id)
        select ?, ?, ?, school_id from classes where class_id = ?`,
        [userId, classId, role, classId]
      )
      await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteRole(roleId: number) {
  const connection = await getConnection();
  try {
      await connection.beginTransaction();
      await connection.execute(
        `delete from roles where role_id = ?`,
        [roleId]
      )
      await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export default { addRole, deleteRole, getRoles };