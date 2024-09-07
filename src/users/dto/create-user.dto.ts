import { z } from 'zod';

export const createUserSchema = z
  .object({
    user_name: z.string().min(4).max(50),
    password: z.string().min(8),
    real_name: z.string().min(2).max(50),
  })
  .required();

export type CreateUserDto = z.infer<typeof createUserSchema>;
