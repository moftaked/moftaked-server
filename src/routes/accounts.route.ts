import express from 'express';
import { hasRole, isAuthenticated } from '../middleware/authorization.middleware';
import { Roles } from '../enums/roles.enum';
import { createAccountSchema } from '../schemas/accounts.schemas';
import { validateData } from '../middleware/validation.middleware';
import { createAccount } from '../controllers/accounts.controller';

const accountsRouter = express.Router();

accountsRouter.use(isAuthenticated(), hasRole(Roles.manager));

accountsRouter.post(
  '/create',
  validateData(createAccountSchema),
  createAccount
);

export { accountsRouter };