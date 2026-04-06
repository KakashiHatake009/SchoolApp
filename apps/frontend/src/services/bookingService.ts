import { USE_MOCK } from '@/config'
import { apiClient } from './apiClient'
import { bookings as mockBookings, appointmentSlots as mockSlots } from '@/data/mockData'
import type { Booking, AppointmentSlot } from '@/types'

const delay = (ms = 300) => new Promise((r) => setTimeout(r, ms))
let _bookings = [...mockBookings]
let _slots = [...mockSlots]

const mock = {
  getSlotsByTeacher: async (teacherId: string): Promise<AppointmentSlot[]> => { await delay(); return _slots.filter((s) => s.teacherId === teacherId) },
  getSlotsByEvent: async (eventId: string): Promise<AppointmentSlot[]> => { await delay(); return _slots.filter((s) => s.eventId === eventId) },
  toggleSlot: async (slotId: string): Promise<AppointmentSlot> => {
    await delay()
    _slots = _slots.map((s) => {
      if (s.id !== slotId) return s
      if (s.status === 'booked') return s
      return { ...s, status: s.status === 'available' ? 'disabled' : 'available' }
    })
    return _slots.find((s) => s.id === slotId)!
  },
  getByEvent: async (eventId: string): Promise<Booking[]> => { await delay(); return _bookings.filter((b) => b.eventId === eventId) },
  getByTeacher: async (teacherId: string): Promise<Booking[]> => {
    await delay()
    const teacherSlotIds = new Set(_slots.filter((s) => s.teacherId === teacherId).map((s) => s.id))
    return _bookings.filter((b) => b.slotId && teacherSlotIds.has(b.slotId))
  },
  getByToken: async (cancelToken: string): Promise<Booking | undefined> => { await delay(); return _bookings.find((b) => b.cancelToken === cancelToken) },
  cancel: async (cancelToken: string): Promise<void> => {
    await delay()
    const booking = _bookings.find((b) => b.cancelToken === cancelToken)
    if (!booking) throw new Error('Booking not found')
    _bookings = _bookings.map((b) => b.cancelToken === cancelToken ? { ...b, status: 'CANCELLED' } : b)
  },
  reschedule: async (cancelToken: string, slotId: string): Promise<Booking> => {
    await delay()
    const booking = _bookings.find((b) => b.cancelToken === cancelToken)
    if (booking?.slotId) {
      _slots = _slots.map((s) => s.id === booking.slotId ? { ...s, status: 'available' } : s)
    }
    _slots = _slots.map((s) => s.id === slotId ? { ...s, status: 'booked' } : s)
    _bookings = _bookings.map((b) => b.cancelToken === cancelToken ? { ...b, slotId } : b)
    return _bookings.find((b) => b.cancelToken === cancelToken)!
  },
  sendOtp: async (email: string, _eventId: string): Promise<void> => {
    await delay(500)
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    console.info(`[MOCK] OTP for ${email}: ${code}`)
  },
  verifyOtp: async (_email: string, _code: string, _eventId: string): Promise<{ token: string }> => {
    await delay(300)
    return { token: 'mock-parent-token' }
  },
  create: async (data: Omit<Booking, 'id' | 'bookedAt' | 'cancelToken'>, _parentToken?: string): Promise<Booking> => {
    await delay()
    const booking: Booking = { ...data, id: `booking-${Date.now()}`, bookedAt: new Date().toISOString(), cancelToken: `cancel-${Math.random().toString(36).slice(2)}` }
    _bookings.push(booking)
    return booking
  },
  createBooking: async (data: Omit<Booking, 'id' | 'bookedAt' | 'cancelToken'>, parentToken?: string): Promise<Booking> => {
    return mock.create(data, parentToken)
  },
}

const api = {
  getSlotsByTeacher: (teacherId: string) => apiClient.get<AppointmentSlot[]>(`/slots?teacherId=${teacherId}`),
  getSlotsByEvent: (eventId: string) => apiClient.get<AppointmentSlot[]>(`/events/${eventId}/slots`),
  toggleSlot: (slotId: string) => apiClient.patch<AppointmentSlot>(`/slots/${slotId}`, {}),
  getByEvent: (eventId: string) => apiClient.get<Booking[]>(`/bookings?eventId=${eventId}`),
  getByTeacher: (teacherId: string) => apiClient.get<Booking[]>(`/bookings?teacherId=${teacherId}`),
  getByToken: (cancelToken: string) => apiClient.get<Booking>(`/bookings/${cancelToken}`),
  cancel: (cancelToken: string) => apiClient.delete<void>(`/bookings/${cancelToken}`),
  reschedule: (cancelToken: string, slotId: string) =>
    apiClient.patch<Booking>(`/bookings/${cancelToken}/reschedule`, { slotId }),
  sendOtp: (email: string, eventId: string) => apiClient.post<void>('/otp/send', { email, eventId }),
  verifyOtp: (email: string, code: string, eventId: string) => apiClient.post<{ token: string }>('/otp/verify', { email, code, eventId }),
  create: (data: Omit<Booking, 'id' | 'bookedAt' | 'cancelToken'>, _parentToken?: string) =>
    apiClient.post<Booking>('/bookings', data),
  createBooking: (data: Omit<Booking, 'id' | 'bookedAt' | 'cancelToken'>, parentToken?: string) =>
    api.create(data, parentToken),
}

export const bookingService = USE_MOCK ? mock : api
