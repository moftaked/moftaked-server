import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import {
  createTestDatabase,
  dropTestDatabase,
  truncateAllTables,
} from '../helpers/test-db';
import districtsService from '../../src/services/districts.service';

describe('Districts Service — DB Integration', () => {
  beforeAll(async () => {
    await createTestDatabase();
  });

  afterAll(async () => {
    await dropTestDatabase();
  });

  beforeEach(async () => {
    await truncateAllTables();
  });

  describe('createDistrict()', () => {
    it('should insert a district and be retrievable via getDistricts', async () => {
      await districtsService.createDistrict({ name: 'دمنهور' });

      const districts = await districtsService.getDistricts();
      expect(districts).toHaveLength(1);
      expect((districts as any[])[0]).toMatchObject({
        district_name: 'دمنهور',
      });
      expect((districts as any[])[0].district_id).toBeDefined();
    });

    it('should store and retrieve Arabic names with correct utf8mb4 encoding', async () => {
      const arabicNames = ['الإسكندرية', 'منطقة الحي الأول', 'شارع عبد الناصر'];

      for (const name of arabicNames) {
        await districtsService.createDistrict({ name });
      }

      const districts = (await districtsService.getDistricts()) as any[];
      expect(districts).toHaveLength(3);

      const names = districts.map((d: any) => d.district_name);
      expect(names).toContain('الإسكندرية');
      expect(names).toContain('منطقة الحي الأول');
      expect(names).toContain('شارع عبد الناصر');
    });

    it('should assign auto-incrementing district_id values', async () => {
      await districtsService.createDistrict({ name: 'District A' });
      await districtsService.createDistrict({ name: 'District B' });

      const districts = (await districtsService.getDistricts()) as any[];
      expect(districts).toHaveLength(2);

      const ids = districts.map((d: any) => d.district_id);
      expect(ids[0]).toBeDefined();
      expect(ids[1]).toBeDefined();
      expect(ids[0]).not.toEqual(ids[1]);
    });

    it('should handle district names with special characters and numbers', async () => {
      await districtsService.createDistrict({ name: 'منطقة 15 - شمال' });

      const districts = (await districtsService.getDistricts()) as any[];
      expect(districts).toHaveLength(1);
      expect(districts[0].district_name).toBe('منطقة 15 - شمال');
    });

    it('should handle English district names correctly', async () => {
      await districtsService.createDistrict({ name: 'Downtown' });

      const districts = (await districtsService.getDistricts()) as any[];
      expect(districts).toHaveLength(1);
      expect(districts[0].district_name).toBe('Downtown');
    });
  });

  describe('getDistricts()', () => {
    it('should return an empty array when no districts exist', async () => {
      const districts = await districtsService.getDistricts();
      expect(districts).toEqual([]);
    });

    it('should return all inserted districts', async () => {
      await districtsService.createDistrict({ name: 'District 1' });
      await districtsService.createDistrict({ name: 'District 2' });
      await districtsService.createDistrict({ name: 'District 3' });

      const districts = (await districtsService.getDistricts()) as any[];
      expect(districts).toHaveLength(3);
    });

    it('should return rows with district_id and district_name columns', async () => {
      await districtsService.createDistrict({ name: 'TestDistrict' });

      const districts = (await districtsService.getDistricts()) as any[];
      expect(districts).toHaveLength(1);

      const district = districts[0];
      expect(district).toHaveProperty('district_id');
      expect(district).toHaveProperty('district_name');
      expect(typeof district.district_id).toBe('number');
      expect(typeof district.district_name).toBe('string');
    });

    it('should return a single district when only one exists', async () => {
      await districtsService.createDistrict({ name: 'Only One' });

      const districts = (await districtsService.getDistricts()) as any[];
      expect(districts).toHaveLength(1);
      expect(districts[0].district_name).toBe('Only One');
    });

    it('should return a fresh result after truncation (isolation check)', async () => {
      await districtsService.createDistrict({ name: 'Before Truncate' });
      expect(await districtsService.getDistricts()).toHaveLength(1);

      await truncateAllTables();

      const districts = await districtsService.getDistricts();
      expect(districts).toEqual([]);
    });
  });
});