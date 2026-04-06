import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { AppointmentSlot, Teacher, Booking } from '@/types'

type Step = 'email' | 'verify' | 'teachers' | 'slots' | 'form' | 'confirmed' | 'reschedule'

// ── Public API helpers (no auth store token) ──────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || ''

const publicFetch = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || `${res.status}`)
  }
  if (res.status === 204) return null as T
  return res.json()
}

type PublicEvent = {
  id: string
  name: string
  description?: string
  date: string
  startTime: string
  endTime: string
  status: string
  bookingActive: boolean
  school: { id: string; name: string; logo?: string }
}

// ── Shared page shell ─────────────────────────────────────────────────────────
function PageShell({
  navTitle = 'Terminbuchung',
  schoolName,
  eventName,
  description,
  schoolLogo,
  children,
}: {
  navTitle?: string
  schoolName?: string
  eventName?: string
  description?: string
  schoolLogo?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
        <img src="/logo.png" alt="WahlWeise" className="h-8 w-auto object-contain shrink-0" />
        <span className="text-base text-gray-500">{navTitle}</span>
        <span className="text-sm text-gray-400 cursor-pointer hover:text-gray-600">Language</span>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-4 sm:py-6 w-full max-w-5xl mx-auto">
        {schoolName && (
          <div className="flex justify-between items-start mb-6">
            <div className="flex-1 pr-4">
              <p className="font-bold text-gray-800">
                <span className="font-bold">{schoolName}:</span>{' '}
                <span className="font-normal">{eventName}</span>
              </p>
              {description && (
                <p className="text-sm text-gray-600 leading-relaxed mt-2 max-w-2xl">{description}</p>
              )}
            </div>
            {schoolLogo ? (
              <img src={schoolLogo} alt={schoolName} className="w-20 h-20 rounded-full object-contain p-1 border border-gray-200 flex-shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-full border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                Logo
              </div>
            )}
          </div>
        )}
        {children}
      </main>

      <footer className="px-6 py-4" />
    </div>
  )
}

// ── Nav buttons ───────────────────────────────────────────────────────────────
function NavButtons({
  onBack,
  onNext,
  nextLabel = 'WEITER',
  nextDisabled = false,
  nextLoading = false,
  center = false,
}: {
  onBack?: () => void
  onNext: () => void
  nextLabel?: string
  nextDisabled?: boolean
  nextLoading?: boolean
  center?: boolean
}) {
  const btnCls = 'py-3 px-10 rounded bg-[#1565c0] text-white text-xs tracking-widest uppercase font-medium hover:bg-[#0d47a1] transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  if (center) {
    return (
      <div className="flex justify-center mt-10">
        <button onClick={onNext} disabled={nextDisabled || nextLoading} className={btnCls}>
          {nextLoading ? '…' : nextLabel}
        </button>
      </div>
    )
  }

  return (
    <div className={`flex mt-8 gap-4 ${onBack ? 'justify-between' : 'justify-end'}`}>
      {onBack && (
        <button onClick={onBack} className={btnCls}>ZURÜCK</button>
      )}
      <button onClick={onNext} disabled={nextDisabled || nextLoading} className={btnCls}>
        {nextLoading ? '…' : nextLabel}
      </button>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function BookingPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpError, setOtpError] = useState('')
  const [cancelToken, setCancelToken] = useState('')
  const [teacherSearch, setTeacherSearch] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null)
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0)
  const [loading, setLoading] = useState(false)
  const [booking, setBooking] = useState<Booking | null>(null)
  const [bookedSlot, setBookedSlot] = useState<{ date: string; time: string } | null>(null)

  const [form, setForm] = useState({
    salutation: '',
    firstName: '',
    surname: '',
    email: '',
    phone: '',
    childName: '',
    childClass: '',
    hasSecondPerson: false,
    secondSalutation: '',
    secondFirstName: '',
    secondSurname: '',
    note: '',
    privacy: false,
  })

  // Load event + school via public endpoint
  const { data: event } = useQuery({
    queryKey: ['public-event', eventId],
    queryFn: () => publicFetch<PublicEvent>(`/public/events/${eventId}`),
    enabled: !!eventId,
  })

  // Load teachers via public endpoint
  const { data: teachers = [] } = useQuery({
    queryKey: ['public-teachers', eventId],
    queryFn: () => publicFetch<Teacher[]>(`/public/events/${eventId}/teachers`),
    enabled: !!eventId,
  })

  // Load slots for selected teacher — public endpoint, disabled slots excluded
  const { data: allSlots = [] } = useQuery({
    queryKey: ['public-slots', eventId],
    queryFn: () => publicFetch<AppointmentSlot[]>(`/public/events/${eventId}/slots/available`),
    enabled: !!eventId && (step === 'slots' || step === 'reschedule'),
  })

  const slots = allSlots.filter((s) => s.teacherId === selectedTeacher?.id)

  const schoolName = event?.school?.name ?? ''
  const eventName = event?.name ?? ''
  const description = event?.description ?? ''
  const schoolLogo = event?.school?.logo ?? ''

  const resetFlow = () => {
    setStep('email')
    setEmail('')
    setOtpCode('')
    setOtpError('')
    setCancelToken('')
    setSelectedTeacher(null)
    setSelectedSlot(null)
    setCurrentWeekOffset(0)
    setBooking(null)
    setForm({
      salutation: '', firstName: '', surname: '', email: '', phone: '',
      childName: '', childClass: '', hasSecondPerson: false,
      secondSalutation: '', secondFirstName: '', secondSurname: '', note: '', privacy: false,
    })
  }

  // ── Guard: event not published yet ───────────────────────────────────────
  if (event && (!event.bookingActive || event.status !== 'published')) {
    return (
      <PageShell navTitle="Terminbuchung" schoolName={schoolName} eventName={eventName} schoolLogo={schoolLogo}>
        <div className="flex justify-center mt-8">
          <div className="bg-[#dde8ee] rounded-lg px-10 py-10 text-center w-full max-w-md">
            <p className="font-bold text-gray-800 mb-3 text-base">Buchung noch nicht gestartet</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              Die Terminbuchung für diese Veranstaltung ist noch nicht geöffnet.<br />
              Bitte versuchen Sie es später erneut.
            </p>
          </div>
        </div>
      </PageShell>
    )
  }

  // ── Step 1: Email — send OTP ──────────────────────────────────────────────
  if (step === 'email') {
    const handleSend = async () => {
      if (!email.trim() || !eventId) return
      setLoading(true)
      setOtpError('')
      try {
        await publicFetch('/otp/send', {
          method: 'POST',
          body: JSON.stringify({ email: email.trim(), eventId }),
        })
        setStep('verify')
      } catch (err: unknown) {
        setOtpError(err instanceof Error ? err.message : 'Fehler beim Senden. Bitte versuchen Sie es erneut.')
      } finally {
        setLoading(false)
      }
    }

    return (
      <PageShell navTitle="Terminbuchung" schoolName={schoolName} eventName={eventName} schoolLogo={schoolLogo}>
        {description && (
          <p className="text-sm text-gray-600 leading-relaxed mb-6 max-w-2xl">{description}</p>
        )}

        <div className="flex justify-center mt-4">
          <div className="bg-[#dde8ee] rounded-lg px-10 py-8 text-center w-full max-w-md">
            <p className="font-bold text-gray-800 mb-5 text-base leading-snug">
              Bitte geben Sie Ihre E-Mail ein, um einen Bestätigungscode zu erhalten:
            </p>
            <input
              type="email"
              placeholder="E-Mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && email.trim()) handleSend() }}
              className="border border-gray-300 rounded px-4 py-2 text-sm w-full focus:outline-none focus:border-[#1565c0] mb-3 bg-white"
            />
            {otpError && <p className="text-xs text-red-500 mb-3">{otpError}</p>}
            <button
              onClick={handleSend}
              disabled={!email.trim() || loading}
              className="bg-[#1565c0] text-white text-xs tracking-widest uppercase font-medium px-10 py-3 rounded hover:bg-[#0d47a1] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? '…' : 'CODE SENDEN'}
            </button>
          </div>
        </div>
      </PageShell>
    )
  }

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  if (step === 'verify') {
    const handleVerify = async () => {
      if (!otpCode.trim() || !eventId) return
      setLoading(true)
      setOtpError('')
      try {
        const result = await publicFetch<{ token: string; existingCancelToken: string | null }>('/otp/verify', {
          method: 'POST',
          body: JSON.stringify({ email, code: otpCode.trim(), eventId }),
        })
        if (result.existingCancelToken) {
          navigate(`/cancel/${result.existingCancelToken}`)
          return
        }
        setStep('teachers')
      } catch (err: unknown) {
        setOtpError(err instanceof Error ? err.message : 'Ungültiger oder abgelaufener Code.')
      } finally {
        setLoading(false)
      }
    }

    const handleResend = async () => {
      if (!eventId) return
      setLoading(true)
      setOtpError('')
      try {
        await publicFetch('/otp/send', {
          method: 'POST',
          body: JSON.stringify({ email, eventId }),
        })
        setOtpCode('')
      } catch {
        setOtpError('Fehler beim erneuten Senden.')
      } finally {
        setLoading(false)
      }
    }

    return (
      <PageShell navTitle="Terminbuchung" schoolName={schoolName} eventName={eventName} schoolLogo={schoolLogo}>
        <div className="flex justify-center mt-4">
          <div className="bg-[#dde8ee] rounded-lg px-10 py-8 text-center w-full max-w-md">
            <p className="font-bold text-gray-800 mb-2 text-base">Code eingeben</p>
            <p className="text-sm text-gray-600 mb-5">
              Wir haben einen 6-stelligen Code an <strong>{email}</strong> gesendet.
            </p>
            <input
              type="text"
              placeholder="6-stelliger Code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleVerify() }}
              maxLength={6}
              className="border border-gray-300 rounded px-4 py-2 text-sm w-full text-center tracking-widest focus:outline-none focus:border-[#1565c0] mb-3 bg-white text-lg font-mono"
            />
            {otpError && <p className="text-xs text-red-500 mb-3">{otpError}</p>}
            <button
              onClick={handleVerify}
              disabled={otpCode.length < 6 || loading}
              className="w-full bg-[#1565c0] text-white text-xs tracking-widest uppercase font-medium px-10 py-3 rounded hover:bg-[#0d47a1] transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-3"
            >
              {loading ? '…' : 'BESTÄTIGEN'}
            </button>
            <button
              onClick={handleResend}
              disabled={loading}
              className="text-xs text-[#1565c0] hover:underline cursor-pointer"
            >
              Code erneut senden
            </button>
            <div className="mt-4">
              <button
                onClick={() => { setStep('email'); setOtpCode(''); setOtpError('') }}
                className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                ← E-Mail ändern
              </button>
            </div>
          </div>
        </div>
      </PageShell>
    )
  }

  // ── Step 3: Teacher selection ────────────────────────────────────────────────
  if (step === 'teachers') {
    const filtered = teachers.filter((t) =>
      !teacherSearch ||
      `${t.surname} ${t.firstName} ${t.surname2 ?? ''} ${t.firstName2 ?? ''}`.toLowerCase().includes(teacherSearch.toLowerCase()),
    )
    return (
      <PageShell navTitle="Terminbuchung" schoolName={schoolName} eventName={eventName} description={description} schoolLogo={schoolLogo}>
        <div className="flex items-center gap-3 mb-4">
          <span className="font-medium text-gray-700 text-sm whitespace-nowrap">Pädagog:in suchen</span>
          <input
            value={teacherSearch}
            onChange={(e) => setTeacherSearch(e.target.value)}
            placeholder="suchen"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#1565c0] w-40"
          />
        </div>

        <div className="border border-gray-200 rounded overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#dde8ee] text-gray-700">
                <th className="px-4 py-3 text-left font-medium">Lehrkraft <span className="text-gray-400">↓</span></th>
                <th className="px-4 py-3 text-left font-medium">Erzieher:in <span className="text-gray-400">↓</span></th>
                <th className="px-4 py-3 text-left font-medium">Raum</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-5 text-center text-gray-400 text-sm">
                    Keine Lehrkraft gefunden.
                  </td>
                </tr>
              )}
              {filtered.map((t, i) => (
                <tr
                  key={t.id}
                  onClick={() => setSelectedTeacher(t)}
                  className={`border-b border-gray-100 cursor-pointer transition-colors ${
                    selectedTeacher?.id === t.id
                      ? 'bg-[#dde8ee]'
                      : i % 2 === 0
                      ? 'bg-white hover:bg-gray-50'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <td className="px-4 py-3 text-gray-800">
                    {t.surname} {t.firstName.charAt(0)}.
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {t.firstName2 && t.surname2
                      ? `${t.surname2} ${t.firstName2.charAt(0)}.`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.roomNo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="hidden sm:flex justify-center">
          <button
            onClick={() => { if (selectedTeacher) setStep('slots') }}
            disabled={!selectedTeacher}
            className="py-3 px-10 rounded bg-[#1565c0] text-white text-xs tracking-widest uppercase font-medium hover:bg-[#0d47a1] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            WEITER
          </button>
        </div>
        <div className="sm:hidden">
          <NavButtons
            onBack={() => setStep('verify')}
            onNext={() => { if (selectedTeacher) setStep('slots') }}
            nextDisabled={!selectedTeacher}
          />
        </div>
      </PageShell>
    )
  }

  // ── Step 4 + reschedule: Slot picker ─────────────────────────────────────────
  if (step === 'slots' || step === 'reschedule') {
    const isReschedule = step === 'reschedule'
    const allDates = [...new Set(slots.map((s) => s.date))].sort()
    const weekDates = allDates.slice(currentWeekOffset * 5, currentWeekOffset * 5 + 5)
    const DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

    const getMonthLabel = () => {
      if (!weekDates[0]) return ''
      const d = new Date(weekDates[0])
      return d.toLocaleString('de-DE', { month: 'long', year: 'numeric' })
    }

    const slotsByDate: Record<string, AppointmentSlot[]> = {}
    for (const slot of slots) {
      if (!slotsByDate[slot.date]) slotsByDate[slot.date] = []
      slotsByDate[slot.date].push(slot)
    }
    for (const date of Object.keys(slotsByDate)) {
      slotsByDate[date].sort((a, b) => a.time.localeCompare(b.time))
    }
    const cols = Math.max(weekDates.length, 1)
    const canGoPrev = currentWeekOffset > 0
    const canGoNext = (currentWeekOffset + 1) * 5 < allDates.length

    const handleRescheduleConfirm = async () => {
      if (!selectedSlot || !cancelToken) return
      setLoading(true)
      try {
        const updated = await publicFetch<Booking>(`/bookings/${cancelToken}/reschedule`, {
          method: 'PATCH',
          body: JSON.stringify({ slotId: selectedSlot.id }),
        })
        setBooking(updated)
        if (selectedSlot) setBookedSlot({ date: selectedSlot.date, time: selectedSlot.time })
        setStep('confirmed')
      } catch (err: unknown) {
        setOtpError(err instanceof Error ? err.message : 'Fehler beim Umbuchen.')
      } finally {
        setLoading(false)
      }
    }

    const hasT2 = !!(selectedTeacher?.firstName2 && selectedTeacher?.surname2)
    const t1Name = selectedTeacher ? `${selectedTeacher.salutation} ${selectedTeacher.firstName} ${selectedTeacher.surname}` : ''
    const t2Name = selectedTeacher ? `${selectedTeacher.salutation2} ${selectedTeacher.firstName2} ${selectedTeacher.surname2}` : ''

    const CalendarGrid = () => (
      <>
        <div className="flex items-center justify-between mb-3">
          <button
            disabled={!canGoPrev}
            onClick={() => setCurrentWeekOffset((w) => Math.max(0, w - 1))}
            className={`text-xl px-2 transition-colors ${canGoPrev ? 'text-gray-700 hover:text-gray-900 cursor-pointer' : 'text-gray-200 cursor-not-allowed'}`}
          >‹</button>
          <span className="text-sm text-gray-700 font-medium">{getMonthLabel()}</span>
          <button
            disabled={!canGoNext}
            onClick={() => setCurrentWeekOffset((w) => w + 1)}
            className={`text-xl px-2 transition-colors ${canGoNext ? 'text-gray-700 hover:text-gray-900 cursor-pointer' : 'text-gray-200 cursor-not-allowed'}`}
          >›</button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start">
          {/* Calendar grid */}
          <div className="flex-1 w-full rounded overflow-hidden">
            <div
              className="grid bg-[#dde8ee] rounded-t justify-center"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {weekDates.map((date) => {
                const d = new Date(date)
                const di = d.getDay() === 0 ? 6 : d.getDay() - 1
                return (
                  <div key={date} className="text-center py-2 text-xs font-medium text-gray-700">
                    <div>{DAY_SHORT[di]}</div>
                    <div>{d.getDate()}</div>
                  </div>
                )
              })}
            </div>

            <div
              className="grid overflow-y-auto max-h-96 justify-center items-start"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
            >
              {weekDates.map((date) => (
                <div key={date} className="flex flex-col items-center">
                  {(slotsByDate[date] ?? []).map((slot) => {
                    const isSelected = selectedSlot?.id === slot.id
                    const isCurrentBooking = isReschedule && bookedSlot?.date === slot.date && bookedSlot?.time === slot.time
                    const isBooked = slot.status === 'booked' && !isCurrentBooking
                    const isDisabled = slot.status === 'disabled'
                    const isUnavailable = isBooked || isDisabled || isCurrentBooking
                    const labelColor = (v: boolean | null | undefined) =>
                      v === false ? 'text-red-500' : 'text-green-600'
                    return (
                      <div key={slot.id} className="py-1.5 px-1 flex flex-col items-center gap-0.5">
                        <button
                          disabled={isUnavailable}
                          onClick={() => !isUnavailable && setSelectedSlot(isSelected ? null : slot)}
                          title={isCurrentBooking ? 'Ihr aktueller Termin' : isBooked ? 'Bereits gebucht' : isDisabled ? 'Nicht verfügbar' : 'Termin wählen'}
                          className={`text-xs rounded px-2 py-0.5 font-medium transition-colors whitespace-nowrap ${
                            isSelected
                              ? 'bg-[#1565c0] text-white cursor-pointer'
                              : isCurrentBooking
                              ? 'bg-green-500 text-white cursor-not-allowed'
                              : isBooked
                              ? 'bg-[#f5a623] text-white cursor-not-allowed'
                              : isDisabled
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-[#90caf9] text-[#0d47a1] hover:bg-[#64b5f6] cursor-pointer'
                          }`}
                        >
                          {slot.time}
                        </button>
                        {isCurrentBooking && (
                          <span className="text-[8px] text-green-600 font-semibold leading-none">Ihr Termin</span>
                        )}
                        {hasT2 && (
                          <div className="flex gap-1">
                            <span
                              className={`text-[8px] font-semibold leading-none ${labelColor(slot.teacher1Present)}`}
                              title={`T1 – ${t1Name}: ${slot.teacher1Present === true ? 'anwesend' : 'abwesend'}`}
                            >T1</span>
                            <span
                              className={`text-[8px] font-semibold leading-none ${labelColor(slot.teacher2Present)}`}
                              title={`T2 – ${t2Name}: ${slot.teacher2Present === true ? 'anwesend' : 'abwesend'}`}
                            >T2</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
              {weekDates.every((date) => !(slotsByDate[date]?.length)) && (
                <div className="col-span-full py-6 text-center text-sm text-gray-400">Keine Termine verfügbar.</div>
              )}
            </div>
          </div>

          {/* Legend — side panel */}
          <div className="hidden sm:block w-48 shrink-0 text-xs border border-gray-200 rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Legende</p>

            <div>
              <p className="font-medium text-gray-500 mb-1">Verfügbarkeit</p>
              <div className="space-y-1 text-gray-700">
                {isReschedule && bookedSlot && (
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500 shrink-0" />Ihr Termin</span>
                )}
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#90caf9] shrink-0" />verfügbar</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#f5a623] shrink-0" />gebucht</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-300 shrink-0" />blockiert</span>
              </div>
            </div>

            {hasT2 && (
              <>
                <div className="border-t border-gray-100 pt-2">
                  <p className="font-medium text-gray-500 mb-1">Lehrkräfte</p>
                  <div className="space-y-1 text-gray-700">
                    <div className="leading-snug">
                      <span className="font-medium">T1</span>
                      <br /><span className="text-gray-500">{t1Name}</span>
                    </div>
                    <div className="leading-snug">
                      <span className="font-medium">T2</span>
                      <br /><span className="text-gray-500">{t2Name}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-2">
                  <p className="font-medium text-gray-500 mb-1">Anwesenheit</p>
                  <div className="space-y-1 text-gray-700">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#16A34A] shrink-0" />anwesend</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#EF4444] shrink-0" />abwesend</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </>
    )

    // Warning: one teacher absent but slot still bookable
    const hasAbsentTeacherWarning = !!selectedSlot &&
      !!(selectedTeacher?.firstName2 && selectedTeacher?.surname2) &&
      (
        (selectedSlot.teacher1Present === false && selectedSlot.teacher2Present !== false) ||
        (selectedSlot.teacher2Present === false && selectedSlot.teacher1Present !== false)
      )

    const absentName = selectedSlot?.teacher1Present === false
      ? `${selectedTeacher?.salutation} ${selectedTeacher?.firstName} ${selectedTeacher?.surname}`
      : `${selectedTeacher?.salutation2} ${selectedTeacher?.firstName2} ${selectedTeacher?.surname2}`

    const AbsentWarning = () => hasAbsentTeacherWarning ? (
      <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-4 py-2">
        Hinweis: <strong>{absentName}</strong> ist für diesen Termin abwesend. Der Termin ist trotzdem buchbar.
      </div>
    ) : null

    if (isReschedule) {
      return (
        <PageShell navTitle="Termin ändern" schoolName={schoolName} eventName={eventName} description={description} schoolLogo={schoolLogo}>
          <h2 className="font-bold text-gray-800 mb-4">Neuen Termin wählen</h2>
          {otpError && <p className="text-sm text-red-500 mb-3">{otpError}</p>}
          <div className="hidden sm:flex gap-8">
            <div className="w-44 flex-shrink-0">
              <p className="text-sm text-gray-600 mb-4">Wählen Sie Ihren neuen Termin aus.</p>
              <p className="text-sm font-semibold text-gray-700 px-2">
                {selectedTeacher?.salutation} {selectedTeacher?.surname}
              </p>
            </div>
            <div className="flex-1">
              {CalendarGrid()}
              <AbsentWarning />
            </div>
          </div>
          <div className="sm:hidden">
            {CalendarGrid()}
            <AbsentWarning />
          </div>
          <NavButtons
            onBack={() => { setStep('confirmed'); setSelectedSlot(null); setOtpError('') }}
            onNext={handleRescheduleConfirm}
            nextLabel="TERMIN BESTÄTIGEN"
            nextDisabled={!selectedSlot}
            nextLoading={loading}
          />
        </PageShell>
      )
    }

    return (
      <PageShell navTitle="Terminbuchung" schoolName={schoolName} eventName={eventName} description={description} schoolLogo={schoolLogo}>
        <div className="hidden sm:flex gap-8">
          <div className="w-44 flex-shrink-0">
            <p className="text-sm text-gray-600 mb-4">Wählen Sie Ihren Termin aus.</p>
            <div className="space-y-1">
              {teachers.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTeacher(t); setSelectedSlot(null) }}
                  className={`w-full text-left text-sm px-2 py-1.5 rounded cursor-pointer transition-colors ${
                    selectedTeacher?.id === t.id
                      ? 'bg-[#dde8ee] text-[#1565c0] font-semibold'
                      : 'text-gray-500 hover:bg-[#eef4f7] hover:text-gray-800'
                  }`}
                >
                  <span className="block leading-tight">{t.salutation} {t.firstName} {t.surname}</span>
                  {t.firstName2 && t.surname2 && (
                    <span className="block leading-tight text-xs opacity-75">{t.salutation2} {t.firstName2} {t.surname2}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <p className="text-center font-semibold text-gray-800 mb-3">
              {selectedTeacher?.salutation} {selectedTeacher?.surname}
            </p>
            {CalendarGrid()}
            <AbsentWarning />
          </div>
        </div>

        <div className="sm:hidden">
          <h2 className="font-bold text-gray-800 text-lg mb-4">Wählen Sie Ihren Termin aus.</h2>
          {CalendarGrid()}
          <AbsentWarning />
        </div>

        <NavButtons
          onBack={() => setStep('teachers')}
          onNext={() => { if (selectedSlot) setStep('form') }}
          nextDisabled={!selectedSlot}
        />
      </PageShell>
    )
  }

  // ── Step 5: Personal info form ───────────────────────────────────────────────
  if (step === 'form') {
    const handleSubmit = async () => {
      if (!selectedSlot || !selectedTeacher || !eventId) return
      setLoading(true)
      try {
        const result = await publicFetch<Booking>('/bookings', {
          method: 'POST',
          body: JSON.stringify({
            slotId: selectedSlot.id,
            teacherId: selectedTeacher.id,
            eventId,
            salutation: form.salutation || 'Hr.',
            parentFirstName: form.firstName,
            parentSurname: form.surname,
            parentEmail: email,
            phone: form.phone,
            childName: form.childName,
            childClass: form.childClass,
            numberOfPersons: form.hasSecondPerson ? 2 : 1,
            secondPersonSalutation: form.hasSecondPerson ? (form.secondSalutation || 'Hr.') : undefined,
            secondPersonFirstName: form.hasSecondPerson ? form.secondFirstName : undefined,
            secondPersonSurname: form.hasSecondPerson ? form.secondSurname : undefined,
            note: form.note || undefined,
          }),
        })
        setBooking(result)
        setCancelToken(result.cancelToken)
        if (selectedSlot) setBookedSlot({ date: selectedSlot.date, time: selectedSlot.time })
        setStep('confirmed')
      } finally {
        setLoading(false)
      }
    }

    const inputCls = 'border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#1565c0] w-full bg-white'
    const selectCls = inputCls + ' appearance-none'

    const SalutationSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectCls}>
        <option value="">Anrede</option>
        <option value="Hr.">Hr.</option>
        <option value="Fr.">Fr.</option>
      </select>
    )

    return (
      <PageShell navTitle="Terminbuchung" schoolName={schoolName} eventName={eventName} description={description} schoolLogo={schoolLogo}>
        <h2 className="font-bold text-gray-800 mb-5">Ihre Informationen</h2>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <SalutationSelect value={form.salutation} onChange={(v) => setForm((f) => ({ ...f, salutation: v }))} />
            <input placeholder="Vorname" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className={inputCls} />
            <input placeholder="Nachname" value={form.surname} onChange={(e) => setForm((f) => ({ ...f, surname: e.target.value }))} className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="hidden sm:block" />
            <input type="email" value={email} readOnly className={inputCls + ' bg-gray-50 cursor-default'} />
            <input placeholder="Telefon" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputCls} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="hidden sm:block" />
            <input placeholder="Name des Kindes" value={form.childName} onChange={(e) => setForm((f) => ({ ...f, childName: e.target.value }))} className={inputCls} />
            <input placeholder="Klasse" value={form.childClass} onChange={(e) => setForm((f) => ({ ...f, childClass: e.target.value }))} className={inputCls} />
          </div>

          <div className="sm:pl-[calc(33.333%+0.75rem)]">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.hasSecondPerson}
                onChange={(e) => setForm((f) => ({ ...f, hasSecondPerson: e.target.checked }))}
                className="accent-[#1565c0]"
              />
              Eine 2. Person nimmt teil
            </label>
          </div>

          {form.hasSecondPerson && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <SalutationSelect value={form.secondSalutation} onChange={(v) => setForm((f) => ({ ...f, secondSalutation: v }))} />
              <input placeholder="Vorname der 2. Person" value={form.secondFirstName} onChange={(e) => setForm((f) => ({ ...f, secondFirstName: e.target.value }))} className={inputCls} />
              <input placeholder="Nachname der 2. Person" value={form.secondSurname} onChange={(e) => setForm((f) => ({ ...f, secondSurname: e.target.value }))} className={inputCls} />
            </div>
          )}

          <div className="sm:pl-[calc(33.333%+0.75rem)]">
            <textarea
              placeholder="Nachricht an die Pädagog:innen"
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              rows={3}
              className={inputCls}
            />
          </div>

          <div className="sm:pl-[calc(33.333%+0.75rem)]">
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={form.privacy}
                onChange={(e) => setForm((f) => ({ ...f, privacy: e.target.checked }))}
                className="accent-[#1565c0]"
              />
              Ich akzeptiere die Datenschutzbestimmungen.
            </label>
          </div>
        </div>

        <NavButtons
          onBack={() => setStep('slots')}
          onNext={handleSubmit}
          nextDisabled={!form.firstName || !form.surname || !form.childName || !form.privacy}
          nextLoading={loading}
        />
      </PageShell>
    )
  }

  // ── Step 6: Confirmation ─────────────────────────────────────────────────────
  const bookingCancelToken = cancelToken || booking?.cancelToken || ''
  const cancelUrl = bookingCancelToken ? `/cancel/${bookingCancelToken}` : ''

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
        <img src="/logo.png" alt="WahlWeise" className="h-8 w-auto object-contain shrink-0" />
        <span className="text-base text-gray-500">Ihre Buchungsdetails</span>
        <span className="text-sm text-gray-400 cursor-pointer hover:text-gray-600">Language</span>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-4 sm:py-6 w-full max-w-5xl mx-auto">
        <div className="bg-[#1565c0] text-white text-center font-bold py-4 px-6 rounded mb-8">
          Ihr Termin zum {eventName} der {schoolName} wurde bestätigt.
        </div>

        <div className="max-w-xl mx-auto space-y-4">
          <div className="bg-[#dde8ee] rounded-lg p-6">
            <p className="font-bold text-gray-800 mb-3">Ihr Termin</p>
            <p className="text-sm text-gray-700">
              {selectedTeacher?.salutation} {selectedTeacher?.surname}
            </p>
            {selectedTeacher?.roomNo && (
              <p className="text-sm text-gray-700">Raum {selectedTeacher.roomNo}</p>
            )}
            <p className="text-sm text-gray-700">Datum: {selectedSlot?.date}</p>
            <p className="text-sm text-gray-700">Zeit: {selectedSlot?.time}</p>
          </div>

          <div className="bg-[#dde8ee] rounded-lg p-6">
            <p className="font-bold text-[#1565c0] mb-3">Wichtig</p>
            <p className="text-sm text-gray-700 mb-3">
              Bitte seien Sie pünktlich. Sie können 5 Minuten vor Ihrem Termin das Schulgebäude betreten.
            </p>
            {cancelUrl && (
              <p className="text-sm text-gray-700">
                Falls Sie Ihren Termin absagen oder ändern möchten, nutzen Sie bitte diesen Link:{' '}
                <a href={cancelUrl} className="text-[#1565c0] underline break-all">
                  {window.location.origin}{cancelUrl}
                </a>
              </p>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10">
          {bookingCancelToken && (
            <button
              onClick={() => navigate(`/cancel/${bookingCancelToken}`)}
              className="py-3 px-10 rounded border border-[#1565c0] text-[#1565c0] text-xs tracking-widest uppercase font-medium hover:bg-[#dde8ee] transition-colors"
            >
              TERMIN ÄNDERN ODER ABSAGEN
            </button>
          )}
          <button
            onClick={resetFlow}
            className="py-3 px-10 rounded bg-[#1565c0] text-white text-xs tracking-widest uppercase font-medium hover:bg-[#0d47a1] transition-colors"
          >
            WEITEREN TERMIN BUCHEN
          </button>
        </div>
      </main>

      <footer className="px-6 py-4" />
    </div>
  )
}
