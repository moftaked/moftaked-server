import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Roles } from '../enums/roles.enum';
import authService from '../services/auth.service';
import { JwtPayload } from 'jsonwebtoken';
import personsService from '../services/persons.service';

export function isAuthenticated() {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization;
    if (token === undefined) throw new Error(`${StatusCodes.UNAUTHORIZED}`);
    const decodedToken: JwtPayload = authService.verify(token);
    res.locals['user'] = decodedToken['payload'];
    next();
  };
}

export function isInClass(
  whereIsClassId: 'body' | 'params',
  authorizedRoles: Roles[],
) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user: { sub: number; username: string } = res.locals['user'];
    const classId =
      whereIsClassId === 'body' ? req.body.classId : req.params['classId'];
    if (!classId) throw new Error(`${StatusCodes.BAD_REQUEST}`);
    const authorized = authService.isInAnyClass(
      user.sub,
      [classId],
      authorizedRoles,
    );
    if (!authorized) throw new Error(`${StatusCodes.FORBIDDEN}`);
    next();
  };
}

export function isInPersonClass(
  urlParamName: string,
  type: 'student' | 'teacher',
  authorizedRoles: Roles[],
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user: { sub: number; username: string } = res.locals['user'];
    const personId = parseInt(req.params[urlParamName] || '', 10);
    if (isNaN(personId)) throw new Error(`${StatusCodes.BAD_REQUEST}`);
    const personJoinedClasses = await personsService.getJoinedClasses(
      personId,
      type,
    );
    const authorized = authService.isInAnyClass(
      user.sub,
      personJoinedClasses.map(c => c.class_id),
      authorizedRoles,
    );
    if (!authorized) throw new Error(`${StatusCodes.FORBIDDEN}`);
    next();
  };
}

export function hasRole(requiredRole: Roles) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    const user: { sub: number; username: string } = res.locals['user'];
    const authorized = await authService.hasRole(user.sub, requiredRole);
    if (!authorized) throw new Error(`${StatusCodes.FORBIDDEN}`);
    next();
  };
}
