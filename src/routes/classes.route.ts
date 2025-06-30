import express from 'express';
import { isAuthenticated, isInClass } from '../middleware/authorization.middleware';
import { Roles } from '../enums/roles.enum';
import { getClasses, getStudents, getTeachers } from '../controllers/classes.controller';

const classesRouter = express.Router();
classesRouter.use(isAuthenticated());

classesRouter.get('/', getClasses);
classesRouter.get(
  '/:classId/students', 
  isInClass('params', [Roles.teacher, Roles.leader, Roles.manager]),
  getStudents
);
classesRouter.get(
  '/:classId/teachers', 
  isInClass('params', [Roles.leader, Roles.manager]),
  getTeachers
);

export default classesRouter;