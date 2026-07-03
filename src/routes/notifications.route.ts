import express from 'express';
import { isAuthenticated } from '../middleware/authorization.middleware';
import { validateData } from '../middleware/validation.middleware';
import {
  notificationPreferenceSchema,
  registerFcmTokenSchema,
} from '../schemas/notifications.schemas';
import {
  getNotificationPreferences,
  updateNotificationPreferences,
  registerFcmToken,
  unregisterFcmToken,
} from '../controllers/notifications.controller';

const notificationsRouter = express.Router();

notificationsRouter.use(isAuthenticated());

notificationsRouter.get('/notification-preferences', getNotificationPreferences);
notificationsRouter.put(
  '/notification-preferences',
  validateData(notificationPreferenceSchema),
  updateNotificationPreferences,
);

notificationsRouter.post(
  '/fcm-tokens',
  validateData(registerFcmTokenSchema),
  registerFcmToken,
);
notificationsRouter.delete('/fcm-tokens/:token', unregisterFcmToken);

export { notificationsRouter };
