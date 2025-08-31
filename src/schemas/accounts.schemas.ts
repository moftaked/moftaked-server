import { z } from 'zod/v4';

export const createAccountSchema = z.object({
  username: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z_0-9]+$/)
    .trim(),
  password: z
    .string()
    .min(1)
    .max(50)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])[a-zA-Z0-9]+$/)
    .optional(),
  real_name: z.string().min(1).max(50).trim(),
});

export type CreateAccountDto = z.infer<typeof createAccountSchema>;
