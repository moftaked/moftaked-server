import { createPerson, getPersonById } from '../../src/controllers/persons.controller';
import { expect, jest, describe, it, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import personsService from '../../src/services/persons.service';
import { QueryResult } from 'mysql2';
// import { StatusCodes } from 'http-status-codes';
// import { eventTypes } from '../../src/enums/eventTypes.enum';
// const createHttpError = require('http-errors');

jest.mock('../../src/services/persons.service');

let mockedPersonsService = personsService as jest.Mocked<typeof personsService>;

afterEach(() => {
  jest.clearAllMocks();
});

describe('Persons Controller', () => {
  describe('createPerson', () => {
    it('should call personsService.createPerson with the correct parameters for', () => {
      (['student', 'teacher'] as const).forEach(async (type) => {
        const handler = createPerson(type);
        const req = {
          body: {
            name: 'John Doe',
            address: '123 Main St',
            phone_number: '1234567',
            second_phone_number: '7654321',
            district_id: 1,
            notes: 'Some notes',
            class_id: 1,
          },
        } as any as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as unknown as Response;

        await handler(req, res);

        expect(mockedPersonsService.createPerson).toHaveBeenCalledWith(type, {
          name: 'John Doe',
          address: '123 Main St',
          phone_number: '1234567',
          second_phone_number: '7654321',
          district_id: 1,
          notes: 'Some notes',
          class_id: 1,
        });
      });
    });
  });

  describe('getPersonById', () => {
    it('should call personsService.getPersonById with the correct parameter', () => {
      (['student', 'teacher'] as const).forEach(async (type) => {
        mockedPersonsService.getPersonById.mockResolvedValue({
          id: 1,
          name: 'John Doe',
          address: '123 Main St',
          phone_number: '1234567',
          second_phone_number: '7654321',
          district_id: 1,
          notes: 'Some notes',
        } as unknown as QueryResult);
        const handler = getPersonById(type);
        const req = {
          params: {
            [type === 'student' ? 'studentId' : 'teacherId']: '1',
          },
        } as any as Request;

        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        } as unknown as Response;

        await handler(req, res);

        expect(mockedPersonsService.getPersonById).toHaveBeenCalledWith(1);
      });
    });
  });
});