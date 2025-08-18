import { expect, jest, describe, it, afterEach } from '@jest/globals';
import { Request, Response } from 'express';
import { createDistrict, getDistricts } from '../../src/controllers/districts.controller';
import districtsService from '../../src/services/districts.service';

jest.mock('../../src/services/districts.service');

let mockedDistrictsService = districtsService as jest.Mocked<typeof districtsService>;

afterEach(() => {
  jest.clearAllMocks();
});

describe('Districts Controller', () => {
  describe('getDistricts', () => {
    it('should call districtsService.getDistricts', async () => {
      const req = {} as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any as Response;

      await getDistricts(req, res);

      expect(mockedDistrictsService.getDistricts).toHaveBeenCalledWith();
    });
  });

  describe('createDistrict', () => {
    it('should call districtsService.createDistrict with correct data', async () => {
      const req = {
        body: {
          name: 'New District',
        }
      } as Request;
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      } as any as Response;

      await createDistrict(req, res);

      expect(mockedDistrictsService.createDistrict).toHaveBeenCalledWith({
        name: 'New District'
      });
    });
  });
});
