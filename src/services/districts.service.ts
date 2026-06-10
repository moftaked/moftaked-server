import { CreateDistrictDto } from '../schemas/districts.schemas';
import { executeQuery, getConnection } from './database.service';
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

async function mergeDistricts(sourceId: number, targetId: number) {
  const connection = await getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE persons SET district_id = ? WHERE district_id = ?;`,
      [targetId, sourceId],
    );
    await connection.query(
      `DELETE FROM districts WHERE district_id = ?;`,
      [sourceId],
    );
    await connection.commit();
    dataVersionsService.touchDistricts().catch(() => {});
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
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
  mergeDistricts,
};
