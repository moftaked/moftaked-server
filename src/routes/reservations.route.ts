import express from 'express';
import { isAuthenticated } from '../middleware/authorization.middleware';
import { validateData } from '../middleware/validation.middleware';
import {
  isReservationOrganizer,
  isReservationReviewer,
  isReservationInvolved,
} from '../middleware/reservations.middleware';
import {
  createReservationSchema,
  updateReservationSchema,
  addReservationEquipmentSchema,
  addReviewerSchema,
  reviewActionSchema,
} from '../schemas/reservations.schemas';
import {
  createReservation,
  getReservations,
  getReservationById,
  updateReservation,
  deleteReservation,
  addEquipment,
  removeEquipment,
  excludeAttachment,
  includeAttachment,
  submitReservation,
  unsubmitReservation,
  getReservationReviewers,
  addReviewer,
  removeReviewer,
  approveReservation,
  rejectReservation,
  markWaitingForPickup,
  markWaitingForReturn,
  markPickedUp,
  markReturned,
  reopenReservation,
} from '../controllers/reservations.controller';

const reservationsRouter = express.Router();

reservationsRouter.use(isAuthenticated());

// ---- Reservations CRUD ----
reservationsRouter.post(
  '/',
  validateData(createReservationSchema),
  createReservation,
);

reservationsRouter.get('/', getReservations);

reservationsRouter.get('/:reservationId', isReservationInvolved(), getReservationById);

reservationsRouter.put(
  '/:reservationId',
  validateData(updateReservationSchema),
  updateReservation,
);

reservationsRouter.delete('/:reservationId', deleteReservation);

// ---- Submit ----
reservationsRouter.post('/:reservationId/submit', submitReservation);
reservationsRouter.post('/:reservationId/unsubmit', unsubmitReservation);

// ---- Equipment items ----
reservationsRouter.post(
  '/:reservationId/items',
  validateData(addReservationEquipmentSchema),
  addEquipment,
);

reservationsRouter.delete('/:reservationId/items/:itemId', removeEquipment);

// ---- Attachments ----
reservationsRouter.post(
  '/:reservationId/items/:itemId/exclude/:attachmentId',
  excludeAttachment,
);

reservationsRouter.delete(
  '/:reservationId/items/:itemId/exclude/:attachmentId',
  includeAttachment,
);

// ---- Reviewers ----
reservationsRouter.get(
  '/:reservationId/reviewers',
  isReservationInvolved(),
  getReservationReviewers,
);

reservationsRouter.post(
  '/:reservationId/reviewers',
  isReservationOrganizer(),
  validateData(addReviewerSchema),
  addReviewer,
);

reservationsRouter.delete(
  '/:reservationId/reviewers/:reviewerId',
  isReservationOrganizer(),
  removeReviewer,
);

// ---- Approval ----
reservationsRouter.post(
  '/:reservationId/approve',
  isReservationReviewer(),
  validateData(reviewActionSchema),
  approveReservation,
);

reservationsRouter.post(
  '/:reservationId/reject',
  isReservationReviewer(),
  validateData(reviewActionSchema),
  rejectReservation,
);

// ---- State transitions (organizer only) ----
reservationsRouter.post(
  '/:reservationId/mark-for-pickup',
  isReservationOrganizer(),
  markWaitingForPickup,
);

reservationsRouter.post(
  '/:reservationId/pick-up',
  isReservationOrganizer(),
  markPickedUp,
);

reservationsRouter.post(
  '/:reservationId/mark-for-return',
  isReservationOrganizer(),
  markWaitingForReturn,
);

reservationsRouter.post(
  '/:reservationId/return',
  isReservationOrganizer(),
  markReturned,
);

reservationsRouter.post(
  '/:reservationId/reopen',
  isReservationOrganizer(),
  reopenReservation,
);

export { reservationsRouter };
