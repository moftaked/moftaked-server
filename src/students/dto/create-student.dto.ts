import { z } from 'zod';

export const createStudentSchema = z.object({
  student_name: z
    .string()
    .min(2, { message: 'الاسم قصير اوي' })
    .max(50, { message: 'الاسم طويل اوي، لازم اسم اقل من خمسين حرف' }),
  address: z
    .string()
    .min(4, { message: 'العنوان قصير اوي' })
    .max(1000, { message: 'العنوان طويل اوي، اخرك ألف حرف' }),
  phone_number: z
    .string()
    .min(7)
    .max(15)
    .regex(/^[0-9]+$/),
  second_phone_number: z
    .string()
    .min(7)
    .max(15)
    .regex(/^[0-9]+$/)
    .optional(),
  district: z.string().min(1).max(50),
  notes: z.string().max(255).optional(),
  class_id: z.number(),
});

export type CreateStudentDto = z.infer<typeof createStudentSchema>;
