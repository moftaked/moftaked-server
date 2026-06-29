import { NextFunction, Request, Response } from 'express';
import { SignInDto } from '../schemas/auth.schemas';
import authService from '../services/auth.service';
import { StatusCodes } from 'http-status-codes';
import { Err } from 'result2';

const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string) {
  res.cookie('refresh_token', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/auth',
    maxAge: REFRESH_COOKIE_MAX_AGE,
  });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie('refresh_token', { path: '/auth' });
}

function stripRefreshToken(data: Record<string, unknown>) {
  const token = data['refresh_token'] as string | undefined;
  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(data)) {
    if (key !== 'refresh_token') {
      rest[key] = data[key];
    }
  }
  return { token, rest };
}

export async function signIn(req: Request, res: Response, next: NextFunction) {
  const credentials: SignInDto = req.body;

  const result = await authService.signIn(
    credentials.username,
    credentials.password,
  );

  result.match(
    (ok) => {
      const { token, rest } = stripRefreshToken(ok as Record<string, unknown>);
      setRefreshCookie(res, token!);
      res.status(StatusCodes.OK).json({ success: true, data: rest });
    },
    (err) => {
      next(err);
    }
  );
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  const refreshToken = req.cookies?.['refresh_token'];
  if (!refreshToken) return next(Err(StatusCodes.UNAUTHORIZED));

  const result = await authService.refreshToken(refreshToken);

  result.match(
    (ok) => {
      const { token, rest } = stripRefreshToken(ok as Record<string, unknown>);
      setRefreshCookie(res, token!);
      res.status(StatusCodes.OK).json({ success: true, data: rest });
    },
    (err) => {
      next(err);
    }
  );
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  const refreshToken = req.cookies?.['refresh_token'];

  if (refreshToken) {
    const result = await authService.logout(refreshToken);
    if (result.isErr()) return next(result.err());
  }

  clearRefreshCookie(res);
  res.status(StatusCodes.OK).json({ success: true });
}
