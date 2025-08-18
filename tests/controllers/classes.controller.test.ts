import { expect, jest, describe, it, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { getClasses, getStudents, getTeachers, deletePerson } from '../../src/controllers/classes.controller';
import classesService from '../../src/services/classes.service';
import personsService from '../../src/services/persons.service';

const createHttpError = require('http-errors');

jest.mock('../../src/services/classes.service');
jest.mock('../../src/services/persons.service');

let mockedClassesService = classesService as jest.Mocked<typeof classesService>;
let mockedPersonsService = personsService as jest.Mocked<typeof personsService>;

afterEach(() => {
  jest.clearAllMocks();
});

describe('Classes Controller', () => {
  describe('getClasses', () => {
    it('should call classesService.getUserJoinedClasses with user ID', async () => {

      const req = {} as Request;
      const res = {
        locals: { user: { sub: 123 } },
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any as Response;

      await getClasses(req, res);

      expect(mockedClassesService.getUserJoinedClasses).toHaveBeenCalledWith(123);
    });
  });

  describe('getStudents', () => {
    it('should call classesService.getStudents with class ID', async () => {
      const req = {
        params: { classId: '123' }
      } as any as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any as Response;
      const next = jest.fn();

      await getStudents(req, res, next);

      expect(mockedClassesService.getStudents).toHaveBeenCalledWith(123);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 error for invalid class ID', async () => {
      const req = {
        params: { classId: 'invalid' }
      } as any as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any as Response;
      const next = jest.fn();

      await getStudents(req, res, next);

      expect(next).toHaveBeenCalledWith(createHttpError(400, 'Invalid class ID'));
      expect(mockedClassesService.getStudents).not.toHaveBeenCalled();
    });
  });

  describe('getTeachers', () => {
    it('should call classesService.getTeachers with class ID', async () => {

      const req = {
        params: { classId: '456' }
      } as any as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any as Response;
      const next = jest.fn();

      await getTeachers(req, res, next);

      expect(mockedClassesService.getTeachers).toHaveBeenCalledWith(456);
    });

    it('should return 400 error for invalid class ID', async () => {
      const req = {
        params: { classId: 'not-a-number' }
      } as any as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any as Response;
      const next = jest.fn();

      await getTeachers(req, res, next);

      expect(next).toHaveBeenCalledWith(createHttpError(400, 'Invalid class ID'));
      expect(mockedClassesService.getTeachers).not.toHaveBeenCalled();
    });
  });

  describe('deletePerson', () => {
    it('should call unassignPerson with correct parameters', async () => {
      (['student', 'teacher'] as ('teacher' | 'student')[]).forEach(async type => {
        const handler = deletePerson(type);
        const req = {
          params: { [type == 'student' ? 'studentId' : 'teacherId']: '123', classId: '456' }
        } as any as Request;
        const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
        } as any as Response;
        const next = jest.fn();

        await handler(req, res, next);

        expect(mockedPersonsService.unassignPerson).toHaveBeenCalledWith(123, 456, type);
      });
    });

    it('should return 400 error for invalid student ID', async () => {
      const handler = deletePerson('student');
      const req = {
        params: { studentId: 'invalid', classId: '456' }
      } as any as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any as Response;
      const next = jest.fn();

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(createHttpError(400, 'Invalid person ID or class ID'));
      expect(mockedPersonsService.unassignPerson).not.toHaveBeenCalled();
    });

    it('should return 400 error for invalid class ID', async () => {
      const handler = deletePerson('student');
      const req = {
        params: { studentId: '123', classId: 'invalid' }
      } as any as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any as Response;
      const next = jest.fn();

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(createHttpError(400, 'Invalid person ID or class ID'));
      expect(mockedPersonsService.unassignPerson).not.toHaveBeenCalled();
    });
    
    it('should return 400 error for invalid teacher ID', async () => {
      const handler = deletePerson('teacher');
      const req = {
        params: { teacherId: 'invalid', classId: '456' }
      } as any as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any as Response;
      const next = jest.fn();

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(createHttpError(400, 'Invalid person ID or class ID'));
      expect(mockedPersonsService.unassignPerson).not.toHaveBeenCalled();
    });
  });
});