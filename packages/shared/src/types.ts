import { z } from 'zod';

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  phone: z.string().nullable(),
});

export const ServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  price: z.number(),
  duration: z.number(),
});

export const JobSchema = z.object({
  id: z.string(),
  name: z.string(),
  date: z.string(),
  client_id: z.string(),
  service_id: z.string(),
});

export const NoteSchema = z.object({
  id: z.string(),
  job_id: z.string(),
  user_id: z.string(),
  content: z.string(),
  created_at: z.string(),
});

export const SessionSchema = z.object({
  user: UserSchema.extend({
    role: z.enum(['admin', 'user']),
  }),
  expires: z.string(),
});

export const PhotoSchema = z.object({
  id: z.string(),
  job_id: z.string(),
  url: z.string(),
  created_at: z.string(),
});

export const SignupSchema = UserSchema.extend({
  password: z.string().min(8),
  'cf-turnstile-response': z.string(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const ProfileSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().nullable(),
});

export type User = z.infer<typeof UserSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type Job = z.infer<typeof JobSchema>;
export type Note = z.infer<typeof NoteSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type Photo = z.infer<typeof PhotoSchema>;

// FIX: Add the missing Zod schemas that the worker packages depend on.
export const SendReminderSchema = z.object({
  jobId: z.string(),
});

export const WelcomeSchema = z.object({
  to: z.string().email(),
  name: z.string(),
});
