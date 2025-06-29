import { Request, Response } from "express";
import { CreateRoleDto } from "../schemas/roles.schemas";
import rolesService from "../services/roles.service";

export async function addRole(req: Request, res: Response) {
  const newRole: CreateRoleDto = req.body;
  const result = await rolesService.addRole(newRole.user, newRole.classId, newRole.role);
  res.json(result);
}

export async function getRoles(req: Request, res: Response) {
  let userId: number | string | undefined = req.params['userId'];
  if(userId) {
    userId = parseInt(userId);
    if(isNaN(userId) == false) {
      const result = await rolesService.getRoles(userId);
      res.json(result); 
    } else {
      res.status(400).json({error: "Invalid user ID"});
    }
  }
}