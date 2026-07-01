import { NextFunction, Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import createHttpError from 'http-errors';
import { Err } from 'result2';
import path from 'path';
import fs from 'fs';
import equipmentService from '../services/equipment.service';
import {
  CreateEquipmentGroupDto,
  UpdateEquipmentGroupDto,
  AddMemberDto,
  UpdateMemberDto,
  CreateSubgroupDto,
  UpdateSubgroupDto,
  CreateEquipmentDto,
  UpdateEquipmentDto,
} from '../schemas/equipment.schemas';
import {
  processAndSaveImage,
  deleteImageVariants,
  getImageUrl,
  sizedFilename,
  IMAGE_SIZES,
} from '../middleware/image-upload.middleware';
import { authenticatedLocals } from '../middleware/authorization.middleware';

function parseIntParam(val: string | undefined): number | undefined {
  if (val === undefined) return undefined;
  const n = parseInt(val, 10);
  return isNaN(n) ? undefined : n;
}

// ---- Groups ----

export async function createGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const body: CreateEquipmentGroupDto = req.body;
    const userId: number = res.locals['user']['sub'];
    const groupId = await equipmentService.createGroup(body, userId);
    res.status(StatusCodes.CREATED).json({ success: true, data: { group_id: groupId } });
  } catch (error) {
    next(error);
  }
}

export async function getUserGroups(_req: Request, res: Response, next: NextFunction) {
  try {
    const userId: number = res.locals['user']['sub'];
    const groups = await equipmentService.getUserGroups(userId);
    res.status(StatusCodes.OK).json({ success: true, data: groups });
  } catch (error) {
    next(error);
  }
}

export async function updateGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseIntParam(req.params['groupId']);
    if (groupId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid group ID'));

    const body: UpdateEquipmentGroupDto = req.body;
    await equipmentService.updateGroup(groupId, body);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function deleteGroup(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseIntParam(req.params['groupId']);
    if (groupId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid group ID'));

    await equipmentService.deleteGroup(groupId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ---- Subgroups ----

export async function createSubgroup(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseIntParam(req.params['groupId']);
    if (groupId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid group ID'));

    const body: CreateSubgroupDto = req.body;
    const subgroupId = await equipmentService.createSubgroup(groupId, body);
    res.status(StatusCodes.CREATED).json({ success: true, data: { subgroup_id: subgroupId } });
  } catch (error) {
    next(error);
  }
}

export async function getSubgroups(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseIntParam(req.params['groupId']);
    if (groupId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid group ID'));

    const subgroups = await equipmentService.getSubgroups(groupId);
    res.status(StatusCodes.OK).json({ success: true, data: subgroups });
  } catch (error) {
    next(error);
  }
}

export async function updateSubgroup(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseIntParam(req.params['groupId']);
    if (groupId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid group ID'));

    const subgroupId = parseIntParam(req.params['subgroupId']);
    if (subgroupId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid subgroup ID'));

    const body: UpdateSubgroupDto = req.body;
    await equipmentService.updateSubgroup(subgroupId, groupId, body);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function deleteSubgroup(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseIntParam(req.params['groupId']);
    if (groupId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid group ID'));

    const subgroupId = parseIntParam(req.params['subgroupId']);
    if (subgroupId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid subgroup ID'));

    await equipmentService.deleteSubgroup(subgroupId, groupId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ---- Members ----

export async function addMember(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseIntParam(req.params['groupId']);
    if (groupId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid group ID'));

    const body: AddMemberDto = req.body;
    await equipmentService.addMember(groupId, body);
    res.status(StatusCodes.CREATED).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function getMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseIntParam(req.params['groupId']);
    if (groupId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid group ID'));

    const members = await equipmentService.getMembers(groupId);
    res.status(StatusCodes.OK).json({ success: true, data: members });
  } catch (error) {
    next(error);
  }
}

export async function updateMember(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseIntParam(req.params['groupId']);
    if (groupId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid group ID'));

    const memberId = parseIntParam(req.params['memberId']);
    if (memberId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid member ID'));

    const body: UpdateMemberDto = req.body;
    await equipmentService.updateMember(memberId, groupId, body);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseIntParam(req.params['groupId']);
    if (groupId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid group ID'));

    const memberId = parseIntParam(req.params['memberId']);
    if (memberId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid member ID'));

    await equipmentService.removeMember(memberId, groupId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

// ---- Equipment Items ----

export async function createItem(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseIntParam(req.params['groupId']);
    if (groupId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid group ID'));

    const body: CreateEquipmentDto = req.body;
    const equipmentId = await equipmentService.createItem(groupId, body);
    res.status(StatusCodes.CREATED).json({ success: true, data: { equipment_id: equipmentId } });
  } catch (error) {
    next(error);
  }
}

export async function getItems(req: Request, res: Response, next: NextFunction) {
  try {
    const groupId = parseIntParam(req.params['groupId']);
    if (groupId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid group ID'));

    const subgroupId = req.query['subgroupId'] !== undefined ? parseInt(req.query['subgroupId'] as string, 10) : undefined;
    const search = req.query['search'] as string | undefined;

    const items = await equipmentService.getItems(groupId, subgroupId, search);
    res.status(StatusCodes.OK).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
}

export async function getItemById(req: Request, res: Response, next: NextFunction) {
  try {
    const itemId = parseIntParam(req.params['itemId']);
    if (itemId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid item ID'));

    const item = await equipmentService.getItemById(itemId);
    if (!item) return next(createHttpError(StatusCodes.NOT_FOUND, 'Equipment not found'));

    res.status(StatusCodes.OK).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
}

export async function updateItem(req: Request, res: Response, next: NextFunction) {
  try {
    const itemId = parseIntParam(req.params['itemId']);
    if (itemId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid item ID'));

    const body: UpdateEquipmentDto = req.body;
    await equipmentService.updateItem(itemId, body);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function deleteItem(req: Request, res: Response, next: NextFunction) {
  try {
    const itemId = parseIntParam(req.params['itemId']);
    if (itemId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid item ID'));

    await equipmentService.deleteItem(itemId);
    res.status(StatusCodes.OK).json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function uploadItemPhoto(req: Request, res: Response, next: NextFunction) {
  try {
    const itemId = parseIntParam(req.params['itemId']);
    if (itemId === undefined) return next(createHttpError(StatusCodes.BAD_REQUEST, 'Invalid item ID'));

    const item = await equipmentService.getItemById(itemId);
    if (!item) return next(createHttpError(StatusCodes.NOT_FOUND, 'Equipment not found'));

    if (!req.file) return next(createHttpError(StatusCodes.BAD_REQUEST, 'No photo provided'));

    if (item['photo']) {
      deleteImageVariants(item['photo']);
    }

    const baseFilename = await processAndSaveImage(req.file.buffer, 'photo');
    await equipmentService.updateItemPhoto(itemId, baseFilename);

    res.status(StatusCodes.OK).json({
      success: true,
      data: {
        filename: baseFilename,
        photo_urls: {
          sm: `/equipment/photos/${getImageUrl(baseFilename, 'sm')}`,
          md: `/equipment/photos/${getImageUrl(baseFilename, 'md')}`,
          lg: `/equipment/photos/${getImageUrl(baseFilename, 'lg')}`,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function serveEquipmentPhoto(
  req: Request<any, any, any, { size?: string }>,
  res: Response<any, authenticatedLocals>,
  next: NextFunction,
) {
  try {
    const filename = req.params['filename'];
    if (!filename) return next(Err(StatusCodes.BAD_REQUEST));

    const base = filename.replace(/-(sm|md|lg)\.webp$/, '').replace(/\.webp$/, '');
    const matchedSize = filename.match(/-(sm|md|lg)\.webp$/)?.[1];
    const size = (req.query['size'] ?? matchedSize ?? 'md') as keyof typeof IMAGE_SIZES;
    if (!(size in IMAGE_SIZES)) return next(Err(StatusCodes.BAD_REQUEST));

    const sizedFile = sizedFilename(base, size);
    const filePath = path.resolve('uploads', 'images', sizedFile);
    if (!fs.existsSync(filePath)) return next(createHttpError(StatusCodes.NOT_FOUND, 'Photo file not found'));

    res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
}
