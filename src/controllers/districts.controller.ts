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

export async function mergeDistricts(req: Request, res: Response, next: NextFunction) {
  const sourceId = parseInt(req.params['sourceId']!, 10);
  const targetId = parseInt(req.params['targetId']!, 10);

  if (isNaN(sourceId) || isNaN(targetId)) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Invalid district ID',
    });
    return;
  }

  if (sourceId === targetId) {
    res.status(StatusCodes.BAD_REQUEST).json({
      success: false,
      message: 'Cannot merge a district into itself',
    });
    return;
  }

  try {
    await districtsService.mergeDistricts(sourceId, targetId);
    res.status(StatusCodes.OK).json({
      success: true,
      message: 'Districts merged successfully',
    });
  } catch {
    next(createHttpError(StatusCodes.INTERNAL_SERVER_ERROR, 'Error merging districts'));
  }
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
  } catch (error) {
    if ((error as Error & { statusCode: number }).statusCode === 409) {
      res.status(StatusCodes.CONFLICT).json({
        success: false,
        message: (error as Error).message,
      });
      return;
    }
    next(createHttpError(StatusCodes.INTERNAL_SERVER_ERROR, 'Error deleting district'));
  }
}
