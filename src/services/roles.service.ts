import { RowDataPacket } from 'mysql2/promise';
import { Roles } from '../enums/roles.enum';
import accountsService from './accounts.service';
import { executeQuery, getConnection } from './database.service';

async function getRoles(
  accountId: number,
  classIds?: number[],
  schoolId?: number,
) {
  let queryStr =
    'select class_id, role, school_id from roles where account_id = ?';
  const queryParams = [accountId];
  if (schoolId !== undefined) {
    queryStr = queryStr + ' and school_id = ?';
    queryParams.push(schoolId);
  }
  if (classIds !== undefined) {
    queryStr = queryStr + ' and class_id in (';
    queryStr += classIds.map(() => '?').join(', ') + ')';
    queryParams.push(...classIds);
  }

  const roles = await executeQuery<RowDataPacket[]>(queryStr, queryParams);

  return roles;
}

async function getHighestRole(
  accountId: number,
  classId?: number,
  schoolId?: number,
) {
  const roles = await getRoles(
    accountId,
    classId ? [classId] : undefined,
    schoolId,
  );
  const isManager = roles.some(role => role['role'] === 'manager');
  if (isManager) {
    return Roles.manager;
  }
  const isLeader = roles.some(role => role['role'] === 'leader');
  if (isLeader) {
    return Roles.leader;
  }
  const isTeacher = roles.some(role => role['role'] === 'teacher');
  if (isTeacher) {
    return Roles.teacher;
  }
  return undefined;
}

async function addRole(user: number | string, classId: number, role: Roles) {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    let userId: number;
    if (typeof user === 'number') {
      userId = user;
    } else {
      userId = await accountsService.getAccountId(user, connection);
    }
    await connection.execute(
      `insert into roles(account_id, class_id, role, school_id)
        select ?, ?, ?, school_id from classes where class_id = ?`,
      [userId, classId, role, classId],
    );
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
    await connection.execute('delete from roles where role_id = ?', [roleId]);
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getClassInfo(classId: number) {
  const result = await executeQuery<RowDataPacket[]>(
    'SELECT school_id FROM classes WHERE class_id = ?',
    [classId],
  );
  return result;
}

async function getRoleById(roleId: number) {
  const result = await executeQuery<RowDataPacket[]>(
    'SELECT school_id, class_id, role, account_id FROM roles WHERE role_id = ?',
    [roleId],
  );
  return result;
}

async function getManagedSchools(accountId: number) {
  const result = await executeQuery<RowDataPacket[]>(
    'SELECT DISTINCT school_id FROM roles WHERE account_id = ? AND role = ?',
    [accountId, Roles.manager],
  );
  return result;
}

export default { addRole, deleteRole, getRoles, getHighestRole, getClassInfo, getRoleById, getManagedSchools };
