import { ApplicationError } from "./base.errors";

export class UserNotFoundError extends ApplicationError {
  constructor() {
    super("User not found");
    this.name = this.constructor.name;
  }
}

export class InvalidCredentialsError extends ApplicationError {
  constructor() {
    super("Invalid credentials");
    this.name = this.constructor.name;
  }
}