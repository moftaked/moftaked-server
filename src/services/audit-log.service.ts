import { executeQuery } from './database.service';

export enum AuditEventType {
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',
  LOGIN_FAILURE = 'LOGIN_FAILURE',
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',
  ROLE_ASSIGNED = 'ROLE_ASSIGNED',
  ROLE_REMOVED = 'ROLE_REMOVED',
  ATTENDANCE_MODIFIED = 'ATTENDANCE_MODIFIED',
  PERSON_CREATED = 'PERSON_CREATED',
  PERSON_UPDATED = 'PERSON_UPDATED',
  PHOTO_UPLOADED = 'PHOTO_UPLOADED',
  CLASS_CREATED = 'CLASS_CREATED',
  CLASS_UPDATED = 'CLASS_UPDATED',
  CLASS_DELETED = 'CLASS_DELETED',
  SCHOOL_CREATED = 'SCHOOL_CREATED',
  SCHOOL_UPDATED = 'SCHOOL_UPDATED',
  SCHOOL_DELETED = 'SCHOOL_DELETED',
  API_REQUEST = 'API_REQUEST',
}

interface AuditLogEntry {
  userId: number | null;
  eventType: AuditEventType;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
}

async function ensureTable() {
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      audit_log_id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      event_type VARCHAR(50) NOT NULL,
      details JSON NULL,
      ip_address VARCHAR(45) NULL,
      user_agent TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_id (user_id),
      INDEX idx_event_type (event_type),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function log(entry: AuditLogEntry) {
  await executeQuery(
    `INSERT INTO audit_logs (user_id, event_type, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)`,
    [
      entry.userId,
      entry.eventType,
      entry.details ? JSON.stringify(entry.details) : null,
      entry.ipAddress,
      entry.userAgent,
    ],
  );
}

function createLogEntry(
  eventType: AuditEventType,
  options?: {
    userId?: number | null;
    details?: Record<string, unknown>;
    ipAddress?: string | null;
    userAgent?: string | null;
  },
): AuditLogEntry {
  return {
    userId: options?.userId ?? null,
    eventType,
    details: options?.details ?? null,
    ipAddress: options?.ipAddress ?? null,
    userAgent: options?.userAgent ?? null,
  };
}

export default { ensureTable, log, createLogEntry, AuditEventType };
