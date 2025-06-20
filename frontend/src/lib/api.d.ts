import { Job } from '@portal/shared';
export declare const apiGet: <T>(path: string, token?: string) => Promise<T>;
export declare const apiPost: <T>(path: string, body: unknown, token?: string, method?: "POST" | "PUT" | "DELETE") => Promise<T>;
export declare const checkStripeCustomer: (email: string, phone: string) => Promise<{
    exists: boolean;
    name?: string;
    email?: string;
}>;
export declare const createStripeCustomer: (email: string, name: string, phone: string) => Promise<{
    success: boolean;
    customerId: string;
}>;
export declare const login: (identifier: string, password: string, turnstileToken?: string) => Promise<{
    token: string;
    user: {
        id: number;
        name: string;
        email?: string | undefined;
        phone?: string | undefined;
    };
}>;
export declare const signup: (email: string, name: string, password: string, phone: string) => Promise<{
    token: string;
    user: {
        id: number;
        name: string;
        email?: string | undefined;
        phone?: string | undefined;
    };
}>;
export declare const signupCheck: (email: string, phone: string, turnstileToken?: string) => Promise<{
    status: string;
}>;
export declare const getServices: (token: string) => Promise<{
    id: number;
    status: "in_progress" | "completed" | "cancelled" | "paid" | "upcoming" | "confirmed" | "invoiced";
    user_id: number;
    service_date: string;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    notes?: string | undefined;
    price_cents?: number | undefined;
    stripe_invoice_id?: string | undefined;
}[]>;
export declare const getService: (id: number, token: string) => Promise<{
    id: number;
    status: "in_progress" | "completed" | "cancelled" | "paid" | "upcoming" | "confirmed" | "invoiced";
    user_id: number;
    service_date: string;
    created_at?: string | undefined;
    updated_at?: string | undefined;
    notes?: string | undefined;
    price_cents?: number | undefined;
    stripe_invoice_id?: string | undefined;
}>;
export declare const getJobs: (token: string) => Promise<{
    id: string;
    customerId: string;
    title: string;
    start: string;
    end: string;
    recurrence: "none" | "weekly" | "monthly" | "quarterly" | "custom";
    status: "scheduled" | "in_progress" | "completed" | "cancelled";
    createdAt: string;
    updatedAt: string;
    description?: string | undefined;
    rrule?: string | undefined;
    crewId?: string | undefined;
}[]>;
export declare const getJob: (id: string, token: string) => Promise<{
    id: string;
    customerId: string;
    title: string;
    start: string;
    end: string;
    recurrence: "none" | "weekly" | "monthly" | "quarterly" | "custom";
    status: "scheduled" | "in_progress" | "completed" | "cancelled";
    createdAt: string;
    updatedAt: string;
    description?: string | undefined;
    rrule?: string | undefined;
    crewId?: string | undefined;
}>;
export declare const getProfile: (token: string) => Promise<{
    id: string | number;
    email: string;
    name: string;
    phone?: string | undefined;
    stripe_customer_id?: string | undefined;
    password_hash?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
}>;
export declare const updateProfile: (profileData: Record<string, unknown>, token: string) => Promise<{
    id: string | number;
    email: string;
    name: string;
    phone?: string | undefined;
    stripe_customer_id?: string | undefined;
    password_hash?: string | undefined;
    created_at?: string | undefined;
    updated_at?: string | undefined;
}>;
export declare const requestPasswordReset: (email: string, turnstileToken: string) => Promise<{
    message: string;
}>;
export declare const getInvoice: (_serviceId: number, token: string) => Promise<{
    hosted_invoice_url: string;
}>;
export declare const openPortal: (token: string) => Promise<{
    url: string;
}>;
export declare const getCalendarFeed: (token: string) => string;
export declare const syncCalendar: (calendarUrl: string, token: string) => Promise<unknown>;
export declare const callWorkerService: (serviceName: string, path: string, data?: Record<string, unknown>, token?: string) => Promise<unknown>;
export declare const callNotificationService: (action: string, data: Record<string, unknown>, token: string) => Promise<unknown>;
export declare const callPaymentProcessingService: (action: string, data: Record<string, unknown>, token: string) => Promise<unknown>;
export declare const callSchedulingService: (action: string, data: Record<string, unknown>, token: string) => Promise<unknown>;
export declare const sendEmailNotification: (emailData: {
    to: string;
    subject: string;
    body: string;
    templateId?: string;
}, token: string) => Promise<unknown>;
export declare const sendSmsNotification: (smsData: {
    to: string;
    message: string;
}, token: string) => Promise<unknown>;
export declare const processPayment: (paymentData: {
    amount: number;
    currency: string;
    description: string;
    customerId: string;
}, token: string) => Promise<unknown>;
export declare const refundPayment: (refundData: {
    paymentId: string;
    amount?: number;
}, token: string) => Promise<unknown>;
export declare const checkAvailability: (date: string, token: string) => Promise<unknown>;
export declare const scheduleJob: (jobData: Omit<Job, "id" | "createdAt" | "updatedAt">, token: string) => Promise<unknown>;
export declare const rescheduleJob: (id: string, newDate: string, token: string) => Promise<unknown>;
export declare const getConversations: (token: string) => Promise<{
    phone_number: string;
    last_message_at: string;
    message_count: number;
}[]>;
export declare const getConversation: (phoneNumber: string, token: string) => Promise<{
    id: number;
    status: "pending" | "delivered" | "failed";
    message: string;
    created_at: string;
    user_id: string | number;
    direction: "incoming" | "outgoing";
    phone_number: string;
    message_sid?: string | undefined;
}[]>;
export declare const sendSMS: (to: string, message: string, token: string) => Promise<unknown>;
export declare const sendPaymentReminder: (serviceId: number, token: string) => Promise<unknown>;
export declare const runPaymentReminders: (token: string) => Promise<unknown>;
