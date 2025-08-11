import express from 'express';
import {
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
  updatePerson,
  uploadPhoto,
} from '../controllers/persons.controller';
import { upload } from '../middleware/image-upload.middleware';

const personsRouter = express.Router();

personsRouter.use(isAuthenticated());

//todo: complete upload photos, delete persons, update/delete photos.
personsRouter.post('/photos', upload.single('photo'), uploadPhoto);

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
