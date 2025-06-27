// frontend/src/lib/api.ts - CORRECTED
// All API helper functions are now correctly defined and EXPORTED.
import { fetchJson } from './fetchJson';
// --- API HELPER FUNCTIONS ---
// FIX: 'const' was preventing export. Changed to 'export const'.
export const apiGet = (path, token) => {
    return fetchJson(`/api${path}`, token);
};
// FIX: 'const' was preventing export. Changed to 'export const'.
export const apiPost = (path, body, token, method = "POST") => {
    return fetchJson(`/api${path}`, token, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
};
// FIX: Added the missing apiPostFormData function.
export const apiPostFormData = (path, formData, token) => {
    return fetchJson(`/api${path}`, token, {
        method: 'POST',
        body: formData, // No Content-Type header needed; browser sets it with boundary.
    });
};
// --- AUTH ---
export const login = (data) => apiPost('/login', data, '');
export const signup = (data) => apiPost('/signup', data, '');
// --- USER & PROFILE ---
export const getProfile = (token) => apiGet('/profile', token);
export const updateProfile = (data, token) => apiPost('/profile', data, token, 'PUT');
export const createPortalSession = (token) => apiPost('/portal', {}, token);
// --- SERVICES ---
export const getServices = (token) => apiGet('/services', token);
// FIX: Added missing getService function that was being called in ServiceDetail.
export const getService = (id, token) => apiGet(`/services/${id}`, token);
export const createInvoice = (serviceId, token) => apiPost(`/services/${serviceId}/invoice`, {}, token);
// --- JOBS ---
export const getJobs = (token) => apiGet('/jobs', token);
export const getJob = (id, token) => apiGet(`/jobs/${id}`, token);
// --- PHOTOS & NOTES (can belong to jobs or services) ---
export const getPhotosForJob = (jobId, token) => apiGet(`/jobs/${jobId}/photos`, token);
export const getNotesForJob = (jobId, token) => apiGet(`/jobs/${jobId}/notes`, token);
// --- SMS ---
export const getSmsConversations = (token) => apiGet('/sms/conversations', token);
export const getSmsConversation = (phoneNumber, token) => apiGet(`/sms/conversation/${phoneNumber}`, token);
