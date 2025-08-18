import { NextFunction, Request, Response } from 'express';
import { SignInDto } from '../schemas/auth.schemas';
import authService from '../services/auth.service';
import { StatusCodes } from 'http-status-codes/build/cjs/status-codes';

export async function signIn(req: Request, res: Response, next: NextFunction) {
  const credentials: SignInDto = req.body;
  try {
    const result = await authService.signIn(
      credentials.username,
      credentials.password,
    );
    res.status(StatusCodes.OK).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
}

export async function verifyToken(req: Request, res: Response) {
  const result = authService.verify(req.body.token);
  res.status(StatusCodes.OK).json({ success: true, data: result });
}
