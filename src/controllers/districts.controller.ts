import { StatusCodes } from 'http-status-codes';
import { Request, Response, NextFunction } from 'express';
import { CreateDistrictDto } from '../schemas/districts.schemas';
import districtsService from '../services/districts.service';
import createHttpError from 'http-errors';

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

export async function deleteDistrict(req: Request, res: Response, next: NextFunction) {
  const districtId = parseInt(req.params['districtId']!, 10);
  if (isNaN(districtId)) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Invalid district ID',
    });
    return;
  }

  try {
    await districtsService.deleteDistrict(districtId);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'District deleted successfully',
    });
  } catch {
    next(createHttpError(StatusCodes.INTERNAL_SERVER_ERROR, 'Error deleting district'));
  }
}
