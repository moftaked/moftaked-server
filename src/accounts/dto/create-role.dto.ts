import { z } from 'zod';
import { Roles } from 'src/users/entities/role.entity';

export const createRoleSchema = z.object({
  role: z.enum([Roles.manager, Roles.leader, Roles.teacher]),
  class_id: z.number(),
});

export type CreateRoleDto = z.infer<typeof createRoleSchema>;
