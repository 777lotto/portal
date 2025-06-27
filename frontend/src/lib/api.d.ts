export declare const login: (identifier: string, password: string, turnstileToken: string) => Promise<AuthResponse>;
export declare const signup: (email: string, name: string, password: string, phone: string, turnstileToken: string) => Promise<AuthResponse>;
export declare const requestPasswordReset: (email: string, turnstileToken: string) => Promise<{
    message: string;
}>;
export declare const getProfile: (token: string) => Promise<{
    id: string;
    email: string;
    name: string;
    phone: string | null;
}>;
export declare const getServices: (token: string) => Promise<{
    id: string;
    name: string;
    description: string;
    price: number;
    duration: number;
}[]>;
export declare const getService: (id: number | string, token: string) => Promise<{
    id: string;
    name: string;
    description: string;
    price: number;
    duration: number;
}>;
export declare const createInvoice: (serviceId: number | string, token: string) => Promise<{
    hosted_invoice_url: string;
}>;
export declare const getJobs: (token: string) => Promise<{
    id: string;
    name: string;
    date: string;
    client_id: string;
    service_id: string;
}[]>;
export declare const getJob: (id: string, token: string) => Promise<{
    id: string;
    name: string;
    date: string;
    client_id: string;
    service_id: string;
}>;
export declare const getCalendarFeed: (token: string) => string;
export declare const syncCalendar: (calendarUrl: string, token: string) => Promise<unknown>;
export declare const openPortal: (token: string) => Promise<PortalSession>;
export declare const getSmsConversations: (token: string) => Promise<Conversation[]>;
export declare const getSmsConversation: (phoneNumber: string, token: string) => Promise<SMSMessage[]>;
export declare const sendSms: (to: string, message: string, token: string) => Promise<SMSMessage>;
