import { z } from 'zod';
import { Roles } from 'src/users/entities/role.entity';

export const createAccountSchema = z.object({
  username: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z_0-9]+$/),
  password: z
    .string()
    .min(1)
    .max(50)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])[a-zA-Z0-9]+$/)
    .optional(),
  real_name: z.string().min(1).max(50),
  role: z.enum([Roles.manager, Roles.leader, Roles.teacher]),
  class_id: z.number(),
});

export type CreateAccountDto = z.infer<typeof createAccountSchema>;
