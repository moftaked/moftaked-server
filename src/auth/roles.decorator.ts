import { SetMetadata } from '@nestjs/common';
import { Roles } from 'src/users/entities/role.entity';

export const ROLES_KEY = 'roles';
export const RolesDec = (...roles: Roles[]) => SetMetadata(ROLES_KEY, roles);