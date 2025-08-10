import { CreateDistrictDto } from "../schemas/districts.schemas";
import { executeQuery } from "./database.service";

async function createDistrict(data: CreateDistrictDto) {
  await executeQuery(
    `
      INSERT INTO districts (district_name)
      VALUES (?);
  `,
  [data.name]
  );
  return;
}

async function getDistricts() {
  const districts = await executeQuery(
    `
      SELECT district_id, district_name FROM districts;
    `
  );
  return districts;
}

export default {
  createDistrict,
  getDistricts,
};
