import { Request, Response, NextFunction } from "express";
import CreateHttpError from "http-errors";
import { StatusCodes } from "http-status-codes";
import { ZodError } from "zod/v4";

export function handleError(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: 'Invalid request data', details: err.issues });
  } else if (CreateHttpError.isHttpError(err)) {
    res.status(err.status).json({ error: err.message });
  } else {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
