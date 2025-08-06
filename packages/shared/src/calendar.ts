// packages/shared/src/calendar.ts - CORRECTED
import { z } from 'zod';
import type { User } from './types.js';


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
