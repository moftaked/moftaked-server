import express from 'express';
import { addRoleSchema } from '../schemas/roles.schemas';
import { validateData } from '../middleware/validation.middleware';
import {
  isAuthenticated,
  isInClass,
} from '../middleware/authorization.middleware';
import { Roles } from '../enums/roles.enum';
import { addRole, getRoles } from '../controllers/roles.controller';
const rolesRouter = express.Router();

rolesRouter.use(isAuthenticated(), isInClass('body', [Roles.manager]));

rolesRouter.post('/', validateData(addRoleSchema), addRole);

rolesRouter.get('/:userId', getRoles);

export default rolesRouter;
