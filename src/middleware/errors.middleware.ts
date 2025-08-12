import { Request, Response, NextFunction } from "express";

export function handleError(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(err);
  res.status(500).json({ error: 'Internal Server Error' });
}
