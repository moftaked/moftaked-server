import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import createHttpError from 'http-errors';
import reservationsService from '../services/reservations.service';

import type { ReservationState } from '../types';

export async function reopenReservation(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const userId: number = res.locals['user']['sub'];
    await reservationsService.reopenReservation(reservationId, userId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}


function parseIntParam(val: string | undefined): number | undefined {
  if (val === undefined) return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

// ---- CRUD ----

export async function createReservation(req: Request, res: Response, next: NextFunction) {
  try {
    const userId: number = res.locals['user']['sub'];
    const reservationId = await reservationsService.createReservation(req.body, userId);
    res.status(StatusCodes.CREATED).json({ success: true, data: { reservation_id: reservationId } });
  } catch (error) {
    next(error);
  }
}

export async function getReservations(req: Request, res: Response, next: NextFunction) {
  try {
    const userId: number = res.locals['user']['sub'];
    const classId = parseIntParam(req.query['class_id'] as string | undefined);
    const groupId = parseIntParam(req.query['group_id'] as string | undefined);
    const state = req.query['state'] as ReservationState | undefined;
    const role = req.query['role'] as 'created' | 'receiving' | 'reviewer' | 'organizer' | undefined;
    const fromDate = req.query['from_date'] as string | undefined;
    const toDate = req.query['to_date'] as string | undefined;

    const reservations = await reservationsService.getReservations(userId, {
      class_id: classId,
      group_id: groupId,
      state,
      role,
      from_date: fromDate,
      to_date: toDate,
    });
    res.status(StatusCodes.OK).json({ success: true, data: reservations });
  } catch (error) {
    next(error);
  }
}

export async function getReservationById(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const userId: number = res.locals['user']['sub'];
    const reservation = await reservationsService.getReservationById(reservationId, userId);
    if (!reservation) {
      return next(createHttpError(StatusCodes.NOT_FOUND, 'Reservation not found'));
    }
    res.status(StatusCodes.OK).json({ success: true, data: reservation });
  } catch (error) {
    next(error);
  }
}

export async function updateReservation(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const userId: number = res.locals['user']['sub'];
    await reservationsService.updateReservation(reservationId, req.body, userId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function deleteReservation(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const userId: number = res.locals['user']['sub'];
    await reservationsService.deleteReservation(reservationId, userId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ---- Equipment ----

export async function addEquipment(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const userId: number = res.locals['user']['sub'];
    const reservationEquipmentId = await reservationsService.addEquipment(reservationId, req.body, userId);
    res.status(StatusCodes.CREATED).json({
      success: true,
      data: { reservation_equipment_id: reservationEquipmentId },
    });
  } catch (error) {
    next(error);
  }
}

export async function removeEquipment(req: Request, res: Response, next: NextFunction) {
  try {
    const itemId = parseIntParam(req.params['itemId']);
    if (itemId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid equipment item ID'));
    }

    const userId: number = res.locals['user']['sub'];
    await reservationsService.removeEquipment(itemId, userId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function excludeAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const itemId = parseIntParam(req.params['itemId']);
    const attachmentId = parseIntParam(req.params['attachmentId']);
    if (itemId === undefined || attachmentId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid item or attachment ID'));
    }

    await reservationsService.excludeAttachment(itemId, attachmentId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function includeAttachment(req: Request, res: Response, next: NextFunction) {
  try {
    const itemId = parseIntParam(req.params['itemId']);
    const attachmentId = parseIntParam(req.params['attachmentId']);
    if (itemId === undefined || attachmentId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid item or attachment ID'));
    }

    await reservationsService.includeAttachment(itemId, attachmentId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ---- Submit ----

export async function submitReservation(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const userId: number = res.locals['user']['sub'];
    await reservationsService.submitReservation(reservationId, userId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ---- Reviewers ----

export async function getReservationReviewers(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const reviewers = await reservationsService.getReservationReviewers(reservationId);
    res.status(StatusCodes.OK).json({ success: true, data: reviewers });
  } catch (error) {
    next(error);
  }
}

export async function addReviewer(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const userId: number = res.locals['user']['sub'];
    await reservationsService.addReviewer(reservationId, req.body.account_id, userId);
    res.status(StatusCodes.CREATED).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function removeReviewer(req: Request, res: Response, next: NextFunction) {
  try {
    const reviewerId = parseIntParam(req.params['reviewerId']);
    if (reviewerId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reviewer ID'));
    }

    const userId: number = res.locals['user']['sub'];
    await reservationsService.removeReviewer(reviewerId, userId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ---- Approval ----

export async function approveReservation(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const userId: number = res.locals['user']['sub'];
    await reservationsService.approveReservation(reservationId, userId, req.body?.notes);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function rejectReservation(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const userId: number = res.locals['user']['sub'];
    await reservationsService.rejectReservation(reservationId, userId, req.body?.notes);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ---- State transitions ----

export async function markWaitingForPickup(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const userId: number = res.locals['user']['sub'];
    await reservationsService.markWaitingForPickup(reservationId, userId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function markWaitingForReturn(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const userId: number = res.locals['user']['sub'];
    await reservationsService.markWaitingForReturn(reservationId, userId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function markPickedUp(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const userId: number = res.locals['user']['sub'];
    await reservationsService.markPickedUp(reservationId, userId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function unsubmitReservation(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const userId: number = res.locals['user']['sub'];
    await reservationsService.unsubmitReservation(reservationId, userId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function markReturned(req: Request, res: Response, next: NextFunction) {
  try {
    const reservationId = parseIntParam(req.params['reservationId']);
    if (reservationId === undefined) {
      return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid reservation ID'));
    }

    const userId: number = res.locals['user']['sub'];
    await reservationsService.markReturned(reservationId, userId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}
