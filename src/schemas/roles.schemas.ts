import { z } from 'zod/v4';
import { Roles } from '../enums/roles.enum';

export const addRoleSchema = z.object({
  // make the username validator reusable
  user: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z_0-9]+$/)
    .or(z.number()),
  classId: z.number(),
  role: z.enum(Roles),
});

export type CreateRoleDto = z.infer<typeof addRoleSchema>;
