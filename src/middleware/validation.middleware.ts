import { Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';

export function validateData(schema: z.ZodObject) {
  return (req: Request, _res: Response, next: NextFunction) => {
    let result = schema.safeParse(req.body);
    if (!result.success) {
      next(result.error);
      return;
    }
    next();
  };
}
