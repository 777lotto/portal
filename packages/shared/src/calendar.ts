import { z } from 'zod';

export const JobRecurrenceEnum = z.enum(['none', 'weekly', 'monthly', 'quarterly', 'custom']);

export const JobSchema = z.object({
  id: z.string().uuid(),
  customerId: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  start: z.string(), // ISO datetime (UTC)
  end: z.string(),
  recurrence: JobRecurrenceEnum,
  rrule: z.string().optional(),
  status: z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']).default('scheduled'),
  crewId: z.string().uuid().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type Job = z.infer<typeof JobSchema>;
