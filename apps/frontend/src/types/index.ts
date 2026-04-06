// ─── User Roles ───────────────────────────────────────────────────────────────
export type UserRole = 'platform_admin' | 'school_admin' | 'teacher' | 'parent'

// ─── School ───────────────────────────────────────────────────────────────────
export interface School {
  id: string
  name: string
  description?: string
  website: string
  phone: string
  email: string
  street: string
  postcode: string
  city: string
  contactPerson: string
  contactPhone: string
  contactEmail: string
  logo?: string
  createdAt: string
  subscriptionStatus: 'active' | 'inactive' | 'trial'
}

// ─── Event ────────────────────────────────────────────────────────────────────
export type EventType = 'slot_booking' | 'rsvp_signup'
export type EventStatus = 'draft' | 'published'
export type BookingStatus = 'not_booked' | 'slots_confirmed' | 'booked'

export interface EventDay {
  id: string
  eventId: string
  date: string      // 'YYYY-MM-DD'
  startTime: string // 'HH:mm'
  endTime: string   // 'HH:mm'
}

export interface SchoolEvent {
  id: string
  schoolId: string
  name: string
  description?: string
  type: EventType
  date: string       // primary day (first day) — kept for backward compat
  startTime: string
  endTime: string
  sessionLength: number   // minutes
  breakLength: number     // minutes between sessions
  status: EventStatus
  bookingActive: boolean
  qrCode?: string
  link?: string
  createdAt: string
  duplicatedFrom?: string
  days?: EventDay[]  // individual days of the event
}

// ─── Teacher ──────────────────────────────────────────────────────────────────
export interface Teacher {
  id: string
  schoolId: string
  eventId: string
  klasse?: string
  roomNo?: string
  salutation: 'Hr.' | 'Fr.'
  titel?: string
  firstName: string
  surname: string
  email?: string
  salutation2?: string
  titel2?: string
  firstName2?: string
  surname2?: string
  email2?: string
  bookingStatus: BookingStatus
  isActive?: boolean
  createdAt?: string
}

// ─── Appointment Slot ─────────────────────────────────────────────────────────
export type SlotStatus = 'available' | 'booked' | 'disabled'

export interface AppointmentSlot {
  id: string
  teacherId: string
  eventId: string
  time: string
  date: string
  status: SlotStatus
  bookingId?: string
  teacher1Present?: boolean | null
  teacher2Present?: boolean | null
}

// ─── Booking ──────────────────────────────────────────────────────────────────
export interface Booking {
  id: string
  slotId?: string
  teacherId?: string
  eventId: string
  salutation?: string
  parentFirstName?: string
  parentSurname: string
  parentEmail: string
  phone?: string
  childName?: string
  childClass?: string
  numberOfPersons: number
  secondPersonSalutation?: string
  secondPersonFirstName?: string
  secondPersonSurname?: string
  note?: string
  status?: string
  cancelToken: string
  bookedAt: string
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id: string
  role: UserRole
  schoolId?: string
  teacherId?: string
  name: string
  email: string
  avatar?: string
}
