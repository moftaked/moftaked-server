import { StatusCodes } from 'http-status-codes';
import { CreatePersonDto, UpdatePersonDto } from '../schemas/persons.schemas';
import personsService from '../services/persons.service';
import { Request, Response } from 'express';

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
      if (!person) {
        res
          .status(StatusCodes.NOT_FOUND)
          .json({ success: false, message: 'Person not found' });
        return;
      }
      res.status(StatusCodes.OK).json({ success: true, data: person });
    } catch (error) {
      res
        .status(StatusCodes.INTERNAL_SERVER_ERROR)
        .json({ success: false, message: 'Error retrieving person' });
    }
  };
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
