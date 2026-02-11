import { StatusCodes } from 'http-status-codes';
import { CreatePersonDto, UpdatePersonDto } from '../schemas/persons.schemas';
import personsService from '../services/persons.service';
import { NextFunction, Request, Response } from 'express';
import { Err } from 'result2';
import classesService from '../services/classes.service';
import { authenticatedLocals } from '../middleware/authorization.middleware';
import path from 'path';
import fs from 'fs';

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
    .map(school => school.classes).reduce((classes, schoolClasses) => {
      classes.push(...schoolClasses)
      return classes;
    }, []).map(c => c.class_id);
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

    // The file has been saved by multer to uploads/images directory
    // Return the file path and other relevant information
    const photoData = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: req.file.path,
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
      // Get old photo to delete it later
      const person = await personsService.getPersonById(personId) as any[];
      const oldPhotoLink = person?.[0]?.photo_link;

      // Update the person's photo_link in the database
      const filename = req.file.filename;
      await personsService.updatePersonPhoto(personId, filename);

      // Delete old photo file if it exists
      if (oldPhotoLink) {
        const oldPath = path.join('uploads', 'images', oldPhotoLink);
        fs.unlink(oldPath, () => {}); // fire-and-forget
      }

      res.status(StatusCodes.OK).json({
        success: true,
        message: 'Photo uploaded and linked successfully',
        data: { filename },
      });
    } catch (error) {
      // Clean up uploaded file on error
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Error uploading photo',
      });
    }
  };
}
