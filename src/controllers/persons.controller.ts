import { StatusCodes } from 'http-status-codes';
import { CreatePersonDto, UpdatePersonDto } from '../schemas/persons.schemas';
import personsService from '../services/persons.service';
import { NextFunction, Request, Response } from 'express';
import { Err } from 'result2';
import classesService from '../services/classes.service';
import { authenticatedLocals } from '../middleware/authorization.middleware';
import authService from '../services/auth.service';
import { Roles } from '../enums/roles.enum';
import createHttpError from 'http-errors';
import path from 'path';
import fs from 'fs';
import { processAndSaveImage, deleteImageVariants, sizedFilename, IMAGE_SIZES } from '../middleware/image-upload.middleware';
import type { SizeKey } from '../middleware/image-upload.middleware';
import dataVersionsService from '../services/data-versions.service';

export function createPerson(type: 'student' | 'teacher') {
  return async (req: Request, res: Response) => {
    const personData: CreatePersonDto = req.body;
    await personsService.createPerson(type, personData);
    res
      .status(StatusCodes.CREATED)
      .json({ success: true, message: 'Person created successfully' });
  };
}

export function getPersonById(type: 'student' | 'teacher') {
  return async (req: Request, res: Response) => {
    const personId = parseInt(
      type === 'student' ? req.params['studentId']! : req.params['teacherId']!,
      10,
    );
    if (isNaN(personId)) {
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Invalid person ID' });
      return;
    }

    try {
      const person = await personsService.getPersonById(personId);
      if (!person || (Array.isArray(person) && person.length === 0)) {
        res
          .status(StatusCodes.NOT_FOUND)
          .json({ success: false, message: 'Person not found' });
        return;
      }
      const personData = Array.isArray(person) ? person[0] : person;
      const classes = await personsService.getPersonClasses(personId);
      res.status(StatusCodes.OK).json({ success: true, data: { ...personData, type, classes } });
    } catch (error) {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: 'Error retrieving person' });
    }
  };
}

export function searchByName(type: 'student' | 'teacher') {
  return async (req: Request<any, any, any, {name: string}>, res: Response<any, authenticatedLocals>, next: NextFunction) => {
    const name: string = req.query.name;
    const userId: number = res.locals.user.sub;
    if (!name) {
      return next(Err(StatusCodes.BAD_REQUEST));
    }
    const joinedClasses = (await classesService.getUserJoinedSchoolsClasses(userId))
    .flatMap(school => school.classes)
    .map(c => c.class_id);
    const results = await personsService.searchByName(name, type, joinedClasses);
    res.status(StatusCodes.OK).json(results);
  }
}

export function updatePerson(type: 'student' | 'teacher') {
  return async (req: Request, res: Response) => {
    const personId = parseInt(
      type === 'student' ? req.params['studentId']! : req.params['teacherId']!,
      10,
    );
    if (isNaN(personId)) {
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Invalid person ID' });
      return;
    }

    const personData: UpdatePersonDto = req.body;

    const person = await personsService.getPersonById(personId);
    if (!person || (Array.isArray(person) && person.length === 0)) {
      res
        .status(StatusCodes.NOT_FOUND)
        .json({ success: false, message: 'Person not found' });
      return;
    }

    const affectedRows = await personsService.updatePerson(
      personId,
      personData,
    );
    if (affectedRows === 0) {
      res.status(StatusCodes.FORBIDDEN).json({
        success: false,
        message: 'You are not allowed to update this person',
      });
      return;
    }
    res
      .status(StatusCodes.OK)
      .json({ success: true, message: 'Person updated successfully' });
  };
}

export function servePhoto(
  req: Request<any, any, any, { size?: string }>,
  res: Response<any, authenticatedLocals>,
  next: NextFunction,
) {
  const filename = req.params.filename;
  if (!filename) return next(Err(StatusCodes.BAD_REQUEST));

  const base = filename.replace(/-(sm|md|lg)\.webp$/, '').replace(/\.webp$/, '');
  const size = (req.query.size ?? filename.match(/-(sm|md|lg)\.webp$/)?.[1] ?? 'md') as SizeKey;
  if (!(size in IMAGE_SIZES)) return next(Err(StatusCodes.BAD_REQUEST));

  const userId = res.locals.user.sub;

  personsService.getPersonIdByPhoto(base).then(personId => {
    if (!personId) return next(createHttpError(StatusCodes.NOT_FOUND, 'Photo not found'));

    personsService.getAllJoinedClasses(personId).then(personClasses => {
      if (personClasses.length === 0) return next(createHttpError(StatusCodes.FORBIDDEN, 'Not authorized'));

      authService.isInAnyClass(
        userId,
        personClasses.map(c => c.class_id),
        [Roles.teacher, Roles.leader, Roles.manager],
      ).then(authorized => {
        if (!authorized) return next(createHttpError(StatusCodes.FORBIDDEN, 'Not authorized'));

        const sizedFile = sizedFilename(base, size);
        const filePath = path.resolve('uploads', 'images', sizedFile);
        if (!fs.existsSync(filePath)) return next(createHttpError(StatusCodes.NOT_FOUND, 'Photo file not found'));

        res.sendFile(filePath);
      });
    });
  });
}

export async function uploadPhoto(req: Request, res: Response) {
  try {
    // Check if file was uploaded
    if (!req.file) {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'No photo file uploaded',
      });
      return;
    }

    // Process the image buffer into multiple sizes
    const baseFilename = await processAndSaveImage(req.file.buffer, req.file.fieldname);

    const photoData = {
      filename: baseFilename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    };

    res.status(StatusCodes.CREATED).json({
      success: true,
      message: 'Photo uploaded successfully',
      data: photoData,
    });
  } catch (error) {
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: 'Error uploading photo',
    });
  }
}

export function uploadPersonPhoto(type: 'student' | 'teacher') {
  return async (req: Request, res: Response) => {
    const personId = parseInt(
      type === 'student' ? req.params['studentId']! : req.params['teacherId']!,
      10,
    );
    if (isNaN(personId)) {
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ success: false, message: 'Invalid person ID' });
      return;
    }

    if (!req.file) {
      res.status(StatusCodes.BAD_REQUEST).json({
        success: false,
        message: 'No photo file uploaded',
      });
      return;
    }

    try {
      const person = await personsService.getPersonById(personId) as any[];
      const oldPhotoLink = person?.[0]?.photo_link;

      const baseFilename = await processAndSaveImage(req.file.buffer, req.file.fieldname);

      await personsService.updatePersonPhoto(personId, baseFilename);

      if (oldPhotoLink) {
        const oldBase = oldPhotoLink.replace(/\.webp$/, '');
        deleteImageVariants(oldBase);
        const legacyPath = path.join('uploads', 'images', oldPhotoLink);
        fs.unlink(legacyPath, (err) => {
          if (err) console.error(`Failed to delete legacy photo: ${legacyPath}`, err);
        });
      }

      const allClasses = await personsService.getPersonClasses(personId) as any[];
      const touchKeys: string[] = [];
      const touchedTypes = new Set<string>();
      for (const c of allClasses) {
        if (c.type === 'student') {
          touchKeys.push(dataVersionsService.classStudentsKey(c.class_id));
          touchedTypes.add('student');
        } else if (c.type === 'teacher') {
          touchKeys.push(dataVersionsService.classTeachersKey(c.class_id));
          touchedTypes.add('teacher');
        }
      }
      for (const t of touchedTypes) {
        touchKeys.push(dataVersionsService.personProfileKey(personId, t as 'student' | 'teacher'));
      }
      if (touchKeys.length > 0) {
        dataVersionsService.touch(...touchKeys).catch(() => {});
      }

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Photo uploaded and linked successfully',
        data: { filename: baseFilename },
      });
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Error uploading photo',
      });
    }
  };
}