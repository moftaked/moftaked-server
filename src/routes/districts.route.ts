import express from 'express';
import { isAuthenticated } from '../middleware/authorization.middleware';
import { validateData } from '../middleware/validation.middleware';
import { createDistrictSchema } from '../schemas/districts.schemas';
import { createDistrict, getDistricts } from '../controllers/districts.controller';

const districtsRouter = express.Router();

districtsRouter.use(isAuthenticated());

districtsRouter.post(
  '/',
  validateData(createDistrictSchema),
  createDistrict
);

districtsRouter.get(
  '/',
  getDistricts
);

export { districtsRouter };