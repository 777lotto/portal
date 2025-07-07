// frontend/src/lib/api.ts - CORRECTED
import {
  type Job,
  type Service,
  type User,
  type AuthResponse,
  type PortalSession,
  type Conversation,
  type SMSMessage,
  type Photo,
  type Note
} from "@portal/shared";
import { fetchJson } from './fetchJson.js';

// --- API HELPER FUNCTIONS ---

export const apiGet = <T>(path: string): Promise<T> => {
  return fetchJson<T>(path);
};

export const apiPost = <T>(path: string, body: unknown, method: "POST" | "PUT" = "POST"): Promise<T> => {
  return fetchJson<T>(path, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
};

export const apiPostFormData = <T>(path: string, formData: FormData): Promise<T> => {
  return fetchJson<T>(path, {
    method: 'POST',
    body: formData,
  });
};

// --- PUBLIC API (No Auth Required) ---
export const getPublicAvailability = () => apiGet<{ unavailableDays: string[] }>('/api/public/availability');
export const createPublicBooking = (data: unknown) => apiPost('/api/public/booking', data);

// --- AUTH ---
export const login = (data: unknown) => apiPost<AuthResponse>('/api/login', data);
export const signup = (data: unknown) => apiPost<AuthResponse>('/api/signup', data);
export const logout = () => apiPost('/api/logout', {});

// --- USER & PROFILE ---
export const getProfile = () => apiGet<User>('/api/profile');
export const updateProfile = (data: Partial<User>) => apiPost<User>('/api/profile', data, 'PUT');
export const createPortalSession = () => apiPost<PortalSession>('/api/portal', {});

// --- SERVICES ---
export const getServices = () => apiGet<Service[]>('/api/services');
export const getService = (id: string) => apiGet<Service>(`/api/services/${id}`);
export const createInvoice = (serviceId: string) => apiPost<any>(`/api/services/${serviceId}/invoice`, {});

// --- JOBS ---
export const getJobs = () => apiGet<Job[]>('/api/jobs');
export const getJob = (id: string) => apiGet<Job>(`/api/jobs/${id}`);

// --- PHOTOS & NOTES (can belong to jobs or services) ---
export const getPhotosForJob = (jobId: string) => apiGet<Photo[]>(`/api/jobs/${jobId}/photos`);
export const getNotesForJob = (jobId: string) => apiGet<Note[]>(`/api/jobs/${jobId}/notes`);

// --- SMS ---
export const getSmsConversations = () => apiGet<Conversation[]>('/api/sms/conversations');
export const getSmsConversation = (phoneNumber: string) => apiGet<SMSMessage[]>(`/api/sms/conversation/${phoneNumber}`);
export const sendSms = (phoneNumber: string, message: string) => apiPost<SMSMessage>('/api/sms/send', { to: phoneNumber, message });

// --- CALENDAR ---
// REFACTORED: Now fetches the feed securely via an API call
export const getCalendarFeed = () => apiGet<string>('/api/calendar.ics');
export const syncCalendar = (url: string) => apiPost('/api/calendar-sync', { url });
