import express from 'express';
import { validateData } from '../middleware/validation.middleware';
import { signInSchema } from '../schemas/auth.schemas';
import { signIn, refresh, logout } from '../controllers/auth.controller';
import { rateLimiter } from '../middleware/rate-limiting.middleware';

const authRouter = express.Router();

authRouter.post('/login', rateLimiter, validateData(signInSchema), signIn);
authRouter.post('/refresh', refresh);
authRouter.post('/logout', logout);

export default authRouter;
