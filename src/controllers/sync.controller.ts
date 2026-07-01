import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import classesService from '../services/classes.service';
import dataVersionsService from '../services/data-versions.service';
import equipmentService from '../services/equipment.service';

export async function getTimestamps(_req: Request, res: Response, _next: NextFunction) {
  const userId: number = res.locals['user']['sub'];
  const schools = await classesService.getUserJoinedSchoolsClasses(userId);
  const classIds = schools.flatMap(school => school.classes.map(c => c.class_id));
  const timestamps = await dataVersionsService.getTimestampsForUser(classIds);

  // Add equipment group timestamps
  const equipmentGroupIds = await equipmentService.getAccessibleGroupIds(userId);
  if (equipmentGroupIds.length > 0) {
    const equipmentKeys = [
      dataVersionsService.EQUIPMENT_GROUPS_KEY,
      ...equipmentGroupIds.map(id => dataVersionsService.equipmentGroupItemsKey(id)),
    ];
    const equipmentTimestamps = await dataVersionsService.getTimestamps(equipmentKeys);
    Object.assign(timestamps, equipmentTimestamps);
  }

  res.status(StatusCodes.OK).json({ success: true, data: timestamps });
}