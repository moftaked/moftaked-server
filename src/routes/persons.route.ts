import express from 'express';
import {
  hasRole,
  isAuthenticated,
  isInPersonClass,
  isInClass,
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
  servePhoto,
} from '../controllers/persons.controller';
import { upload } from '../middleware/image-upload.middleware';
import { photoUploadRateLimiter } from '../middleware/rate-limiting.middleware';

const personsRouter = express.Router();

personsRouter.use(isAuthenticated());

personsRouter.get('/photos/:filename', servePhoto);

personsRouter.post('/photos', photoUploadRateLimiter, upload.single('photo'), uploadPhoto);

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

personsRouter.get('/students', searchByName('student'));

personsRouter.get('/teachers', hasRole([Roles.leader, Roles.manager]), searchByName('teacher'));

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
  '/students/:studentId/photo',
  isInPersonClass('studentId', 'student', [
    Roles.teacher,
    Roles.leader,
    Roles.manager,
  ]),
  photoUploadRateLimiter,
  upload.single('photo'),
  uploadPersonPhoto('student'),
);

personsRouter.post(
  '/teachers/:teacherId/photo',
  isInPersonClass('teacherId', 'teacher', [Roles.leader, Roles.manager]),
  photoUploadRateLimiter,
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
