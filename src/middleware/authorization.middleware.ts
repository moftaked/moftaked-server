import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { Roles } from '../enums/roles.enum';
import authService from '../services/auth.service';
import { JwtPayload } from 'jsonwebtoken';
import personsService from '../services/persons.service';
import attendanceService from '../services/attendance.service';
import eventsService from '../services/events.service';
import classesService from '../services/classes.service';
import equipmentService from '../services/equipment.service';
import createHttpError from 'http-errors';
import { Err } from 'result2';

export type authenticatedLocals = {user: { sub: number, username: string }};

export function isAuthenticated() {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header === undefined) return next(Err(StatusCodes.UNAUTHORIZED));
    const token = header.startsWith('Bearer ') ? header.slice(7) : header;
    const decodedToken: JwtPayload = authService.verify(token);
    res.locals['user'] = decodedToken['payload'];
    next();
  };
}

export function isInClass(
  whereIsClassId: 'body' | 'params',
  authorizedRoles: Roles[],
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user: { sub: number; username: string } = res.locals['user'];
    const classId = Number(
      whereIsClassId === 'body' ? (req.body.class_id ?? req.body.classId) : req.params['classId']
    );
    if (!classId) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Class ID is required'));

    const authorized = await authService.isInAnyClass(
      user.sub,
      [classId],
      authorizedRoles,
    );
    if (authorized) return next();

    if (authorizedRoles.includes(Roles.manager)) {
      const schoolRows = await classesService.getClassSchoolId(classId);
      if (schoolRows.length > 0) {
        const schoolId = schoolRows[0]!['school_id'];
        const isManager = await authService.isManagerOfSchool(user.sub, schoolId);
        if (isManager) return next();
      }
    }

    return next(createHttpError(StatusCodes.FORBIDDEN, 'You are not authorized to access this class'));
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
    if (isNaN(personId)) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid person ID'));
    const personJoinedClasses = await personsService.getJoinedClasses(
      personId,
      type,
    );
    const authorized = await authService.isInAnyClass(
      user.sub,
      personJoinedClasses.map(c => c.class_id),
      authorizedRoles,
    );
    if (!authorized) return next(createHttpError(StatusCodes.FORBIDDEN, 'You are not authorized to access this class'));
    next();
  };
}

export function hasRole(requiredRoles: Roles[]) {
  return async (_req: Request, res: Response, next: NextFunction) => {
    const user: { sub: number; username: string } = res.locals['user'];
    const authorized = await authService.hasRole(user.sub, requiredRoles);
    if (!authorized) return next(createHttpError(StatusCodes.FORBIDDEN, 'You are not authorized to perform this action'));
    next();
  };
}

export function isInAttendanceEventClass(authorizedRoles: Roles[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user: { sub: number; username: string } = res.locals['user'];

    const eventOccurrenceId = parseInt(req.params['eventOccurrenceId'] || '', 10);
    if (isNaN(eventOccurrenceId)) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Event occurrence ID is required'));
    }
    const classId = await attendanceService.getClassIdFromEventOccurrence(eventOccurrenceId);
    if (classId === null) {
      return next(createHttpError(StatusCodes.NOT_FOUND, 'Event occurrence not found'));
    }

    const authorized = await authService.isInAnyClass(user.sub, [classId], authorizedRoles);
    if (authorized) return next();

    if (authorizedRoles.includes(Roles.manager)) {
      const schoolRows = await classesService.getClassSchoolId(classId);
      if (schoolRows.length > 0) {
        const schoolId = schoolRows[0]!['school_id'];
        const isManager = await authService.isManagerOfSchool(user.sub, schoolId);
        if (isManager) return next();
      }
    }

    return next(createHttpError(StatusCodes.FORBIDDEN, 'You are not authorized to access this attendance'));
  };
}

export function isInEventClass(authorizedRoles: Roles[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user: { sub: number; username: string } = res.locals['user'];

    const eventId = parseInt(req.params['eventId'] || '', 10);
    if (isNaN(eventId)) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Event ID is required'));
    }
    const classId = await eventsService.getClassIdFromEvent(eventId);
    if (classId === null) {
      return next(createHttpError(StatusCodes.NOT_FOUND, 'Event not found'));
    }

    const authorized = await authService.isInAnyClass(user.sub, [classId], authorizedRoles);
    if (authorized) return next();

    if (authorizedRoles.includes(Roles.manager)) {
      const schoolRows = await classesService.getClassSchoolId(classId);
      if (schoolRows.length > 0) {
        const schoolId = schoolRows[0]!['school_id'];
        const isManager = await authService.isManagerOfSchool(user.sub, schoolId);
        if (isManager) return next();
      }
    }

    return next(createHttpError(StatusCodes.FORBIDDEN, 'You are not authorized to access this event'));
  };
}

export function isEquipmentOrganizer() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user: { sub: number; username: string } = res.locals['user'];
    const raw = req.params['groupId'];
    if (raw === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Group ID is required'));
    const groupId = parseInt(raw, 10);
    if (isNaN(groupId)) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid group ID'));

    const admin = await authService.isAdmin(user.sub);
    if (admin) return next();

    const authorized = await equipmentService.isOrganizer(user.sub, groupId);
    if (!authorized) return next(createHttpError(StatusCodes.FORBIDDEN, 'You are not authorized to manage this equipment group'));
    next();
  };
}

export function isEquipmentViewer() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user: { sub: number; username: string } = res.locals['user'];
    const raw = req.params['groupId'];
    if (raw === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Group ID is required'));
    const groupId = parseInt(raw, 10);
    if (isNaN(groupId)) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid group ID'));

    const admin = await authService.isAdmin(user.sub);
    if (admin) return next();

    const authorized = await equipmentService.hasViewAccess(user.sub, groupId);
    if (!authorized) return next(createHttpError(StatusCodes.FORBIDDEN, 'You are not authorized to access this equipment group'));
    next();
  };
}

export function isEquipmentPhotoViewer() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user: { sub: number; username: string } = res.locals['user'];
    const filename = req.params['filename'];
    if (!filename) return next(Err(StatusCodes.BAD_REQUEST));

    const base = filename.replace(/-(sm|md|lg)\.webp$/, '').replace(/\.webp$/, '');
    const equipmentId = await equipmentService.getEquipmentIdByPhoto(base);
    if (!equipmentId) return next(createHttpError(StatusCodes.NOT_FOUND, 'Photo not found'));

    const groupId = await equipmentService.getItemGroupId(equipmentId);
    if (!groupId) return next(createHttpError(StatusCodes.NOT_FOUND, 'Equipment not found'));

    const admin = await authService.isAdmin(user.sub);
    if (admin) return next();

    const authorized = await equipmentService.hasViewAccess(user.sub, groupId);
    if (!authorized) return next(createHttpError(StatusCodes.FORBIDDEN, 'You are not authorized to access this equipment photo'));
    next();
  };
}
