import classesService from "../services/classes.service";
import { Request, Response } from "express";

export async function getClasses(_req: Request, res: Response) {
  const userId: number = res.locals["user"]["sub"];
  const classes = await classesService.getUserJoinedClasses(userId);
  res.json(classes);
};

export async function getStudents(req: Request, res: Response) {
  let classId: string | number | undefined = req.params["classId"];
  if(classId) {
    classId = parseInt(classId);
    const students = await classesService.getStudents(classId);
    res.json(students);
  }
  res.status(400).json({ error: "Invalid class ID" }); // handle this in the global error handler
}

export async function getTeachers(req: Request, res: Response) {
  let classId: string | number | undefined = req.params["classId"];
  if(classId) {
    classId = parseInt(classId);
    const teachers = await classesService.getTeachers(classId);
    res.json(teachers);
  }
  res.status(400).json({ error: "Invalid class ID" }); // handle this in the global error handler
}

export default { getStudents, getTeachers };