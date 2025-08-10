import express from 'express';
import { isAuthenticated, isInClass } from '../middleware/authorization.middleware';
import { Roles } from '../enums/roles.enum';
import { validateData } from '../middleware/validation.middleware';
import { createPersonSchema, updatePersonSchema } from '../schemas/persons.schemas';
import { createPerson, getPersonById, updatePerson, uploadPhoto } from '../controllers/persons.controller';
import { upload } from '../middleware/image-upload.middleware';

const personsRouter = express.Router();

personsRouter.use(isAuthenticated());


//todo: complete upload photos
personsRouter.post(
  '/photos',
  upload.single('photo'),
  uploadPhoto
)

personsRouter.get(
  '/students/:studentId',
  // we need to check if the user is in the class of the student, and if the studentId is an id of a student at the user joined class
  getPersonById('student')
)

personsRouter.get(
  '/teachers/:teacherId',
  // we need to check if the user is in the class of the teacher, and if the teacherId is an id of a teacher at the user joined class
  getPersonById('teacher')
)

personsRouter.post(
  '/students',
  validateData(createPersonSchema),
  isInClass('body', [Roles.teacher, Roles.leader, Roles.manager]),
  createPerson('student')
);

personsRouter.post(
  '/teachers',
  validateData(createPersonSchema),
  isInClass('body', [Roles.leader, Roles.manager]),
  createPerson('teacher')
);

personsRouter.put(
  '/students/:studentId',
  // we need to check if the user is in the class of the student, and if the studentId is an id of a student at the user joined class
  validateData(updatePersonSchema),
  updatePerson('student')
);

personsRouter.put(
  '/teachers/:teacherId',
  // we need to check if the user is in the class of the teacher, and if the teacherId is an id of a teacher at the user joined class
  validateData(updatePersonSchema),
  updatePerson('teacher')
);

export { personsRouter };