import express from 'express';
import {
  isAuthenticated,
  hasRole,
  isEquipmentOrganizer,
  isEquipmentViewer,
  isEquipmentPhotoViewer,
} from '../middleware/authorization.middleware';
import { Roles } from '../enums/roles.enum';
import { validateData } from '../middleware/validation.middleware';
import {
  createEquipmentGroupSchema,
  updateEquipmentGroupSchema,
  addMemberSchema,
  updateMemberSchema,
  createSubgroupSchema,
  updateSubgroupSchema,
  createEquipmentSchema,
  updateEquipmentSchema,
  createAttachmentSchema,
  updateAttachmentSchema,
  updateItemParentSchema,
  setDefaultReviewerSchema,
} from '../schemas/equipment.schemas';
import {
  createGroup,
  getUserGroups,
  updateGroup,
  deleteGroup,
  createSubgroup,
  getSubgroups,
  updateSubgroup,
  deleteSubgroup,
  addMember,
  getMembers,
  updateMember,
  removeMember,
  createItem,
  getItems,
  getItemById,
  updateItem,
  deleteItem,
  uploadItemPhoto,
  serveEquipmentPhoto,
  createAttachment,
  getAttachments,
  updateAttachment,
  updateItemParent,
  setDefaultReviewer,
  getDefaultReviewer,
} from '../controllers/equipment.controller';
import { upload } from '../middleware/image-upload.middleware';
import { photoUploadRateLimiter } from '../middleware/rate-limiting.middleware';

const equipmentRouter = express.Router();

equipmentRouter.use(isAuthenticated());

equipmentRouter.get('/photos/:filename', isEquipmentPhotoViewer(), serveEquipmentPhoto);

// Groups
equipmentRouter.post(
  '/groups',
  hasRole([Roles.admin]),
  validateData(createEquipmentGroupSchema),
  createGroup,
);

equipmentRouter.get('/groups', getUserGroups);

equipmentRouter.put(
  '/groups/:groupId',
  isEquipmentOrganizer(),
  validateData(updateEquipmentGroupSchema),
  updateGroup,
);

equipmentRouter.delete('/groups/:groupId', isEquipmentOrganizer(), deleteGroup);

// Subgroups
equipmentRouter.get(
  '/groups/:groupId/subgroups',
  isEquipmentViewer(),
  getSubgroups,
);

equipmentRouter.post(
  '/groups/:groupId/subgroups',
  isEquipmentOrganizer(),
  validateData(createSubgroupSchema),
  createSubgroup,
);

equipmentRouter.put(
  '/groups/:groupId/subgroups/:subgroupId',
  isEquipmentOrganizer(),
  validateData(updateSubgroupSchema),
  updateSubgroup,
);

equipmentRouter.delete(
  '/groups/:groupId/subgroups/:subgroupId',
  isEquipmentOrganizer(),
  deleteSubgroup,
);

// Members
equipmentRouter.get(
  '/groups/:groupId/members',
  isEquipmentOrganizer(),
  getMembers,
);

equipmentRouter.post(
  '/groups/:groupId/members',
  isEquipmentOrganizer(),
  validateData(addMemberSchema),
  addMember,
);

equipmentRouter.put(
  '/groups/:groupId/members/:memberId',
  isEquipmentOrganizer(),
  validateData(updateMemberSchema),
  updateMember,
);

equipmentRouter.delete(
  '/groups/:groupId/members/:memberId',
  isEquipmentOrganizer(),
  removeMember,
);

// Equipment Items
equipmentRouter.get(
  '/groups/:groupId/items',
  isEquipmentViewer(),
  getItems,
);

equipmentRouter.get(
  '/groups/:groupId/items/:itemId',
  isEquipmentViewer(),
  getItemById,
);

equipmentRouter.post(
  '/groups/:groupId/items',
  isEquipmentOrganizer(),
  validateData(createEquipmentSchema),
  createItem,
);

equipmentRouter.put(
  '/groups/:groupId/items/:itemId',
  isEquipmentOrganizer(),
  validateData(updateEquipmentSchema),
  updateItem,
);

equipmentRouter.delete(
  '/groups/:groupId/items/:itemId',
  isEquipmentOrganizer(),
  deleteItem,
);

equipmentRouter.post(
  '/groups/:groupId/items/:itemId/photo',
  isEquipmentOrganizer(),
  photoUploadRateLimiter,
  upload.single('photo'),
  uploadItemPhoto,
);

// Attachments
equipmentRouter.get(
  '/groups/:groupId/items/:itemId/attachments',
  isEquipmentViewer(),
  getAttachments,
);

equipmentRouter.post(
  '/groups/:groupId/items/:itemId/attachments',
  isEquipmentOrganizer(),
  validateData(createAttachmentSchema),
  createAttachment,
);

equipmentRouter.put(
  '/groups/:groupId/items/:itemId/attachments/:attachmentId',
  isEquipmentOrganizer(),
  validateData(updateAttachmentSchema),
  updateAttachment,
);

// Assign/Unassign parent
equipmentRouter.patch(
  '/groups/:groupId/items/:itemId/parent',
  isEquipmentOrganizer(),
  validateData(updateItemParentSchema),
  updateItemParent,
);

// Default Reviewer
equipmentRouter.get(
  '/groups/:groupId/default-reviewer',
  isEquipmentOrganizer(),
  getDefaultReviewer,
);

equipmentRouter.put(
  '/groups/:groupId/default-reviewer',
  isEquipmentOrganizer(),
  validateData(setDefaultReviewerSchema),
  setDefaultReviewer,
);

export { equipmentRouter };
