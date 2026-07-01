import { z } from 'zod/v4';

export const createEquipmentGroupSchema = z.object({
  group_name: z.string().min(1).max(255),
});

export const updateEquipmentGroupSchema = z.object({
  group_name: z.string().min(1).max(255).optional(),
});

export const addMemberSchema = z.object({
  account_id: z.number().int().positive(),
  access_level: z.enum(['organizer', 'viewer']),
});

export const updateMemberSchema = z.object({
  access_level: z.enum(['organizer', 'viewer']),
});

export const createSubgroupSchema = z.object({
  name: z.string().min(1).max(255),
});

export const updateSubgroupSchema = z.object({
  name: z.string().min(1).max(255),
});

export const createEquipmentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  subgroup_id: z.number().int().positive().optional().nullable(),
});

export const updateEquipmentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  quantity: z.number().int().positive().optional(),
  subgroup_id: z.number().int().positive().optional().nullable(),
});

export type CreateEquipmentGroupDto = z.infer<typeof createEquipmentGroupSchema>;
export type UpdateEquipmentGroupDto = z.infer<typeof updateEquipmentGroupSchema>;
export type AddMemberDto = z.infer<typeof addMemberSchema>;
export type UpdateMemberDto = z.infer<typeof updateMemberSchema>;
export type CreateSubgroupDto = z.infer<typeof createSubgroupSchema>;
export type UpdateSubgroupDto = z.infer<typeof updateSubgroupSchema>;
export type CreateEquipmentDto = z.infer<typeof createEquipmentSchema>;
export type UpdateEquipmentDto = z.infer<typeof updateEquipmentSchema>;
