import {Request, Response, NextFunction} from 'express';
import {StatusCodes} from 'http-status-codes';
import { Roles } from '../enums/roles.enum';
import authService from '../services/auth.service';
import { JwtPayload } from 'jsonwebtoken';

export function isAuthenticated() {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization;
    if(token == undefined) throw new Error(`${StatusCodes.UNAUTHORIZED}`);
    const decodedToken: JwtPayload = authService.verify(token);
    res.locals['user'] = decodedToken['payload'];
    next();
  }
}

export function isInSameClass(role: Roles) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user: {sub: number, username: string} = res.locals['user'];
    const body: {classId: number} = req.body;
    const authorized = authService.isInClass(user.sub, body.classId, role);
    if(!authorized) throw new Error(`${StatusCodes.FORBIDDEN}`);
    next();
  }
}

export function hasRole(requiredRole: Roles) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    const user: {sub: number, username: string} = res.locals['user'];
    const authorized = await authService.hasRole(user.sub, requiredRole);
    if(!authorized) throw new Error(`${StatusCodes.FORBIDDEN}`);
    next();
  }
}