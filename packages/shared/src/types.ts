// packages/shared/src/types.ts

import type { D1Database, KVNamespace, Fetcher, Queue, DurableObjectNamespace } from '@cloudflare/workers-types';
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

// Defines a line item record, matching the database schema.
export const LineItemSchema = z.object({
  id: z.number(),
  job_id: z.string(),
  description: z.string(),
  quantity: z.number(),
  unit_total_amount_cents: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type LineItem = z.infer<typeof LineItemSchema>;

// Define the new, stricter set of statuses for a Job
export const JobStatusEnum = z.enum([
  'pending',
  'upcoming',
  'payment_needed',
  'payment_overdue',
  'complete',
  'canceled',
  'quote_draft',
  'invoice_draft',
  'job_draft'
]);
export type JobStatus = z.infer<typeof JobStatusEnum>;

// This resolves the majority of the frontend errors.
export const JobSchema = z.object({
  id: z.string(), // TEXT (UUID)
  user_id: z.string(), // TEXT (Corresponds to users.auth_user_id)
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  recurrence: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  stripe_invoice_id: z.string().nullable(),
  stripe_quote_id: z.string().nullable(),
  total_amount_cents: z.number().int().nullable(),
  due: z.string().nullable(),
});
export type Job = z.infer<typeof JobSchema>;


// --- REFACTORED: Stricter validation for creating jobs ---
export const CreateJobPayloadSchema = z.object({
  user_id: z.string().min(1, { message: "User ID is required" }),
  title: z.string().min(1, { message: "Title cannot be empty" }),
  description: z.string().optional(),
  lineItems: z.array(z.object({
    description: z.string().min(1, { message: "Line item description cannot be empty" }),
    unit_total_amount_cents: z.number().int({ message: "Amount must be a valid number" }),
    quantity: z.number().int().default(1),
  })).min(1, { message: "At least one line item is required" }),
  jobType: z.enum(['quote', 'job', 'invoice']),
  recurrence: z.string().optional(),
  due: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
});

export const JobRecurrenceRequestSchema = z.object({
    id: z.number(),
    job_id: z.string(),
    user_id: z.number(),
    frequency: z.number(),
    requested_day: z.number().optional(),
    status: z.enum(['pending', 'accepted', 'declined', 'countered']),
    createdAt: z.string(),
    updatedAt: z.string(),
});
export type JobRecurrenceRequest = z.infer<typeof JobRecurrenceRequestSchema>;

export interface JobWithDetails extends Job {
  line_items: LineItem[];
  customerName: string;
  customerAddress: string;
  recurrence_requests?: {
    id: number;
    status: string;
    frequency: string;
    start_date: string;
  }[];
}

// --- REFACTORED: Stricter validation for public bookings ---
export const PublicBookingRequestSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  phone: z.string().min(10, { message: "Please enter a valid phone number" }),
  address: z.string().min(5, { message: "Please enter a valid address" }),
  date: z.string(),
  lineItems: z.array(z.object({
      description: z.string().min(1, { message: "Service description cannot be empty" }),
      duration: z.number().optional().default(1)
  })).min(1, { message: "Please select at least one service" }),
});
export type PublicBookingRequest = z.infer<typeof PublicBookingRequestSchema>;

// Defines a photo, associated with a job or line item service.
export const PhotoSchema = z.object({
    id: z.string(),
    url: z.string().url(),
    createdAt: z.string(),
    job_id: z.string().optional().nullable(),
});
export type Photo = z.infer<typeof PhotoSchema>;

// Defines a note.
export const NoteSchema = z.object({
    id: z.number(),
    content: z.string(),
    createdAt: z.string(),
});
export type Note = z.infer<typeof NoteSchema>;

// --- ADDED: Schema for creating a new note ---
export const CreateNoteSchema = z.object({
  content: z.string().min(1, { message: "Note content cannot be empty" }),
});

// A photo with its notes included
export const PhotoWithNotesSchema = PhotoSchema.extend({
  notes: z.array(NoteSchema),
});
export type PhotoWithNotes = z.infer<typeof PhotoWithNotesSchema>;

// Renamed from BlockedDateSchema
 export const CalendarEventSchema = z.object({
  id: z.number(),
  title: z.string(),
  start: z.string(),
  end: z.string(),
  type: z.enum(['job', 'blocked', 'personal']),
  job_id: z.string().optional().nullable(),
  user_id: z.number().optional().nullable(),
  createdAt: z.string(),
});
 export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

 // --- REFACTORED: Stricter validation for creating users ---
 // This schema now ensures that either an email or a phone number is provided.
 export const AdminCreateUserSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }).optional(),
  company_name: z.string().optional(),
  email: z.string().email({ message: "Invalid email format" }).optional(),
  phone: z.string().min(10, { message: "Phone number seems too short" }).optional(),
  address: z.string().optional(),
  role: z.enum(['customer', 'admin', 'associate', 'guest']).default('customer'),
}).refine(data => data.email || data.phone, {
  message: "An email or a phone number is required to create a user.",
  // This error will be associated with the 'email' field in forms.
  path: ["email"],
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
    status: z.enum(['draft', 'open', 'paid', 'uncollectible', 'void']).nullable(),
    total: z.number(),
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
    user_id: z.number().optional(),
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
    createdAt: z.string(),
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
  user_id: z.union([z.string(), z.number()]),
  data: z.record(z.string(), z.any()),
  channels: z.array(z.enum(['email', 'sms', 'push'])).optional()
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

export interface Env {
  // Bindings
  DB: D1Database;
  NOTIFICATION_SERVICE: Fetcher;
  NOTIFICATION_QUEUE: Queue;
  TEMP_STORAGE: KVNamespace;
  CUSTOMER_SUPPORT_CHAT: DurableObjectNamespace;

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
  createdAt: z.string(),
});
export type UINotification = z.infer<typeof UINotificationSchema>;

/* ========================================================================
                            CHAT-SPECIFIC MODELS
   ======================================================================== */

export const ChatMessageSchema = z.object({
  id: z.string(),
  content: z.string(),
  user: z.string(),
  role: z.enum(['user', 'assistant', 'system']),
  timestamp: z.number().optional(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
