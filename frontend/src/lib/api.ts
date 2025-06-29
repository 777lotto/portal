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
import { fetchJson } from './fetchJson';

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

// --- AUTH ---
export const login = (data: unknown) => apiPost<AuthResponse>('/login', data);
export const signup = (data: unknown) => apiPost<AuthResponse>('/signup', data);
export const logout = () => apiPost('/logout', {});

// --- USER & PROFILE ---
export const getProfile = () => apiGet<User>('/profile');
export const updateProfile = (data: Partial<User>) => apiPost<User>('/profile', data, 'PUT');
export const createPortalSession = () => apiPost<PortalSession>('/portal', {});

// --- SERVICES ---
export const getServices = () => apiGet<Service[]>('/services');
export const getService = (id: string) => apiGet<Service>(`/services/${id}`);
export const createInvoice = (serviceId: string) => apiPost<any>(`/services/${serviceId}/invoice`, {});

// --- JOBS ---
export const getJobs = () => apiGet<Job[]>('/jobs');
export const getJob = (id: string) => apiGet<Job>(`/jobs/${id}`);

// --- PHOTOS & NOTES (can belong to jobs or services) ---
export const getPhotosForJob = (jobId: string) => apiGet<Photo[]>(`/jobs/${jobId}/photos`);
export const getNotesForJob = (jobId: string) => apiGet<Note[]>(`/jobs/${jobId}/notes`);

// --- SMS ---
export const getSmsConversations = () => apiGet<Conversation[]>('/sms/conversations');
export const getSmsConversation = (phoneNumber: string) => apiGet<SMSMessage[]>(`/sms/conversation/${phoneNumber}`);
export const sendSms = (phoneNumber: string, message: string) => apiPost<SMSMessage>('/sms/send', { to: phoneNumber, message });

// --- CALENDAR ---
export const getCalendarFeed = (token: string) => `/api/calendar.ics?token=${token}`;
export const syncCalendar = (url: string) => apiPost('/calendar-sync', { url });
