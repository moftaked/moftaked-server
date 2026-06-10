import express from 'express';
import { isAuthenticated, hasRole } from '../middleware/authorization.middleware';
import { Roles } from '../enums/roles.enum';
import { validateData } from '../middleware/validation.middleware';
import { createDistrictSchema } from '../schemas/districts.schemas';
import {
  createDistrict,
  getDistricts,
  deleteDistrict,
  mergeDistricts,
} from '../controllers/districts.controller';

const districtsRouter = express.Router();

districtsRouter.use(isAuthenticated());

districtsRouter.post('/', hasRole([Roles.manager]), validateData(createDistrictSchema), createDistrict);

districtsRouter.get('/', getDistricts);

districtsRouter.delete('/:districtId', hasRole([Roles.manager, Roles.admin]), deleteDistrict);

districtsRouter.post('/:sourceId/merge/:targetId', hasRole([Roles.manager, Roles.admin]), mergeDistricts);

export { districtsRouter };
