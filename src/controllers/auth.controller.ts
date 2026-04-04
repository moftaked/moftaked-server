import { NextFunction, Request, Response } from 'express';
import { SignInDto } from '../schemas/auth.schemas';
import authService from '../services/auth.service';
import { StatusCodes } from 'http-status-codes';
import auditLogService, { AuditEventType } from '../services/audit-log.service';

export async function signIn(req: Request, res: Response, next: NextFunction) {
  const credentials: SignInDto = req.body;
  const ipAddress = req.ip ?? req.socket.remoteAddress ?? null;
  const userAgent = req.get('User-Agent') ?? null;
  
  const result = await authService.signIn(
    credentials.username,
    credentials.password,
  );
  
  result.match(
    (ok) => {
      auditLogService.log(auditLogService.createLogEntry(AuditEventType.LOGIN_SUCCESS, {
        userId: ok.user_id,
        details: { username: credentials.username },
        ipAddress,
        userAgent,
      })).catch(() => {});
      res.status(StatusCodes.OK).json({ success: true, data: ok });
    },
    (err) => {
      auditLogService.log(auditLogService.createLogEntry(AuditEventType.LOGIN_FAILURE, {
        details: { username: credentials.username, reason: err },
        ipAddress,
        userAgent,
      })).catch(() => {});
      next(err);
    }
  );
}