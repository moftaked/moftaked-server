import { z } from 'zod';

export const updateTeacherSchema = z.object({
  teacher_name: z
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
    .regex(/^[0-9]+$/, { message: 'رقم التليفون غلط، لازم ارقام انجليزي' }),
  second_phone_number: z
    .string()
    .min(7)
    .max(15)
    .regex(/^[0-9]+$/, { message: 'رقم التليفون غلط، لازم ارقام انجليزي' })
    .optional(),
  district: z
    .string()
    .min(1, { message: 'اسم المنطقة قصير اوي' })
    .max(50, { message: 'اسم المنطقة طويل اوي' }),
  notes: z.string().max(255, { message: 'الملاحظات طويلة اوي' }).optional(),
});

export type UpdateTeacherDto = z.infer<typeof updateTeacherSchema>;
