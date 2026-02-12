import express from 'express';
import {
  hasRole,
  isAuthenticated,
} from '../middleware/authorization.middleware';
import { Roles } from '../enums/roles.enum';
import { createAccountSchema } from '../schemas/accounts.schemas';
import { validateData } from '../middleware/validation.middleware';
import { createAccount, getAccounts, getAllClasses, assignPersonToClass, unassignPersonFromClass, deleteRoleById } from '../controllers/accounts.controller';

const accountsRouter = express.Router();

accountsRouter.use(isAuthenticated(), hasRole([Roles.manager]));

accountsRouter.get('/', getAccounts);

accountsRouter.get('/classes', getAllClasses);

accountsRouter.post(
  '/create',
  validateData(createAccountSchema),
  createAccount,
);

accountsRouter.post('/assign-person', assignPersonToClass);

accountsRouter.post('/unassign-person', unassignPersonFromClass);

accountsRouter.delete('/roles/:roleId', deleteRoleById);

export default accountsRouter;