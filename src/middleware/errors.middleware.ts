import { Request, Response, NextFunction } from "express";
import { StatusCodes } from "http-status-codes";
import { Result } from "result2";
import { ZodError } from "zod/v4";
import { HttpErr } from "../errors/base.errors";
import { JsonWebTokenError } from "jsonwebtoken";
import { HttpError } from "http-errors";

export function handleError(err: HttpErr | Error, _req: Request, res: Response, _next: NextFunction) {
  if (typeof err === "number") {
    res.status(err).end();
  } else if (err instanceof HttpError) {
    res.status(err.status).json({ success: false, message: err.message });
  } else if (err instanceof ZodError) {
    res.status(StatusCodes.BAD_REQUEST).json({ details: err.issues });
  } else if (err instanceof JsonWebTokenError) {
    res.status(StatusCodes.UNAUTHORIZED).end();
  } else if (err instanceof Result) {
    res.status(err.err()!).end();
  } else {
    console.error(err);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).end();
  }
}
