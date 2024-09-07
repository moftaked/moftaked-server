import { z } from 'zod';

export const createStudentSchema = z
  .object({
    student_name: z.string().min(2).max(50),
    address: z.string().min(1).max(1000),
    phone_number: z.string().min(7).max(15), // todo: allow +, 0-9 only
    district: z.string().min(1).max(50),
    class_id: z.number()
  })
  .required();

export type CreateStudentDto = z.infer<typeof createStudentSchema>;
