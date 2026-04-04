import { NextFunction, Request, Response } from 'express';
import { CreateRoleDto } from '../schemas/roles.schemas';
import rolesService from '../services/roles.service';
import authService from '../services/auth.service';
import { StatusCodes } from 'http-status-codes';
import createHttpError from 'http-errors';

export async function addRole(req: Request, res: Response, next: NextFunction) {
  const newRole: CreateRoleDto = req.body;
  const userId = (res.locals as any).user.sub;
  
  const [classInfo] = await rolesService.getClassInfo(newRole.classId);
  if (!classInfo) {
    return next(createHttpError(StatusCodes.NOT_FOUND, 'Class not found'));
  }
  
  const isManager = await authService.isManagerOfSchool(userId, classInfo['school_id']);
  if (!isManager) {
    return next(createHttpError(StatusCodes.FORBIDDEN, 'You are not authorized to manage this school'));
  }
  
  const result = await rolesService.addRole(
    newRole.user,
    newRole.classId,
    newRole.role,
  );
  res.json(result);
}

export async function getRoles(req: Request, res: Response) {
  const targetUserId: number = parseInt(req.params['userId']!);
  if (isNaN(targetUserId)) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
  
  const managerUserId = (res.locals as any).user.sub;
  const managerManagedSchools = await rolesService.getManagedSchools(managerUserId);
  const managedSchoolIds = managerManagedSchools.map((r: any) => r.school_id);
  
  if (managedSchoolIds.length === 0) {
    return res.status(200).json([]);
  }
  
  const targetUserRoles = await rolesService.getRoles(targetUserId);
  const filteredRoles = targetUserRoles.filter((role: any) => 
    managedSchoolIds.includes(role.school_id)
  );
  
  return res.json(filteredRoles);
}
