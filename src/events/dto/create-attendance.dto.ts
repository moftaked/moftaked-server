import { z } from 'zod';

export const createAttendanceSchema = z.object({
  attendance: z.array(z.number().min(0)),
  absence: z.array(z.number()).optional(),
});

export type CreateAttendanceDto = z.infer<typeof createAttendanceSchema>;
