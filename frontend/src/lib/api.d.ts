export declare const login: (identifier: string, password: string, turnstileToken: string) => Promise<{
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
export declare const signup: (email: string, name: string, password: string, phone: string, turnstileToken: string) => Promise<{
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
export declare const requestPasswordReset: (email: string, turnstileToken: string) => Promise<{
    message: string;
}>;
export declare const getProfile: (token: string) => Promise<{
    id: number;
    email: string;
    name: string;
    phone: string | null;
    role: "customer" | "admin";
    stripe_customer_id?: string | null | undefined;
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
export declare const getService: (id: number | string, token: string) => Promise<{
    id: number;
    status: string;
    user_id: number;
    service_date: string;
    notes?: string | null | undefined;
    price_cents?: number | null | undefined;
    stripe_invoice_id?: string | null | undefined;
}>;
export declare const createInvoice: (serviceId: number | string, token: string) => Promise<{
    hosted_invoice_url: string;
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
export declare const getCalendarFeed: (token: string) => string;
export declare const syncCalendar: (calendarUrl: string, token: string) => Promise<unknown>;
export declare const openPortal: (token: string) => Promise<{
    url: string;
}>;
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
}[]>;
export declare const sendSms: (to: string, message: string, token: string) => Promise<{
    message: string;
    created_at: string;
    direction: "incoming" | "outgoing";
    id?: number | undefined;
}>;
