import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import createHttpError from 'http-errors';
import authService from '../services/auth.service';
import reservationsService from '../services/reservations.service';

export function isReservationCreatorOrReceiver() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals['user'];
    const reservationId = parseInt(req.params['reservationId'] ?? req.params['id'] ?? '', 10);
    if (isNaN(reservationId)) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const admin = await authService.isAdmin(user.sub);
    if (admin) return next();

    const involved = await reservationsService.isUserCreatorOrReceiver(user.sub, reservationId);
    if (!involved) {
      return next(createHttpError(StatusCodes.FORBIDDEN, 'Not authorized to access this reservation'));
    }
    next();
  };
}

export function isReservationOrganizer() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals['user'];
    const reservationId = parseInt(req.params['reservationId'] ?? req.params['id'] ?? '', 10);
    if (isNaN(reservationId)) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const admin = await authService.isAdmin(user.sub);
    if (admin) return next();

    const isOrg = await reservationsService.isUserOrganizerOfReservation(user.sub, reservationId);
    if (!isOrg) {
      return next(createHttpError(StatusCodes.FORBIDDEN, 'You are not an organizer for this reservation'));
    }
    next();
  };
}

export function isReservationReviewer() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals['user'];
    const reservationId = parseInt(req.params['reservationId'] ?? req.params['id'] ?? '', 10);
    if (isNaN(reservationId)) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const admin = await authService.isAdmin(user.sub);
    if (admin) return next();

    const isReviewer = await reservationsService.isUserReviewerOfReservation(user.sub, reservationId);
    if (!isReviewer) {
      return next(createHttpError(StatusCodes.FORBIDDEN, 'You are not a reviewer for this reservation'));
    }
    next();
  };
}

export function isReservationInvolved() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = res.locals['user'];
    const reservationId = parseInt(req.params['reservationId'] ?? req.params['id'] ?? '', 10);
    if (isNaN(reservationId)) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const admin = await authService.isAdmin(user.sub);
    if (admin) return next();

    const involved = await reservationsService.isUserInvolvedInReservation(user.sub, reservationId);
    if (!involved) {
      return next(createHttpError(StatusCodes.FORBIDDEN, 'Not authorized to access this reservation'));
    }
    next();
  };
}
