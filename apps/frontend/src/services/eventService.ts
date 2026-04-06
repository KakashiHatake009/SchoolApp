import { USE_MOCK } from '@/config'
import { apiClient } from './apiClient'
import { events as mockEvents } from '@/data/mockData'
import type { SchoolEvent, EventDay } from '@/types'

// days input shape (no id/eventId — backend generates those)
type EventDayInput = Pick<EventDay, 'date' | 'startTime' | 'endTime'>

// Payload for event create — overrides days to use input shape
type EventCreateData = Omit<SchoolEvent, 'id' | 'createdAt' | 'qrCode' | 'days'> & { days?: EventDayInput[] }

// Payload for event update — overrides days to use input shape
type EventUpdateData = Omit<Partial<SchoolEvent>, 'days'> & { days?: EventDayInput[] }

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms))
let _events = [...mockEvents]

const mock = {
  getAll: async (): Promise<SchoolEvent[]> => { await delay(); return [..._events] },
  getBySchool: async (schoolId: string): Promise<SchoolEvent[]> => { await delay(); return _events.filter((e) => e.schoolId === schoolId) },
  getById: async (id: string): Promise<SchoolEvent | undefined> => { await delay(); return _events.find((e) => e.id === id) },
  create: async (data: EventCreateData): Promise<SchoolEvent> => {
    await delay()
    const event = { ...data, id: `event-${Date.now()}`, createdAt: new Date().toISOString(), qrCode: `QR_${Date.now()}` } as SchoolEvent
    _events.push(event)
    return event
  },
  update: async (id: string, data: EventUpdateData): Promise<SchoolEvent> => {
    await delay()
    _events = _events.map((e) => (e.id === id ? { ...e, ...data } as SchoolEvent : e))
    return _events.find((e) => e.id === id)!
  },
  delete: async (id: string): Promise<void> => { await delay(); _events = _events.filter((e) => e.id !== id) },
  duplicate: async (id: string, newName: string): Promise<SchoolEvent> => {
    await delay()
    const original = _events.find((e) => e.id === id)
    if (!original) throw new Error('Event not found')
    const copy: SchoolEvent = { ...original, id: `event-${Date.now()}`, name: newName, status: 'draft', createdAt: new Date().toISOString(), qrCode: `QR_${Date.now()}`, duplicatedFrom: id }
    _events.push(copy)
    return copy
  },
  publish: async (id: string): Promise<SchoolEvent> => mock.update(id, { status: 'published' }) as Promise<SchoolEvent>,
  unpublish: async (id: string): Promise<SchoolEvent> => mock.update(id, { status: 'draft' }) as Promise<SchoolEvent>,
}

const api = {
  getAll: () => apiClient.get<SchoolEvent[]>('/events'),
  getBySchool: (schoolId: string) => apiClient.get<SchoolEvent[]>(`/events?schoolId=${schoolId}`),
  getById: (id: string) => apiClient.get<SchoolEvent>(`/events/${id}`),
  create: (data: EventCreateData) => apiClient.post<SchoolEvent>('/events', data),
  update: (id: string, data: EventUpdateData) => apiClient.patch<SchoolEvent>(`/events/${id}`, data),
  delete: (id: string) => apiClient.delete<void>(`/events/${id}`),
  duplicate: (id: string, newName: string) => apiClient.post<SchoolEvent>(`/events/${id}/duplicate`, { name: newName }),
  publish: (id: string) => apiClient.post<SchoolEvent>(`/events/${id}/publish`, {}),
  unpublish: (id: string) => apiClient.post<SchoolEvent>(`/events/${id}/unpublish`, {}),
}

export const eventService = USE_MOCK ? mock : api
