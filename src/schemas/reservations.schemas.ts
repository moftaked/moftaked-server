import { z } from 'zod/v4';

export const createReservationSchema = z.object({
  class_id: z.number().int().positive(),
  receiver_person_id: z.number().int().positive(),
  pickup_datetime: z.string(),
  return_datetime: z.string(),
  notes: z.string().optional().nullable(),
  group_id: z.number().int().positive(),
});

export const updateReservationSchema = z.object({
  pickup_datetime: z.string().optional(),
  return_datetime: z.string().optional(),
  notes: z.string().optional().nullable(),
}).refine(
  (data) => {
    if (data.pickup_datetime && data.return_datetime) {
      return new Date(data.return_datetime) > new Date(data.pickup_datetime);
    }
    return true;
  },
  { message: 'return_datetime must be after pickup_datetime' },
);

export const addReservationEquipmentSchema = z.object({
  equipment_id: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
});

export const addReviewerSchema = z.object({
  account_id: z.number().int().positive(),
});

export const reviewActionSchema = z.object({
  notes: z.string().optional().nullable(),
});

export type CreateReservationDto = z.infer<typeof createReservationSchema>;
export type UpdateReservationDto = z.infer<typeof updateReservationSchema>;
export type AddReservationEquipmentDto = z.infer<typeof addReservationEquipmentSchema>;
export type AddReviewerDto = z.infer<typeof addReviewerSchema>;
export type ReviewActionDto = z.infer<typeof reviewActionSchema>;
