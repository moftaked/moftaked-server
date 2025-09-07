export class ApplicationError extends Error {
  constructor(
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

import { Err } from "result2";

export type HttpErr = Err<number>;
