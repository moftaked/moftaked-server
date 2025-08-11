import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import { CreateDistrictDto } from '../schemas/districts.schemas';
import districtsService from '../services/districts.service';

export async function createDistrict(req: Request, res: Response) {
  const districtData: CreateDistrictDto = req.body;
  await districtsService.createDistrict(districtData);
  res
    .status(StatusCodes.CREATED)
    .json({ success: true, message: 'District created successfully' });
}

export async function getDistricts(_req: Request, res: Response) {
  const districts = await districtsService.getDistricts();
  res.status(StatusCodes.OK).json({ success: true, data: districts });
}
