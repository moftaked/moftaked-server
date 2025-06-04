import express from 'express';
import { validateData } from '../middleware/validation.middleware';
import { signInSchema } from '../schemas/auth.schemas';
import { signIn } from '../controllers/auth.controller';
const authRouter = express.Router();

authRouter.post('/login', validateData(signInSchema), signIn);

export {authRouter};