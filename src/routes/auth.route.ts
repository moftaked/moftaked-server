import express from 'express';
import { validateData } from '../middleware/validation.middleware';
import { signInSchema } from '../schemas/auth.schemas';
import { signIn } from '../controllers/auth.controller';
import { rateLimiter } from '../middleware/rate-limiting.middleware';

const authRouter = express.Router();

authRouter.post('/login', rateLimiter, validateData(signInSchema), signIn);

export default authRouter;
