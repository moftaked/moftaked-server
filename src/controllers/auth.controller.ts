import { NextFunction, Request, Response } from 'express';
import { SignInDto } from '../schemas/auth.schemas';
import authService from '../services/auth.service';
import { StatusCodes } from 'http-status-codes';

export async function signIn(req: Request, res: Response, next: NextFunction) {
  const credentials: SignInDto = req.body;
  
  const result = await authService.signIn(
    credentials.username,
    credentials.password,
  );
  
  result.match(
    (ok) => {
      res.status(StatusCodes.OK).json({ success: true, data: ok });
    },
    (err) => {
      next(err);
    }
  );
}