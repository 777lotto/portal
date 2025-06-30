import { fetchJson } from './fetchJson';
// --- API HELPER FUNCTIONS ---
export const apiGet = (path) => {
    return fetchJson(path);
};
export const apiPost = (path, body, method = "POST") => {
    return fetchJson(path, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
};
export const apiPostFormData = (path, formData) => {
    return fetchJson(path, {
        method: 'POST',
        body: formData,
    });
};
// --- AUTH ---
export const login = (data) => apiPost('/login', data);
export const signup = (data) => apiPost('/signup', data);
export const logout = () => apiPost('/logout', {});
// --- USER & PROFILE ---
export const getProfile = () => apiGet('/profile');
export const updateProfile = (data) => apiPost('/profile', data, 'PUT');
export const createPortalSession = () => apiPost('/portal', {});
// --- SERVICES ---
export const getServices = () => apiGet('/services');
export const getService = (id) => apiGet(`/services/${id}`);
export const createInvoice = (serviceId) => apiPost(`/services/${serviceId}/invoice`, {});
// --- JOBS ---
export const getJobs = () => apiGet('/jobs');
export const getJob = (id) => apiGet(`/jobs/${id}`);
// --- PHOTOS & NOTES (can belong to jobs or services) ---
export const getPhotosForJob = (jobId) => apiGet(`/jobs/${jobId}/photos`);
export const getNotesForJob = (jobId) => apiGet(`/jobs/${jobId}/notes`);
// --- SMS ---
export const getSmsConversations = () => apiGet('/sms/conversations');
export const getSmsConversation = (phoneNumber) => apiGet(`/sms/conversation/${phoneNumber}`);
export const sendSms = (phoneNumber, message) => apiPost('/sms/send', { to: phoneNumber, message });
// --- CALENDAR ---
export const getCalendarFeed = (token) => `/api/calendar.ics?token=${token}`;
export const syncCalendar = (url) => apiPost('/calendar-sync', { url });
