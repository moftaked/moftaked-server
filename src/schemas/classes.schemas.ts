import { z } from 'zod/v4';

export const CreateSchoolSchema = z.object({
  school_name: z.string().min(2).max(50).trim(),
});

export type CreateSchoolDto = z.infer<typeof CreateSchoolSchema>;

export const UpdateSchoolSchema = z.object({
  school_name: z.string().min(2).max(50).trim(),
});

export type UpdateSchoolDto = z.infer<typeof UpdateSchoolSchema>;

export const CreateClassSchema = z.object({
  class_name: z.string().min(2).max(50).trim(),
  school_id: z.number().int().positive(),
});

export type CreateClassDto = z.infer<typeof CreateClassSchema>;

export const UpdateClassSchema = z.object({
  class_name: z.string().min(2).max(50).trim(),
});

export type UpdateClassDto = z.infer<typeof UpdateClassSchema>;

export const UpdateEventSchema = z.object({
  event_name: z.string().min(2).max(50).trim(),
  type: z.enum(['student', 'teacher', 'all']),
});

export type UpdateEventDto = z.infer<typeof UpdateEventSchema>;