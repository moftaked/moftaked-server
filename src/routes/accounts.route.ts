import express from 'express';
import {
  hasRole,
  isAuthenticated,
} from '../middleware/authorization.middleware';
import { Roles } from '../enums/roles.enum';
import { createAccountSchema, setAdminSchema } from '../schemas/accounts.schemas';
import { validateData } from '../middleware/validation.middleware';
import { createAccount, getAccounts, getAllClasses, assignPersonToClass, unassignPersonFromClass, deleteRoleById, setAdmin } from '../controllers/accounts.controller';
import { accountCreationRateLimiter, sensitiveOperationRateLimiter } from '../middleware/rate-limiting.middleware';

const accountsRouter = express.Router();

accountsRouter.use(isAuthenticated(), hasRole([Roles.manager]));

accountsRouter.get('/', getAccounts);

accountsRouter.get('/classes', getAllClasses);

accountsRouter.post(
  '/create',
  accountCreationRateLimiter,
  validateData(createAccountSchema),
  createAccount,
);

accountsRouter.post('/assign-person', assignPersonToClass);

accountsRouter.post('/unassign-person', unassignPersonFromClass);

accountsRouter.delete('/roles/:roleId', deleteRoleById);

accountsRouter.post(
  '/set-admin',
  sensitiveOperationRateLimiter,
  validateData(setAdminSchema),
  setAdmin,
);

export default accountsRouter;