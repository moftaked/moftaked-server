import { z } from 'zod/v4';

export const patchAttendanceSchema = z.object({
  attended: z.array(z.number()).optional(),
  absent: z.array(z.number()).optional(),
  type: z.enum(['student', 'teacher']),
  reasons: z.record(z.number(), z.string()).optional(),
});

export type PatchAttendanceDto = z.infer<typeof patchAttendanceSchema>;
