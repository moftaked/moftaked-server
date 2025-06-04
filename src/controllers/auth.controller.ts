import { Request, Response } from "express";
import { SignInDto } from "../schemas/auth.schemas";
import authService from "../services/auth.service";

export async function signIn(req: Request, res: Response) {
  const credentials: SignInDto = req.body;
  const result = await authService.signIn(credentials.username, credentials.password)
  res.json(result);
}

export async function verifyToken(req: Request, res: Response) {
  const result = authService.verify(req.body.token);
  res.json(result);
}