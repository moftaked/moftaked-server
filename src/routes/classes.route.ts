import express from 'express';
import {
  isAuthenticated,
  isInClass,
  hasRole,
} from '../middleware/authorization.middleware';
import { Roles } from '../enums/roles.enum';
import { validateData } from '../middleware/validation.middleware';
import {
  CreateSchoolSchema,
  UpdateSchoolSchema,
  CreateClassSchema,
  UpdateClassSchema,
  UpdateEventSchema,
} from '../schemas/classes.schemas';
import {
  deletePerson,
  getClasses,
  getStudents,
  getTeachers,
  getSchools,
  createSchool,
  updateSchool,
  deleteSchool,
  getAllClassesWithSchool,
  createClass,
  updateClass,
  deleteClassById,
  updateEvent,
} from '../controllers/classes.controller';

const classesRouter = express.Router();
classesRouter.use(isAuthenticated());

classesRouter.get('/', getClasses);
classesRouter.get(
  '/:classId/students',
  isInClass('params', [Roles.teacher, Roles.leader, Roles.manager]),
  getStudents,
);
classesRouter.get(
  '/:classId/teachers',
  isInClass('params', [Roles.leader, Roles.manager]),
  getTeachers,
);

classesRouter.delete(
  '/:classId/students/:studentId',
  isInClass('params', [Roles.teacher, Roles.leader, Roles.manager]),
  deletePerson('student')
);

classesRouter.delete(
  '/:classId/teachers/:teacherId',
  isInClass('params', [Roles.leader, Roles.manager]),
  deletePerson('teacher')
);

// ---------------------------------------------------------------------------
// School CRUD (manager only)
// ---------------------------------------------------------------------------

classesRouter.get('/schools', hasRole([Roles.manager]), getSchools);

classesRouter.post(
  '/schools',
  hasRole([Roles.manager]),
  validateData(CreateSchoolSchema),
  createSchool,
);

classesRouter.put(
  '/schools/:schoolId',
  hasRole([Roles.manager]),
  validateData(UpdateSchoolSchema),
  updateSchool,
);

classesRouter.delete(
  '/schools/:schoolId',
  hasRole([Roles.manager]),
  deleteSchool,
);

// ---------------------------------------------------------------------------
// Class CRUD (manager only)
// ---------------------------------------------------------------------------

classesRouter.get('/all', hasRole([Roles.manager]), getAllClassesWithSchool);

classesRouter.post(
  '/',
  hasRole([Roles.manager]),
  validateData(CreateClassSchema),
  createClass,
);

classesRouter.put(
  '/:classId',
  hasRole([Roles.manager]),
  validateData(UpdateClassSchema),
  updateClass,
);

classesRouter.delete(
  '/:classId/delete',
  hasRole([Roles.manager]),
  deleteClassById,
);

// ---------------------------------------------------------------------------
// Event update (manager only)
// ---------------------------------------------------------------------------

classesRouter.put(
  '/events/:eventId',
  hasRole([Roles.manager]),
  validateData(UpdateEventSchema),
  updateEvent,
);

export default classesRouter;