import { CreateDistrictDto } from '../schemas/districts.schemas';
import { executeQuery } from './database.service';
import dataVersionsService from './data-versions.service';

async function createDistrict(data: CreateDistrictDto) {
  await executeQuery(
    `
      INSERT INTO districts (district_name)
      VALUES (?);
  `,
    [data.name],
  );
  dataVersionsService.touchDistricts().catch(() => {});
  return;
}

async function getDistricts() {
  const districts = await executeQuery(
    `
      SELECT district_id, district_name FROM districts;
    `,
  );
  return districts;
}

async function deleteDistrict(districtId: number) {
  await executeQuery(
    `DELETE FROM districts WHERE district_id = ?;`,
    [districtId],
  );
  dataVersionsService.touchDistricts().catch(() => {});
}

export default {
  createDistrict,
  getDistricts,
  deleteDistrict,
};
