import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';

// Mock dependencies before importing the service
jest.mock('../../src/services/database.service');
jest.mock('../../src/services/data-versions.service');

import districtsService from '../../src/services/districts.service';
import { executeQuery } from '../../src/services/database.service';
import dataVersionsService from '../../src/services/data-versions.service';

const mockedExecuteQuery = executeQuery as jest.MockedFunction<typeof executeQuery>;
const mockedDataVersionsService = dataVersionsService as jest.Mocked<typeof dataVersionsService>;

describe('Districts Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDataVersionsService.touchDistricts.mockReturnValue(Promise.resolve() as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createDistrict()', () => {
    it('should insert a district with the correct name', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await districtsService.createDistrict({ name: 'دمنهور' });

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      const [queryStr, params] = mockedExecuteQuery.mock.calls[0]!;
      expect(queryStr).toContain('INSERT INTO districts');
      expect(queryStr).toContain('district_name');
      expect(params).toEqual(['دمنهور']);
    });

    it('should touch the districts data version after insert', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await districtsService.createDistrict({ name: 'إسكندرية' });

      expect(mockedDataVersionsService.touchDistricts).toHaveBeenCalledTimes(1);
    });

    it('should call touchDistricts even if executeQuery succeeds', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await districtsService.createDistrict({ name: 'القاهرة' });

      expect(mockedDataVersionsService.touchDistricts).toHaveBeenCalled();
    });

    it('should not throw if touchDistricts rejects (caught with .catch)', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);
      mockedDataVersionsService.touchDistricts.mockReturnValue(Promise.reject(new Error('version error')) as any);

      // createDistrict uses .catch(() => {}) on touchDistricts, so it should not throw
      await expect(
        districtsService.createDistrict({ name: 'طنطا' }),
      ).resolves.not.toThrow();
    });

    it('should return undefined (void function)', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      const result = await districtsService.createDistrict({ name: 'المنصورة' });

      expect(result).toBeUndefined();
    });

    it('should propagate DB errors from executeQuery', async () => {
      const dbError = new Error('Duplicate entry');
      mockedExecuteQuery.mockRejectedValue(dbError as never);

      await expect(
        districtsService.createDistrict({ name: 'دمنهور' }),
      ).rejects.toThrow('Duplicate entry');
    });

    it('should not call touchDistricts if executeQuery fails', async () => {
      mockedExecuteQuery.mockRejectedValue(new Error('DB error') as never);

      await expect(
        districtsService.createDistrict({ name: 'دمنهور' }),
      ).rejects.toThrow();

      expect(mockedDataVersionsService.touchDistricts).not.toHaveBeenCalled();
    });

    it('should handle Arabic names correctly', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await districtsService.createDistrict({ name: 'منطقة 15 - شمال' });

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual(['منطقة 15 - شمال']);
    });

    it('should handle English names correctly', async () => {
      mockedExecuteQuery.mockResolvedValue(undefined as any);

      await districtsService.createDistrict({ name: 'Downtown' });

      const params = mockedExecuteQuery.mock.calls[0]![1];
      expect(params).toEqual(['Downtown']);
    });
  });

  describe('getDistricts()', () => {
    it('should return all districts from the database', async () => {
      const mockDistricts = [
        { district_id: 1, district_name: 'دمنهور' },
        { district_id: 2, district_name: 'إسكندرية' },
        { district_id: 3, district_name: 'القاهرة' },
      ];
      mockedExecuteQuery.mockResolvedValue(mockDistricts as any);

      const result = await districtsService.getDistricts();

      expect(result).toEqual(mockDistricts);
      expect(result).toHaveLength(3);
    });

    it('should query with the correct SQL selecting district_id and district_name', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await districtsService.getDistricts();

      expect(mockedExecuteQuery).toHaveBeenCalledTimes(1);
      const queryStr = mockedExecuteQuery.mock.calls[0]![0] as string;
      expect(queryStr).toContain('SELECT');
      expect(queryStr).toContain('district_id');
      expect(queryStr).toContain('district_name');
      expect(queryStr).toContain('districts');
    });

    it('should return an empty array when no districts exist', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      const result = await districtsService.getDistricts();

      expect(result).toEqual([]);
    });

    it('should not call any data version service methods', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await districtsService.getDistricts();

      expect(mockedDataVersionsService.touchDistricts).not.toHaveBeenCalled();
    });

    it('should propagate DB errors from executeQuery', async () => {
      mockedExecuteQuery.mockRejectedValue(new Error('Connection lost') as never);

      await expect(
        districtsService.getDistricts(),
      ).rejects.toThrow('Connection lost');
    });

    it('should return a single district when only one exists', async () => {
      const mockDistricts = [
        { district_id: 1, district_name: 'دمنهور' },
      ];
      mockedExecuteQuery.mockResolvedValue(mockDistricts as any);

      const result = await districtsService.getDistricts();

      expect(result).toEqual(mockDistricts);
      expect(result).toHaveLength(1);
    });

    it('should not pass any query parameters', async () => {
      mockedExecuteQuery.mockResolvedValue([] as any);

      await districtsService.getDistricts();

      // getDistricts calls executeQuery with just the query string, no params
      expect(mockedExecuteQuery).toHaveBeenCalledWith(
        expect.any(String),
      );
      // Verify no second argument (params) was passed
      expect(mockedExecuteQuery.mock.calls[0]).toHaveLength(1);
    });
  });
});