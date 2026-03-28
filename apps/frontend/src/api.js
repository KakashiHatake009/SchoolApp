import { getToken } from './auth.js';

const BASE = '/api';

async function request(path, { method = 'GET', body, token } = {}) {
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(BASE + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `${res.status} ${res.statusText}`);
    }
    if (res.status === 204) return null;
    return res.json();
}

async function blobRequest(path) {
    const res = await fetch(BASE + path, {
        headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.blob();
}

// ── Admin API (uses stored JWT) ──────────────────────────────────────────────

function adminRequest(path, opts = {}) {
    return request(path, { ...opts, token: getToken() });
}

// ── Admin API ────────────────────────────────────────────────────────────────

export const adminApi = {
    // Schools
    getSchools: () => adminRequest('/schools'),
    createSchool: (data) => adminRequest('/schools', { method: 'POST', body: data }),
    updateSchool: (id, data) => adminRequest(`/schools/${id}`, { method: 'PATCH', body: data }),
    deleteSchool: (id) => adminRequest(`/schools/${id}`, { method: 'DELETE' }),

    // Teachers
    getTeachers: () => adminRequest('/teachers'),
    createTeacher: (data) => adminRequest('/teachers', { method: 'POST', body: data }),
    deleteTeacher: (id) => adminRequest(`/teachers/${id}`, { method: 'DELETE' }),

    // Events
    getEvents: () => adminRequest('/events'),
    getEvent: (id) => adminRequest(`/events/${id}`),
    createEvent: (data) => adminRequest('/events', { method: 'POST', body: data }),
    updateEvent: (id, data) => adminRequest(`/events/${id}`, { method: 'PATCH', body: data }),
    deleteEvent: (id) => adminRequest(`/events/${id}`, { method: 'DELETE' }),

    // Slots
    getSlots: (eventId) => adminRequest(`/events/${eventId}/slots`),
    createSlots: (eventId, data) => adminRequest(`/events/${eventId}/slots`, { method: 'POST', body: data }),
    deleteSlot: (slotId) => adminRequest(`/slots/${slotId}`, { method: 'DELETE' }),

    // QR (returns blob)
    getQrBlob: (eventId) => blobRequest(`/events/${eventId}/qr`),

    // Bookings
    getBookings: (eventId) =>
        adminRequest('/bookings' + (eventId ? `?eventId=${eventId}` : '')),
};

// ── Public API (no auth) ─────────────────────────────────────────────────────

export const publicApi = {
    getEventByQr: (qrToken) => request(`/public/events/by-qr/${qrToken}`),
    getSlotsByQr: (qrToken) => request(`/public/events/by-qr/${qrToken}/slots`),
    sendOtp: (data) => request('/otp/send', { method: 'POST', body: data }),
    verifyOtp: (data) => request('/otp/verify', { method: 'POST', body: data }),
    getBooking: (cancelToken) => request(`/bookings/${cancelToken}`),
    cancelBooking: (cancelToken) => request(`/bookings/${cancelToken}`, { method: 'DELETE' }),
    createBooking: (data, parentToken) =>
        request('/bookings', { method: 'POST', body: data, token: parentToken }),
};
