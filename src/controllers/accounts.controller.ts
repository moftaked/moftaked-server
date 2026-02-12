import { Request, Response } from 'express';
import accountsService from '../services/accounts.service';
import { CreateAccountDto } from '../schemas/accounts.schemas';
import { executeQuery, getConnection } from '../services/database.service';
import { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { StatusCodes } from 'http-status-codes';
import dataVersionsService from '../services/data-versions.service';
import rolesService from '../services/roles.service';

export async function createAccount(req: Request, res: Response) {
  const newUser: CreateAccountDto = req.body;
  const result = await accountsService.createAccount(
    newUser.username,
    newUser.real_name,
    newUser.password,
  );
  res.json(result);
}

export async function getAccounts(_req: Request, res: Response) {
  try {
    const accounts = await executeQuery<RowDataPacket[]>(
      `SELECT 
        a.account_id, 
        a.username, 
        a.real_name,
        GROUP_CONCAT(
          DISTINCT CONCAT(r.role_id, ':', r.role, ':', r.class_id, ':', c.class_name, ':', s.school_name)
          SEPARATOR '|'
        ) as roles_info
      FROM accounts a
      LEFT JOIN roles r ON a.account_id = r.account_id
      LEFT JOIN classes c ON r.class_id = c.class_id
      LEFT JOIN schools s ON c.school_id = s.school_id
      GROUP BY a.account_id
      ORDER BY a.real_name`,
    );

    const result = accounts.map((account) => {
      const roles: { role_id: number; role: string; class_id: number; class_name: string; school_name: string }[] = [];
      if (account['roles_info']) {
        const parts = (account['roles_info'] as string).split('|');
        for (const part of parts) {
          const segments = part.split(':');
          roles.push({
            role_id: parseInt(segments[0] ?? '0', 10),
            role: segments[1] ?? '',
            class_id: parseInt(segments[2] ?? '0', 10),
            class_name: segments[3] ?? '',
            school_name: segments[4] ?? '',
          });
        }
      }
      return {
        account_id: account['account_id'],
        username: account['username'],
        real_name: account['real_name'],
        roles,
      };
    });

    res.status(StatusCodes.OK).json({ success: true, data: result });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error retrieving accounts',
    });
  }
}

export async function getAllClasses(_req: Request, res: Response) {
  try {
    const classes = await executeQuery<RowDataPacket[]>(
      `SELECT 
        c.class_id, 
        c.class_name, 
        s.school_id, 
        s.school_name
      FROM classes c
      INNER JOIN schools s ON c.school_id = s.school_id
      ORDER BY s.school_name, c.class_name`,
    );
    res.status(StatusCodes.OK).json({ success: true, data: classes });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error retrieving classes',
    });
  }
}

export async function assignPersonToClass(req: Request, res: Response) {
  const { person_id, class_id, type } = req.body;

  if (!person_id || !class_id || !type) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'person_id, class_id, and type are required',
    });
    return;
  }

  if (type !== 'student' && type !== 'teacher') {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'type must be "student" or "teacher"',
    });
    return;
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    // Check if assignment already exists
    const [existing] = await connection.query<RowDataPacket[]>(
      'SELECT person_class_id FROM person_class WHERE person_id = ? AND class_id = ? AND type = ?',
      [person_id, class_id, type],
    );

    if (Array.isArray(existing) && existing.length > 0) {
      await connection.rollback();
      res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: 'Person is already assigned to this class with this role',
      });
      return;
    }

    await connection.query(
      'INSERT INTO person_class (person_id, class_id, type) VALUES (?, ?, ?)',
      [person_id, class_id, type],
    );

    await connection.commit();

    // Touch data version for the class
    const versionKey = type === 'student'
      ? dataVersionsService.classStudentsKey(class_id)
      : dataVersionsService.classTeachersKey(class_id);
    dataVersionsService.touch(versionKey).catch(() => {});

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Person assigned to class successfully',
    });
  } catch (error) {
    await connection.rollback();
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error assigning person to class',
    });
  } finally {
    connection.release();
  }
}

export async function deleteRoleById(req: Request, res: Response) {
  const roleId = parseInt(req.params['roleId']!, 10);
  if (isNaN(roleId)) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Invalid role ID',
    });
    return;
  }

  try {
    await rolesService.deleteRole(roleId);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error deleting role',
    });
  }
}

export async function unassignPersonFromClass(req: Request, res: Response) {
  const { person_id, class_id, type } = req.body;

  if (!person_id || !class_id || !type) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'person_id, class_id, and type are required',
    });
    return;
  }

  if (type !== 'student' && type !== 'teacher') {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'type must be "student" or "teacher"',
    });
    return;
  }

  const connection = await getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query<ResultSetHeader>(
      'DELETE FROM person_class WHERE person_id = ? AND class_id = ? AND type = ?',
      [person_id, class_id, type],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      res.status(StatusCodes.NOT_FOUND).json({
        success: false,
        message: 'Assignment not found',
      });
      return;
    }

    await connection.commit();

    // Touch data version for the class
    const versionKey = type === 'student'
      ? dataVersionsService.classStudentsKey(class_id)
      : dataVersionsService.classTeachersKey(class_id);
    dataVersionsService.touch(versionKey).catch(() => {});

    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Person unassigned from class successfully',
    });
  } catch (error) {
    await connection.rollback();
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error unassigning person from class',
    });
  } finally {
    connection.release();
  }
}