import express from 'express';
import { addRoleSchema } from '../schemas/roles.schemas';
import { validateData } from '../middleware/validation.middleware';
import {
  isAuthenticated,
  hasRole,
} from '../middleware/authorization.middleware';
import { Roles } from '../enums/roles.enum';
import { addRole, getRoles } from '../controllers/roles.controller';
import { sensitiveOperationRateLimiter } from '../middleware/rate-limiting.middleware';
const rolesRouter = express.Router();

rolesRouter.use(isAuthenticated(), hasRole([Roles.manager]));

rolesRouter.post('/', sensitiveOperationRateLimiter, validateData(addRoleSchema), addRole);

rolesRouter.get('/:userId', getRoles);

export default rolesRouter;
