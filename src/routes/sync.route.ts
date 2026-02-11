import express from 'express';
import { isAuthenticated } from '../middleware/authorization.middleware';
import { getTimestamps } from '../controllers/sync.controller';

const syncRouter = express.Router();

syncRouter.use(isAuthenticated());

syncRouter.get('/timestamps', getTimestamps);

export default syncRouter;