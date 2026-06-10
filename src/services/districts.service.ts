import { RowDataPacket } from 'mysql2/promise';
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
  const rows = await executeQuery<RowDataPacket[]>(
    `SELECT COUNT(*) as cnt FROM persons WHERE district_id = ?;`,
    [districtId],
  );
  const cnt = (rows[0] as Record<string, number>)['cnt'];
  if (cnt && cnt > 0) {
    throw Object.assign(new Error(`District has ${cnt} person(s) assigned`), { statusCode: 409, personCount: cnt });
  }
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
