import { z } from 'zod/v4';

export const notificationPreferenceSchema = z.object({
  preferences: z.array(
    z.object({
      type: z.enum([
        'reservation_needs_review',
        'reservation_status_change',
        'reservation_edited',
        'pickup_reminder',
        'return_reminder',
        'reservation_deleted',
      ]),
      enabled: z.boolean(),
    }),
  ),
});

export const registerFcmTokenSchema = z.object({
  token: z.string().min(1).max(500),
  device_info: z.string().optional().nullable(),
});

export type NotificationPreferenceDto = z.infer<typeof notificationPreferenceSchema>;
export type RegisterFcmTokenDto = z.infer<typeof registerFcmTokenSchema>;
