import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import createHttpError from 'http-errors';
import notificationService from '../services/notification.service';

export async function getNotificationPreferences(_req: Request, res: Response, next: NextFunction) {
  try {
    const userId: number = res.locals['user']['sub'];
    const preferences = await notificationService.getAllPreferences(userId);
    res.status(StatusCodes.OK).json({ success: true, data: preferences });
  } catch (error) {
    next(error);
  }
}

export async function updateNotificationPreferences(req: Request, res: Response, next: NextFunction) {
  try {
    const userId: number = res.locals['user']['sub'];
    const { preferences } = req.body;
    for (const pref of preferences) {
      await notificationService.setPreference(userId, pref.type, pref.enabled);
    }
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function registerFcmToken(req: Request, res: Response, next: NextFunction) {
  try {
    const userId: number = res.locals['user']['sub'];
    await notificationService.registerToken(userId, req.body.token, req.body.device_info);
    res.status(StatusCodes.CREATED).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function unregisterFcmToken(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.params['token'];
    if (!token) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Token is required'));
    await notificationService.unregisterToken(token);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}
