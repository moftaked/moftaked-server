import { Request, Response } from "express";
import accountsService from "../services/accounts.service";
import { CreateAccountDto } from "../schemas/accounts.schemas";

export async function createAccount(req: Request, res: Response) {
  const newUser: CreateAccountDto = req.body;
  const result = await accountsService.createAccount(newUser.username, newUser.real_name, newUser.password);
  res.json(result);
}
