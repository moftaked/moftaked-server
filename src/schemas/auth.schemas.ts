import { z } from 'zod/v4';

export const signInSchema = z
  .object({
    username: z.string().min(1).max(50).trim(),
    password: z.string().min(1),
  })
  .required();

export type SignInDto = z.infer<typeof signInSchema>;
