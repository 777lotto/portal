import { type User } from "@portal/shared";
export declare const apiGet: <T>(path: string, token: string) => Promise<T>;
export declare const apiPost: <T>(path: string, body: unknown, token: string, method?: "POST" | "PUT") => Promise<T>;
export declare const apiPostFormData: <T>(path: string, formData: FormData, token: string) => Promise<T>;
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
export declare const getProfile: (token: string) => Promise<{
    id: number;
    email: string;
    name: string;
    phone: string | null;
    role: "customer" | "admin";
    stripe_customer_id?: string | null | undefined;
}>;
export declare const updateProfile: (data: Partial<User>, token: string) => Promise<{
    id: number;
    email: string;
    name: string;
    phone: string | null;
    role: "customer" | "admin";
    stripe_customer_id?: string | null | undefined;
}>;
export declare const createPortalSession: (token: string) => Promise<{
    url: string;
}>;
export declare const getServices: (token: string) => Promise<{
    id: number;
    status: string;
    user_id: number;
    service_date: string;
    notes?: string | null | undefined;
    price_cents?: number | null | undefined;
    stripe_invoice_id?: string | null | undefined;
}[]>;
export declare const getService: (id: string, token: string) => Promise<{
    id: number;
    status: string;
    user_id: number;
    service_date: string;
    notes?: string | null | undefined;
    price_cents?: number | null | undefined;
    stripe_invoice_id?: string | null | undefined;
}>;
export declare const createInvoice: (serviceId: string, token: string) => Promise<any>;
export declare const getJobs: (token: string) => Promise<{
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
export declare const getJob: (id: string, token: string) => Promise<{
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
export declare const getPhotosForJob: (jobId: string, token: string) => Promise<{
    id: string;
    url: string;
    created_at: string;
}[]>;
export declare const getNotesForJob: (jobId: string, token: string) => Promise<{
    id: number;
    created_at: string;
    content: string;
}[]>;
export declare const getSmsConversations: (token: string) => Promise<{
    phone_number: string;
    last_message_at: string;
    message_count: number;
}[]>;
export declare const getSmsConversation: (phoneNumber: string, token: string) => Promise<{
    message: string;
    created_at: string;
    direction: "incoming" | "outgoing";
    id?: number | undefined;
    status?: "pending" | "delivered" | "failed" | undefined;
    message_sid?: string | null | undefined;
}[]>;
