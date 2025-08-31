import { z } from 'zod/v4';

export const createPersonSchema = z.object({
  name: z.string().min(2).max(50).trim(),
  address: z.string().min(4).max(1000).trim(),
  phone_number: z
    .string()
    .min(7)
    .max(15)
    .regex(/^[0-9]+$/).trim(),
  second_phone_number: z
    .string()
    .min(7)
    .max(15)
    .regex(/^[0-9]+$/)
    .trim()
    .optional(),
  district_id: z.number().int().positive(),
  notes: z.string().max(255).trim().optional(),
  class_id: z.number(),
  photo_link: z.string().min(6).max(1000).trim().optional()
});

export type CreatePersonDto = z.infer<typeof createPersonSchema>;

export const updatePersonSchema = createPersonSchema.extend({
  class_id: z.undefined(),
});

export type UpdatePersonDto = z.infer<typeof updatePersonSchema>;
