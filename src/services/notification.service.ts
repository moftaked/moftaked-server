import { RowDataPacket } from 'mysql2/promise';
import { executeQuery } from './database.service';
import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import type { App } from 'firebase-admin/app';
import type { BatchResponse, Message } from 'firebase-admin/messaging';
import fs from 'fs';

export const NOTIFICATION_TYPES = {
  REVIEW_REQUIRED: 'reservation_needs_review',
  STATUS_CHANGE: 'reservation_status_change',
  EDITED: 'reservation_edited',
  PICKUP_REMINDER: 'pickup_reminder',
  RETURN_REMINDER: 'return_reminder',
  DELETED: 'reservation_deleted',
} as const;

let firebaseApp: App | null = null;
let firebaseInitialized = false;

async function initializeFirebase(): Promise<void> {
  const serviceAccountPath = process.env['FIREBASE_SERVICE_ACCOUNT_PATH'];
  const serviceAccountJson = process.env['FIREBASE_SERVICE_ACCOUNT'];

  let serviceAccount: Record<string, unknown>;
  if (serviceAccountPath) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    console.log('[Firebase] Initialized from service account file');
  } else if (serviceAccountJson) {
    serviceAccount = JSON.parse(serviceAccountJson);
    console.log('[Firebase] Initialized from environment variable');
  } else {
    console.warn('[Firebase] Not configured — set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT');
    return;
  }

  firebaseApp = initializeApp({ credential: cert(serviceAccount as any) });
  firebaseInitialized = true;
}

async function ensureTables(): Promise<void> {
  await executeQuery(
    `CREATE TABLE IF NOT EXISTS notification_preferences (
      preference_id INT AUTO_INCREMENT PRIMARY KEY,
      account_id INT NOT NULL,
      notification_type VARCHAR(50) NOT NULL,
      enabled TINYINT NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(account_id),
      UNIQUE KEY (account_id, notification_type)
    )`,
  );
  await executeQuery(
    `CREATE TABLE IF NOT EXISTS fcm_tokens (
      fcm_token_id INT AUTO_INCREMENT PRIMARY KEY,
      account_id INT NOT NULL,
      token VARCHAR(500) NOT NULL,
      device_info VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(account_id),
      UNIQUE KEY (token)
    )`,
  );
}

async function isNotificationEnabled(accountId: number, type: string): Promise<boolean> {
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT enabled FROM notification_preferences WHERE account_id = ? AND notification_type = ?',
    [accountId, type],
  );
  if (rows.length === 0) return true;
  return rows[0]!['enabled'] === 1;
}

async function setPreference(
  accountId: number,
  type: string,
  enabled: boolean,
): Promise<void> {
  await executeQuery(
    `INSERT INTO notification_preferences (account_id, notification_type, enabled)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE enabled = ?`,
    [accountId, type, enabled ? 1 : 0, enabled ? 1 : 0],
  );
}

async function getPreferences(
  accountId: number,
): Promise<{ type: string; enabled: boolean }[]> {
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT notification_type, enabled FROM notification_preferences WHERE account_id = ?',
    [accountId],
  );
  return rows.map((r) => ({
    type: r['notification_type'],
    enabled: r['enabled'] === 1,
  }));
}

async function getAllPreferences(accountId: number): Promise<{ type: string; enabled: boolean }[]> {
  const userPrefs = await getPreferences(accountId);
  const prefMap = new Map(userPrefs.map((p) => [p.type, p.enabled]));
  return Object.values(NOTIFICATION_TYPES).map((type) => ({
    type,
    enabled: prefMap.get(type) ?? true,
  }));
}

async function sendNotification(
  accountId: number,
  type: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<void> {
  const enabled = await isNotificationEnabled(accountId, type);
  if (!enabled) return;

  console.log(`[NOTIFICATION][${type}] account=${accountId} title="${title}" body="${body}"`);

  if (!firebaseInitialized || !firebaseApp) return;

  const tokens = await getUserFcmTokens(accountId);
  if (tokens.length === 0) return;

  const messaging = getMessaging(firebaseApp);
  const messages: Message[] = tokens.map((token) => ({
    token,
    notification: { title, body },
    ...(data ? { data } : {}),
  }));

  try {
    const response: BatchResponse = await messaging.sendEach(messages);
    const invalidTokens: string[] = [];
    for (let i = 0; i < response.responses.length; i++) {
      const resp = response.responses[i]!;
      if (resp.success) continue;
      const errCode = resp.error?.code;
      if (errCode === 'messaging/invalid-registration-token' || errCode === 'messaging/registration-token-not-registered') {
        invalidTokens.push(tokens[i]!);
      }
    }
    if (invalidTokens.length > 0) {
      await cleanupInvalidTokens(invalidTokens);
    }
  } catch (err) {
    console.error('[Firebase] send error:', err);
  }
}

async function cleanupInvalidTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  const placeholders = tokens.map(() => '?').join(', ');
  await executeQuery(
    `DELETE FROM fcm_tokens WHERE token IN (${placeholders})`,
    tokens,
  );
}

async function getUserFcmTokens(accountId: number): Promise<string[]> {
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT token FROM fcm_tokens WHERE account_id = ?',
    [accountId],
  );
  return rows.map((r) => r['token']);
}

async function registerToken(
  accountId: number,
  token: string,
  deviceInfo?: string,
): Promise<void> {
  await executeQuery(
    `INSERT INTO fcm_tokens (account_id, token, device_info)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE device_info = ?, updated_at = NOW()`,
    [accountId, token, deviceInfo ?? null, deviceInfo ?? null],
  );
}

async function unregisterToken(token: string): Promise<void> {
  await executeQuery('DELETE FROM fcm_tokens WHERE token = ?', [token]);
}

// ---- High-level notification helpers ----

async function notifyReviewRequired(
  reservationId: number,
  reviewerId: number,
): Promise<void> {
  await sendNotification(
    reviewerId,
    NOTIFICATION_TYPES.REVIEW_REQUIRED,
    'مراجعة مطلوبة',
    `يوجد حجز جديد بانتظار مراجعتك رقم ${reservationId}`,
    { reservation_id: String(reservationId), type: 'review_required' },
  );
}

async function notifyReservationAccepted(
  reservationId: number,
  receiverId: number,
): Promise<void> {
  await sendNotification(
    receiverId,
    NOTIFICATION_TYPES.STATUS_CHANGE,
    'تم قبول الحجز',
    `تم قبول حجزك رقم ${reservationId}`,
    { reservation_id: String(reservationId), type: 'accepted' },
  );
}

async function notifyReservationRejected(
  reservationId: number,
  receiverId: number,
): Promise<void> {
  await sendNotification(
    receiverId,
    NOTIFICATION_TYPES.STATUS_CHANGE,
    'تم رفض الحجز',
    `تم رفض حجزك رقم ${reservationId}`,
    { reservation_id: String(reservationId), type: 'rejected' },
  );
}

async function notifyReservationEditedByViewer(
  reservationId: number,
  reviewerIds: number[],
): Promise<void> {
  for (const reviewerId of reviewerIds) {
    await sendNotification(
      reviewerId,
      NOTIFICATION_TYPES.EDITED,
      'تم تعديل الحجز',
      `تم تعديل الحجز رقم ${reservationId} وهو الان بحاجة لمراجعة`,
      { reservation_id: String(reservationId), type: 'edited' },
    );
  }
}

async function notifyReservationEditedByOrganizer(
  reservationId: number,
  receiverId: number,
): Promise<void> {
  await sendNotification(
    receiverId,
    NOTIFICATION_TYPES.EDITED,
    'تم تعديل الحجز',
    `تم تعديل حجزك رقم ${reservationId} بواسطة خادم الاوضة`,
    { reservation_id: String(reservationId), type: 'edited' },
  );
}

async function notifyPickupReminder(
  reservationId: number,
  accountIds: number[],
): Promise<void> {
  for (const accountId of accountIds) {
    await sendNotification(
      accountId,
      NOTIFICATION_TYPES.PICKUP_REMINDER,
      'تذكير بالاستلام',
      `حجزك رقم ${reservationId} جاهز للاستلام خلال 30 دقيقة`,
      { reservation_id: String(reservationId), type: 'pickup_reminder' },
    );
  }
}

async function notifyReturnReminder(
  reservationId: number,
  accountIds: number[],
): Promise<void> {
  for (const accountId of accountIds) {
    await sendNotification(
      accountId,
      NOTIFICATION_TYPES.RETURN_REMINDER,
      'تذكير بالإرجاع',
      `حجزك رقم ${reservationId} يجب إرجاعه خلال 30 دقيقة`,
      { reservation_id: String(reservationId), type: 'return_reminder' },
    );
  }
}

async function notifyReservationDeleted(
  reservationId: number,
  accountIds: number[],
): Promise<void> {
  for (const accountId of accountIds) {
    await sendNotification(
      accountId,
      NOTIFICATION_TYPES.DELETED,
      'تم إلغاء الحجز',
      `تم إلغاء الحجز رقم ${reservationId}`,
      { reservation_id: String(reservationId), type: 'deleted' },
    );
  }
}

export default {
  initializeFirebase,
  ensureTables,
  setPreference,
  getPreferences,
  getAllPreferences,
  sendNotification,
  getUserFcmTokens,
  registerToken,
  unregisterToken,
  notifyReviewRequired,
  notifyReservationAccepted,
  notifyReservationRejected,
  notifyReservationEditedByViewer,
  notifyReservationEditedByOrganizer,
  notifyPickupReminder,
  notifyReturnReminder,
  notifyReservationDeleted,
  NOTIFICATION_TYPES,
};
