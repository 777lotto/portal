// packages/shared/src/types.ts

import type { D1Database, KVNamespace, Fetcher } from '@cloudflare/workers-types';
import { z } from 'zod';

/* ========================================================================
                            DATABASE & CORE MODELS
   ======================================================================== */

// Defines the structure for a user, aligning with the database and JWT payload.
export const UserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  name: z.string(),
  phone: z.string().nullable(),
  role: z.enum(['customer', 'admin', 'guest', 'associate']),
  stripe_customer_id: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  company_name: z.string().optional().nullable(),
  email_notifications_enabled: z.boolean().default(true).optional(),
  sms_notifications_enabled: z.boolean().default(true).optional(),
  preferred_contact_method: z.enum(['email', 'sms']).default('email').optional(),
  calendar_reminders_enabled: z.boolean().default(true).optional(),
  calendar_reminder_minutes: z.number().default(60).optional(),
});
export type User = z.infer<typeof UserSchema>;

// Defines a service record, matching the database schema.
export const ServiceSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  service_date: z.string(),
  status: z.string(),
  notes: z.string().optional().nullable(),
  price_cents: z.number().optional().nullable(),
  job_id: z.string().optional().nullable(),
});
export type Service = z.infer<typeof ServiceSchema>;

// Define the new, stricter set of statuses for a Job
export const JobStatusEnum = z.enum([
  'upcoming',
  'confirmed',
  'completed',
  'payment_pending',
  'past_due',
  'cancelled',
  'pending_confirmation',
  'pending_quote',
  'quote_accepted',
  'paid'
]);
export type JobStatus = z.infer<typeof JobStatusEnum>;

// This resolves the majority of the frontend errors.
export const JobSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  title: z.string(),
  description: z.string().optional().nullable(),
  start: z.string(), // ISO date string
  end: z.string(),   // ISO date string
  status: JobStatusEnum, // Use the new enum
  recurrence: z.string().optional().nullable(),
  rrule: z.string().optional().nullable(),
  crewId: z.string().optional().nullable(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  stripe_invoice_id: z.string().optional().nullable(),
  stripe_quote_id: z.string().optional().nullable(),
  invoice_created_at: z.string().optional().nullable(),
  total_amount_cents: z.number().optional().nullable(), // New field
  due_date: z.string().optional().nullable(),
  expires_at: z.string().optional().nullable(),
  contact_method_override: z.enum(['email', 'sms', 'push']).optional().nullable(),
});
export type Job = z.infer<typeof JobSchema>;

export const JobWithDetailsSchema = JobSchema.extend({
  customerName: z.string().nullable(),
  customerAddress: z.string().nullable(),
  services: z.array(ServiceSchema),
});
export type JobWithDetails = z.infer<typeof JobWithDetailsSchema>;

// ADD NEW SCHEMA for public booking requests
export const PublicBookingRequestSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10),
  address: z.string().min(5),
  date: z.string(),
  services: z.array(z.object({
    name: z.string(),
    duration: z.number(),
  })).min(1),
  'cf-turnstile-response': z.string(),
});
export type PublicBookingRequest = z.infer<typeof PublicBookingRequestSchema>;

// Defines a photo, associated with a job or service.
export const PhotoSchema = z.object({
    id: z.string(),
    url: z.string().url(),
    created_at: z.string(),
    job_id: z.string().optional().nullable(),
    service_id: z.number().optional().nullable(),
    invoice_id: z.string().optional().nullable(),
});
export type Photo = z.infer<typeof PhotoSchema>;

// Defines a note.
export const NoteSchema = z.object({
    id: z.number(),
    content: z.string(),
    created_at: z.string(), // ISO date string
});
export type Note = z.infer<typeof NoteSchema>;

// A photo with its notes included
export const PhotoWithNotesSchema = PhotoSchema.extend({
  notes: z.array(NoteSchema),
});
export type PhotoWithNotes = z.infer<typeof PhotoWithNotesSchema>;

// ADD NEW SCHEMA for blocked dates
 export const BlockedDateSchema = z.object({
   date: z.string(), // YYYY-MM-DD
   reason: z.string().optional().nullable(),
   created_at: z.string().optional(),
   user_id: z.number().optional(),
 });
 export type BlockedDate = z.infer<typeof BlockedDateSchema>;

 export const AdminCreateUserSchema = z.object({
  name: z.string().optional(),
  company_name: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  role: z.enum(['customer', 'admin', 'associate', 'guest']).default('customer'),
});
export type AdminCreateUser = z.infer<typeof AdminCreateUserSchema>;

 /* ========================================================================
                              STRIPE-SPECIFIC MODELS
   ======================================================================== */

export const StripeInvoiceItemSchema = z.object({
  id: z.string(),
  object: z.literal('line_item'),
  amount: z.number(), // in cents
  currency: z.string(),
  description: z.string().nullable(),
  quantity: z.number().nullable(),
});
export type StripeInvoiceItem = z.infer<typeof StripeInvoiceItemSchema>;

export const StripeInvoiceSchema = z.object({
    id: z.string(),
    object: z.literal('invoice'),
    customer: z.string(),
    status: z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']),
    total: z.number(), // in cents
    hosted_invoice_url: z.string().nullable(),
    lines: z.object({
        object: z.literal('list'),
        data: z.array(StripeInvoiceItemSchema),
    }).optional(),
    number: z.string().nullable(),
    due_date: z.number().nullable(),
});
export type StripeInvoice = z.infer<typeof StripeInvoiceSchema>;

export const DashboardInvoiceSchema = StripeInvoiceSchema.extend({
    userId: z.number().optional(),
    customerName: z.string().optional(),
});
export type DashboardInvoice = z.infer<typeof DashboardInvoiceSchema>;

 /* ========================================================================
                            PAYMENT & BILLING
   ======================================================================== */
 export const PaymentMethodSchema = z.object({
  id: z.string(),
  brand: z.string(),
  last4: z.string(),
  exp_month: z.number(),
  exp_year: z.number(),
  is_default: z.boolean(),
 });
 export type PaymentMethod = z.infer<typeof PaymentMethodSchema>;

/* ========================================================================
                        API, AUTH & NOTIFICATION TYPES
   ======================================================================== */

// Exporting AuthResponse for the API client.
export const AuthResponseSchema = z.object({
    token: z.string(),
    user: UserSchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

// Exporting PortalSession for the Stripe portal redirect.
export const PortalSessionSchema = z.object({
    url: z.string().url(),
});
export type PortalSession = z.infer<typeof PortalSessionSchema>;

// Exporting SMSMessage for the SMS components.
export const SMSMessageSchema = z.object({
    id: z.number().optional(),
    direction: z.enum(['incoming', 'outgoing']),
    message: z.string(),
    created_at: z.string(),
    status: z.enum(['pending', 'delivered', 'failed']).optional(),
    message_sid: z.string().optional().nullable(),
});
export type SMSMessage = z.infer<typeof SMSMessageSchema>;

// Exporting Conversation for the SMS conversations list.
export const ConversationSchema = z.object({
    phone_number: z.string(),
    last_message_at: z.string(),
    message_count: z.number(),
});
export type Conversation = z.infer<typeof ConversationSchema>;

// For notification worker queue
export const NotificationRequestSchema = z.object({
  type: z.string(),
  userId: z.union([z.string(), z.number()]),
  data: z.record(z.any()),
  channels: z.array(z.enum(['email', 'sms'])).optional()
});

export const EmailParamsSchema = z.object({
  to: z.string().email(),
  toName: z.string(),
  subject: z.string(),
  html: z.string(),
  text: z.string()
});

// For SMS sending results
export interface SendSMSResult {
  success: boolean;
  error?: string;
  messageSid?: string;
}

export const PushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});
export type PushSubscription = z.infer<typeof PushSubscriptionSchema>;

/* ========================================================================
                    ENVIRONMENT & CLOUDFLARE TYPES
   ======================================================================== */

// Consolidating and exporting all worker environment variables and types.
export interface Env {
  // Bindings
  DB: D1Database;
  NOTIFICATION_SERVICE: Fetcher;
  NOTIFICATION_QUEUE: Queue;
  TEMP_STORAGE: KVNamespace;

  // Secrets
  JWT_SECRET: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  TURNSTILE_SECRET_KEY: string;
  CF_IMAGES_ACCOUNT_HASH: string;
  CF_IMAGES_API_TOKEN: string;
  ZEPTOMAIL_TOKEN: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;

  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URI: string;
  GOOGLE_API_KEY?: string;

  // Variables
  PORTAL_URL: string;
  ENVIRONMENT?: 'development' | 'production';

  // Notification Worker Specific (can be optional in other workers)
  EMAIL_FROM?: string;
  SMS_FROM_NUMBER?: string;
  VOIPMS_USERNAME?: string;
  VOIPMS_PASSWORD?: string;
}


/* ========================================================================
                            UI NOTIFICATIONS
   ======================================================================== */
export const UINotificationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  type: z.string(),
  message: z.string(),
  link: z.string().optional().nullable(),
  is_read: z.number(), // D1 returns 0 or 1
  created_at: z.string(),
});
export type UINotification = z.infer<typeof UINotificationSchema>;
