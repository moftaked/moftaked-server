import {Request, Response, NextFunction} from 'express';
import {z, ZodError} from 'zod/v4';

import {StatusCodes} from 'http-status-codes';

export function validateData(schema: z.ZodObject) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      console.log(req.body)
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errorMessages = error.issues.map(issue => ({
          message: `${issue.path.join('.')} is ${issue.message}`,
        }));
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({error: 'Invalid data', details: errorMessages});
      } else {
        res
          .status(StatusCodes.INTERNAL_SERVER_ERROR)
          .json({error: 'Internal Server Error'});
      }
    }
  };
}
