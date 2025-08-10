import { z } from 'zod/v4';

export const createDistrictSchema = z.object({
  name: z
    .string()
    .min(2)
    .max(50),
});

export type CreateDistrictDto = z.infer<typeof createDistrictSchema>;
