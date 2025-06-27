import { z } from 'zod';
// FIX: Import Job and JobSchema from the central types file to resolve ambiguity.
import type { User, Job } from './types';
import { JobSchema } from './types';

// REMOVED: The local Job and JobSchema definitions were conflicting with the ones in types.ts.
/*
export const JobSchema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.string(),
  client_id: z.string(),
  service_id: z.string(),
});

export type Job = z.infer<typeof JobSchema>;
*/

export const AppointmentSchema = z.object({
  id: z.string(),
  start_time: z.string(),
  end_time: z.string(),
  user_id: z.string(),
});

export const BookingSchema = z.object({
  start: z.instanceof(Date),
  end: z.instanceof(Date),
  serviceId: z.string(),
  user: z.custom<User>(),
});

export const GoogleEventSchema = z.object({
  summary: z.string(),
  description: z.string(),
  start: z.object({
    dateTime: z.string(),
    timeZone: z.string(),
  }),
  end: z.object({
    dateTime: z.string(),
    timeZone: z.string(),
  }),
  attendees: z.array(z.object({ email: z.string() })),
});

export type GoogleEvent = z.infer<typeof GoogleEventSchema>;
export type Booking = z.infer<typeof BookingSchema>;
export type Appointment = z.infer<typeof AppointmentSchema>;

