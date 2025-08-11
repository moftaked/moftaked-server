import { z } from 'zod/v4';

export const signInSchema = z
  .object({
    username: z.string().min(4).max(50),
    password: z.string().min(8),
  })
  .required();

export type SignInDto = z.infer<typeof signInSchema>;
