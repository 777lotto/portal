// frontend/src/lib/api.ts - CORRECTED
// All API helper functions are now correctly defined and EXPORTED.

import {
  type Job,
  type Service,
  type User,
  type AuthResponse, // Now correctly imported
  type PortalSession,  // Now correctly imported
  type Conversation,   // Now correctly imported
  type SMSMessage,     // Now correctly imported
  type Photo,
  type Note
} from "@portal/shared";
import { fetchJson } from './fetchJson';

// --- API HELPER FUNCTIONS ---

// FIX: 'const' was preventing export. Changed to 'export const'.
export const apiGet = <T>(path: string, token: string): Promise<T> => {
  return fetchJson<T>(`/api${path}`, token);
};

// FIX: 'const' was preventing export. Changed to 'export const'.
export const apiPost = <T>(path: string, body: unknown, token: string, method: "POST" | "PUT" = "POST"): Promise<T> => {
  return fetchJson<T>(`/api${path}`, token, {
    method: method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
};

// FIX: Added the missing apiPostFormData function.
export const apiPostFormData = <T>(path: string, formData: FormData, token: string): Promise<T> => {
  return fetchJson<T>(`/api${path}`, token, {
    method: 'POST',
    body: formData, // No Content-Type header needed; browser sets it with boundary.
  });
};

// --- AUTH ---
export const login = (data: unknown) => apiPost<AuthResponse>('/login', data, '');
export const signup = (data: unknown) => apiPost<AuthResponse>('/signup', data, '');

// --- USER & PROFILE ---
export const getProfile = (token: string) => apiGet<User>('/profile', token);
export const updateProfile = (data: Partial<User>, token: string) => apiPost<User>('/profile', data, token, 'PUT');
export const createPortalSession = (token: string) => apiPost<PortalSession>('/portal', {}, token);

// --- SERVICES ---
export const getServices = (token: string) => apiGet<Service[]>('/services', token);
// FIX: Added missing getService function that was being called in ServiceDetail.
export const getService = (id: string, token: string) => apiGet<Service>(`/services/${id}`, token);
export const createInvoice = (serviceId: string, token: string) => apiPost<any>(`/services/${serviceId}/invoice`, {}, token);

// --- JOBS ---
export const getJobs = (token: string) => apiGet<Job[]>('/jobs', token);
export const getJob = (id: string, token: string) => apiGet<Job>(`/jobs/${id}`, token);

// --- PHOTOS & NOTES (can belong to jobs or services) ---
export const getPhotosForJob = (jobId: string, token: string) => apiGet<Photo[]>(`/jobs/${jobId}/photos`, token);
export const getNotesForJob = (jobId: string, token: string) => apiGet<Note[]>(`/jobs/${jobId}/notes`, token);

// --- SMS ---
export const getSmsConversations = (token:string) => apiGet<Conversation[]>('/sms/conversations', token);
export const getSmsConversation = (phoneNumber: string, token:string) => apiGet<SMSMessage[]>(`/sms/conversation/${phoneNumber}`, token);

