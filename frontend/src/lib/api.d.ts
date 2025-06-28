import { type User } from "@portal/shared";
export declare const apiGet: <T>(path: string) => Promise<T>;
export declare const apiPost: <T>(path: string, body: unknown, method?: "POST" | "PUT") => Promise<T>;
export declare const apiPostFormData: <T>(path: string, formData: FormData) => Promise<T>;
export declare const login: (data: unknown) => Promise<{
    token: string;
    user: {
        id: number;
        email: string;
        name: string;
        phone: string | null;
        role: "customer" | "admin";
        stripe_customer_id?: string | null | undefined;
    };
}>;
export declare const signup: (data: unknown) => Promise<{
    token: string;
    user: {
        id: number;
        email: string;
        name: string;
        phone: string | null;
        role: "customer" | "admin";
        stripe_customer_id?: string | null | undefined;
    };
}>;
export declare const getProfile: () => Promise<{
    id: number;
    email: string;
    name: string;
    phone: string | null;
    role: "customer" | "admin";
    stripe_customer_id?: string | null | undefined;
}>;
export declare const updateProfile: (data: Partial<User>) => Promise<{
    id: number;
    email: string;
    name: string;
    phone: string | null;
    role: "customer" | "admin";
    stripe_customer_id?: string | null | undefined;
}>;
export declare const createPortalSession: () => Promise<{
    url: string;
}>;
export declare const getServices: () => Promise<{
    id: number;
    status: string;
    user_id: number;
    service_date: string;
    notes?: string | null | undefined;
    price_cents?: number | null | undefined;
    stripe_invoice_id?: string | null | undefined;
}[]>;
export declare const getService: (id: string) => Promise<{
    id: number;
    status: string;
    user_id: number;
    service_date: string;
    notes?: string | null | undefined;
    price_cents?: number | null | undefined;
    stripe_invoice_id?: string | null | undefined;
}>;
export declare const createInvoice: (serviceId: string) => Promise<any>;
export declare const getJobs: () => Promise<{
    id: string;
    status: string;
    customerId: string;
    title: string;
    start: string;
    end: string;
    description?: string | null | undefined;
    recurrence?: string | null | undefined;
    rrule?: string | null | undefined;
    crewId?: string | null | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
}[]>;
export declare const getJob: (id: string) => Promise<{
    id: string;
    status: string;
    customerId: string;
    title: string;
    start: string;
    end: string;
    description?: string | null | undefined;
    recurrence?: string | null | undefined;
    rrule?: string | null | undefined;
    crewId?: string | null | undefined;
    createdAt?: string | undefined;
    updatedAt?: string | undefined;
}>;
export declare const getPhotosForJob: (jobId: string) => Promise<{
    id: string;
    url: string;
    created_at: string;
}[]>;
export declare const getNotesForJob: (jobId: string) => Promise<{
    id: number;
    created_at: string;
    content: string;
}[]>;
export declare const getSmsConversations: () => Promise<{
    phone_number: string;
    last_message_at: string;
    message_count: number;
}[]>;
export declare const getSmsConversation: (phoneNumber: string) => Promise<{
    message: string;
    created_at: string;
    direction: "incoming" | "outgoing";
    id?: number | undefined;
    status?: "pending" | "delivered" | "failed" | undefined;
    message_sid?: string | null | undefined;
}[]>;
export declare const sendSms: (phoneNumber: string, message: string) => Promise<{
    message: string;
    created_at: string;
    direction: "incoming" | "outgoing";
    id?: number | undefined;
    status?: "pending" | "delivered" | "failed" | undefined;
    message_sid?: string | null | undefined;
}>;
export declare const getCalendarFeed: (token: string) => string;
export declare const syncCalendar: (url: string) => Promise<unknown>;
