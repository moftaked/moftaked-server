import express from 'express';
import {
  hasRole,
  isAuthenticated,
  isInClass,
  isInPersonClass,
} from '../middleware/authorization.middleware';
import { Roles } from '../enums/roles.enum';
import { validateData } from '../middleware/validation.middleware';
import {
  createPersonSchema,
  updatePersonSchema,
} from '../schemas/persons.schemas';
import {
  createPerson,
  getPersonById,
  searchByName,
  updatePerson,
  uploadPhoto,
  uploadPersonPhoto,
} from '../controllers/persons.controller';
import { upload } from '../middleware/image-upload.middleware';

const personsRouter = express.Router();

personsRouter.use(isAuthenticated());

//todo: cron job to delete unused uploaded photos, and a rate limiter on upload image routes.
personsRouter.post('/photos', upload.single('photo'), uploadPhoto);

personsRouter.post(
  '/students',
  validateData(createPersonSchema),
  isInClass('body', [Roles.teacher, Roles.leader, Roles.manager]),
  createPerson('student'),
);

personsRouter.post(
  '/teachers',
  validateData(createPersonSchema),
  isInClass('body', [Roles.leader, Roles.manager]),
  createPerson('teacher'),
);

//todo: cron job to normalize unprocessed person names on database update
personsRouter.get('/students', searchByName('student'));

personsRouter.get('/teachers', hasRole([Roles.teacher, Roles.manager]), searchByName('teacher'));

personsRouter.get(
  '/students/:studentId',
  isInPersonClass('studentId', 'student', [
    Roles.teacher,
    Roles.leader,
    Roles.manager,
  ]),
  getPersonById('student'),
);

personsRouter.get(
  '/teachers/:teacherId',
  isInPersonClass('teacherId', 'teacher', [Roles.leader, Roles.manager]),
  getPersonById('teacher'),
);

// Upload photo for a specific student
personsRouter.post(
  '/students/:studentId/photo',
  isInPersonClass('studentId', 'student', [
    Roles.teacher,
    Roles.leader,
    Roles.manager,
  ]),
  upload.single('photo'),
  uploadPersonPhoto('student'),
);

// Upload photo for a specific teacher
personsRouter.post(
  '/teachers/:teacherId/photo',
  isInPersonClass('teacherId', 'teacher', [Roles.leader, Roles.manager]),
  upload.single('photo'),
  uploadPersonPhoto('teacher'),
);

personsRouter.put(
  '/students/:studentId',
  isInPersonClass('studentId', 'student', [
    Roles.teacher,
    Roles.leader,
    Roles.manager,
  ]),
  validateData(updatePersonSchema),
  updatePerson('student'),
);

personsRouter.put(
  '/teachers/:teacherId',
  isInPersonClass('teacherId', 'teacher', [Roles.leader, Roles.manager]),
  validateData(updatePersonSchema),
  updatePerson('teacher'),
);

export { personsRouter };
