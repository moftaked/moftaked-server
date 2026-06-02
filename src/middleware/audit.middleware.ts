import { Request, Response, NextFunction } from 'express';
import auditLogService, { AuditEventType } from '../services/audit-log.service';

const SENSITIVE_FIELDS = new Set([
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'authorization',
]);

function sanitize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }
  if (typeof value === 'object' && value !== null) {
    const sanitized: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_FIELDS.has(key)) {
        sanitized[key] = '***';
      } else {
        sanitized[key] = sanitize(val);
      }
    }
    return sanitized;
  }
  return value;
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'OPTIONS') {
    next();
    return;
  }

  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const user = res.locals['user'] as { sub: number; username: string } | undefined;

    const details: Record<string, unknown> = {
      method: req.method,
      path: req.originalUrl || req.url,
      statusCode: res.statusCode,
      duration,
    };

    if (Object.keys(req.query).length > 0) {
      details['query'] = sanitize(req.query);
    }

    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      details['body'] = sanitize(req.body);
    }

    auditLogService.log(
      auditLogService.createLogEntry(AuditEventType.API_REQUEST, {
        userId: user?.sub ?? null,
        details,
        ipAddress: req.ip ?? req.socket.remoteAddress ?? null,
        userAgent: req.get('User-Agent') ?? null,
      }),
    ).catch(() => {});
  });

  next();
}
