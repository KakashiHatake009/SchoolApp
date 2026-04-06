import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'

type AppointmentSlot = {
  id: string
  date: string
  time: string
  status: string
  teacherId: string
  teacher1Present?: boolean | null
  teacher2Present?: boolean | null
}

type Teacher = {
  id: string
  salutation: string
  firstName: string
  surname: string
  roomNo?: string
  salutation2?: string
  firstName2?: string
  surname2?: string
}

type BookingDetail = {
  id: string
  status: string
  cancelToken: string
  parentFirstName?: string
  parentSurname: string
  parentEmail: string
  event: { id: string; name: string; date: string }
  slot?: {
    id: string
    time: string
    date: string
    teacher: { id: string; salutation: string; firstName: string; surname: string; roomNo?: string }
  } | null
}

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

export default function CancelPage() {
  const { cancelToken } = useParams<{ cancelToken: string }>()
  const qc = useQueryClient()
  const [cancelled, setCancelled] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState('')
  const [mode, setMode] = useState<'view' | 'reschedule'>('view')
  const [selectedSlot, setSelectedSlot] = useState<AppointmentSlot | null>(null)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('')
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0)
  const [rescheduling, setRescheduling] = useState(false)
  const [rescheduleError, setRescheduleError] = useState('')
  const [rescheduled, setRescheduled] = useState(false)

  const { data: booking, isLoading, isError } = useQuery({
    queryKey: ['booking', cancelToken],
    queryFn: () => publicFetch<BookingDetail>(`/bookings/${cancelToken}`),
    enabled: !!cancelToken,
  })

  const { data: teachers = [] } = useQuery({
    queryKey: ['cancel-teachers', booking?.event.id],
    queryFn: () => publicFetch<Teacher[]>(`/public/events/${booking!.event.id}/teachers`),
    enabled: !!booking?.event.id && mode === 'reschedule',
  })

  const { data: allSlots = [] } = useQuery({
    queryKey: ['cancel-slots', booking?.event.id],
    queryFn: () => publicFetch<AppointmentSlot[]>(`/public/events/${booking!.event.id}/slots/available`),
    enabled: !!booking?.event.id && mode === 'reschedule',
  })

  // SSE: real-time slot updates when teacher changes availability
  useEffect(() => {
    if (!booking?.event.id || mode !== 'reschedule') return
    const es = new EventSource(`${API_BASE}/api/public/events/${booking.event.id}/slot-updates`)
    es.onmessage = (e) => {
      const updatedSlot: AppointmentSlot = JSON.parse(e.data)
      qc.setQueryData(
        ['cancel-slots', booking.event.id],
        (old: AppointmentSlot[] | undefined) =>
          old?.map((s) => (s.id === updatedSlot.id ? updatedSlot : s)) ?? [],
      )
    }
    return () => es.close()
  }, [booking?.event.id, mode, qc])

  const activeTeacherId = selectedTeacherId || booking?.slot?.teacher?.id || ''
  const teacherSlots = allSlots.filter((s) => s.teacherId === activeTeacherId)

  const handleEnterReschedule = () => {
    setMode('reschedule')
    setSelectedSlot(null)
    setSelectedTeacherId(booking?.slot?.teacher?.id || '')
    setCurrentWeekOffset(0)
  }

  const handleTeacherSelect = (id: string) => {
    setSelectedTeacherId(id)
    setSelectedSlot(null)
    setCurrentWeekOffset(0)
  }

  const handleCancel = async () => {
    if (!cancelToken) return
    setCancelling(true)
    setCancelError('')
    try {
      await publicFetch(`/bookings/${cancelToken}`, { method: 'DELETE' })
      setCancelled(true)
    } catch (err: unknown) {
      setCancelError(err instanceof Error ? err.message : 'Fehler beim Absagen.')
    } finally {
      setCancelling(false)
    }
  }

  const handleReschedule = async () => {
    if (!selectedSlot || !cancelToken) return
    setRescheduling(true)
    setRescheduleError('')
    try {
      await publicFetch(`/bookings/${cancelToken}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({ slotId: selectedSlot.id }),
      })
      setRescheduled(true)
    } catch (err: unknown) {
      setRescheduleError(err instanceof Error ? err.message : 'Fehler beim Umbuchen.')
    } finally {
      setRescheduling(false)
    }
  }

  // ── Calendar grid ─────────────────────────────────────────────────────────
  const DAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
  const allDates = [...new Set(teacherSlots.map((s) => s.date))].sort()
  const weekDates = allDates.slice(currentWeekOffset * 5, currentWeekOffset * 5 + 5)
  const slotsByDate: Record<string, AppointmentSlot[]> = {}
  for (const s of teacherSlots) {
    if (!slotsByDate[s.date]) slotsByDate[s.date] = []
    slotsByDate[s.date].push(s)
  }
  for (const date of Object.keys(slotsByDate)) {
    slotsByDate[date].sort((a, b) => a.time.localeCompare(b.time))
  }
  const cols = Math.max(weekDates.length, 1)
  const canGoPrev = currentWeekOffset > 0
  const canGoNext = (currentWeekOffset + 1) * 5 < allDates.length

  const getMonthLabel = () => {
    if (!weekDates[0]) return ''
    return new Date(weekDates[0]).toLocaleString('de-DE', { month: 'long', year: 'numeric' })
  }

  const activeTeacher = teachers.find((t) => t.id === activeTeacherId)
  const cancelHasT2 = !!(activeTeacher?.firstName2 && activeTeacher?.surname2)
  const cancelT1Name = activeTeacher ? `${activeTeacher.salutation} ${activeTeacher.firstName} ${activeTeacher.surname}` : ''
  const cancelT2Name = activeTeacher ? `${activeTeacher.salutation2} ${activeTeacher.firstName2} ${activeTeacher.surname2}` : ''

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

      <div className="flex gap-4 items-start">
        {/* Calendar grid */}
        <div className="flex-1 rounded overflow-hidden">
          <div
            className="grid bg-[#dde8ee] rounded-t justify-center"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 120px))` }}
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
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 120px))` }}
          >
            {weekDates.map((date) => (
              <div key={date} className="flex flex-col items-center">
                {(slotsByDate[date] ?? []).map((slot) => {
                  const isSelected = selectedSlot?.id === slot.id
                  const isCurrentBooking = slot.id === booking?.slot?.id
                  const isBooked = slot.status === 'booked' && !isCurrentBooking
                  const isDisabled = slot.status === 'disabled'
                  const isUnavailable = isBooked || isDisabled || isCurrentBooking
                  const labelColor = (v: boolean | null | undefined) =>
                    v === false ? 'text-red-500' : 'text-green-600'
                  return (
                    <div key={slot.id} className="py-1 px-1 flex flex-col items-center gap-0.5">
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
                      {cancelHasT2 && (
                        <div className="flex gap-1">
                          <span
                            className={`text-[8px] font-semibold leading-none ${labelColor(slot.teacher1Present)}`}
                            title={`T1 – ${cancelT1Name}: ${slot.teacher1Present === true ? 'anwesend' : 'abwesend'}`}
                          >T1</span>
                          <span
                            className={`text-[8px] font-semibold leading-none ${labelColor(slot.teacher2Present)}`}
                            title={`T2 – ${cancelT2Name}: ${slot.teacher2Present === true ? 'anwesend' : 'abwesend'}`}
                          >T2</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
            {weekDates.every((date) => !(slotsByDate[date]?.length)) && (
              <div className="col-span-full py-6 text-center text-sm text-gray-400">Keine freien Termine verfügbar.</div>
            )}
          </div>
        </div>

        {/* Legend — side panel */}
        <div className="w-48 shrink-0 text-xs border border-gray-200 rounded-lg p-3 space-y-3">
          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Legende</p>

          <div>
            <p className="font-medium text-gray-500 mb-1">Verfügbarkeit</p>
            <div className="space-y-1 text-gray-700">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500 shrink-0" />Ihr Termin</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#90caf9] shrink-0" />verfügbar</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#f5a623] shrink-0" />gebucht</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-300 shrink-0" />blockiert</span>
            </div>
          </div>

          {cancelHasT2 && activeTeacher && (
            <>
              <div className="border-t border-gray-100 pt-2">
                <p className="font-medium text-gray-500 mb-1">Lehrkräfte</p>
                <div className="space-y-1 text-gray-700">
                  <div className="leading-snug">
                    <span className="font-medium">T1</span>
                    <br /><span className="text-gray-500">{cancelT1Name}</span>
                  </div>
                  <div className="leading-snug">
                    <span className="font-medium">T2</span>
                    <br /><span className="text-gray-500">{cancelT2Name}</span>
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

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
        <img src="/logo.png" alt="WahlWeise" className="h-8 w-auto object-contain" />
        <span className="text-base text-gray-500">Termin verwalten</span>
        <span className="text-sm text-gray-400" />
      </header>

      <main className={`flex-1 px-6 py-10 w-full mx-auto ${mode === 'reschedule' ? 'max-w-4xl' : 'max-w-xl'}`}>
        {isLoading && <p className="text-sm text-gray-400 text-center">Lade Buchungsdetails…</p>}

        {isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-medium">Buchung nicht gefunden.</p>
            <p className="text-sm text-gray-500 mt-2">Der Link ist möglicherweise abgelaufen oder ungültig.</p>
          </div>
        )}

        {/* Cancelled */}
        {cancelled && (
          <div className="bg-[#dde8ee] rounded-lg p-6 text-center">
            <p className="font-bold text-gray-800 text-base mb-2">Termin abgesagt</p>
            <p className="text-sm text-gray-600">Ihr Termin wurde erfolgreich abgesagt. Sie erhalten eine Bestätigung per E-Mail.</p>
          </div>
        )}

        {/* Rescheduled */}
        {rescheduled && (
          <div className="bg-[#dde8ee] rounded-lg p-6 text-center">
            <p className="font-bold text-gray-800 text-base mb-2">Termin geändert</p>
            <p className="text-sm text-gray-600">
              Ihr neuer Termin wurde bestätigt: <strong>{selectedSlot?.date}</strong> um <strong>{selectedSlot?.time} Uhr</strong>.
            </p>
          </div>
        )}

        {booking && !cancelled && !rescheduled && (
          <>
            {/* Booking details card */}
            <div className="bg-[#dde8ee] rounded-lg p-6 mb-6">
              <p className="font-bold text-gray-800 mb-4">Ihre Buchungsdetails</p>
              <div className="space-y-1 text-sm text-gray-700">
                <p><span className="text-gray-500">Veranstaltung:</span> {booking.event.name}</p>
                {booking.slot && (
                  <>
                    <p><span className="text-gray-500">Lehrkraft:</span> {booking.slot.teacher.salutation} {booking.slot.teacher.surname}</p>
                    {booking.slot.teacher.roomNo && (
                      <p><span className="text-gray-500">Raum:</span> {booking.slot.teacher.roomNo}</p>
                    )}
                    <p><span className="text-gray-500">Datum:</span> {booking.slot.date}</p>
                    <p><span className="text-gray-500">Zeit:</span> {booking.slot.time}</p>
                  </>
                )}
                <p><span className="text-gray-500">Name:</span> {booking.parentFirstName} {booking.parentSurname}</p>
              </div>
            </div>

            {booking.status === 'CANCELLED' ? (
              <div className="bg-gray-100 rounded-lg p-6 text-center">
                <p className="text-gray-600 font-medium">Diese Buchung wurde bereits abgesagt.</p>
              </div>
            ) : mode === 'view' ? (
              <>
                {cancelError && <p className="text-sm text-red-500 mb-4 text-center">{cancelError}</p>}
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={handleEnterReschedule}
                    className="py-3 px-10 rounded border border-[#1565c0] text-[#1565c0] text-xs tracking-widest uppercase font-medium hover:bg-[#dde8ee] transition-colors cursor-pointer"
                  >
                    TERMIN ÄNDERN
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={cancelling}
                    className="py-3 px-10 rounded bg-red-600 text-white text-xs tracking-widest uppercase font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {cancelling ? '…' : 'TERMIN ABSAGEN'}
                  </button>
                </div>
              </>
            ) : (
              // Reschedule mode — teacher picker + slot calendar
              (() => {
                const hasAbsentWarning = !!selectedSlot && cancelHasT2 &&
                  ((selectedSlot.teacher1Present === false && selectedSlot.teacher2Present !== false) ||
                   (selectedSlot.teacher2Present === false && selectedSlot.teacher1Present !== false))
                const absentName = selectedSlot?.teacher1Present === false
                  ? cancelT1Name
                  : cancelT2Name
                const AbsentWarning = () => hasAbsentWarning ? (
                  <div className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-4 py-2">
                    Hinweis: <strong>{absentName}</strong> ist für diesen Termin abwesend. Der Termin ist trotzdem buchbar.
                  </div>
                ) : null
                return <>
                <h2 className="font-bold text-gray-800 mb-4">Neuen Termin wählen</h2>
                {rescheduleError && <p className="text-sm text-red-500 mb-3">{rescheduleError}</p>}

                {/* Two-panel layout on desktop */}
                <div className="hidden sm:flex gap-8">
                  {/* Teacher list */}
                  <div className="w-44 flex-shrink-0">
                    <p className="text-sm text-gray-600 mb-3">Lehrkraft wählen:</p>
                    <div className="space-y-1">
                      {teachers.map((t) => {
                        const isCurrentTeacher = t.id === booking?.slot?.teacher?.id
                        return (
                          <button
                            key={t.id}
                            onClick={() => handleTeacherSelect(t.id)}
                            className={`w-full text-left text-sm px-2 py-1.5 rounded cursor-pointer transition-colors ${
                              activeTeacherId === t.id
                                ? 'bg-[#dde8ee] text-[#1565c0] font-semibold'
                                : 'text-gray-500 hover:bg-[#eef4f7] hover:text-gray-800'
                            }`}
                          >
                            <span className="block leading-tight">{t.salutation} {t.firstName} {t.surname}</span>
                            {t.firstName2 && t.surname2 && (
                              <span className="block leading-tight text-xs opacity-75">{t.salutation2} {t.firstName2} {t.surname2}</span>
                            )}
                            {isCurrentTeacher && (
                              <span className="text-[10px] text-green-600 font-semibold leading-none">Ihr Termin</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Calendar */}
                  <div className="flex-1">
                    {CalendarGrid()}
                    <AbsentWarning />
                  </div>
                </div>

                {/* Mobile: stacked */}
                <div className="sm:hidden">
                  <p className="text-sm text-gray-600 mb-2">Lehrkraft wählen:</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {teachers.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleTeacherSelect(t.id)}
                        className={`text-left text-sm px-3 py-1.5 rounded border cursor-pointer transition-colors ${
                          activeTeacherId === t.id
                            ? 'border-[#1565c0] bg-[#dde8ee] text-[#1565c0] font-semibold'
                            : 'border-gray-300 text-gray-600 hover:border-[#1565c0]'
                        }`}
                      >
                        <span className="block leading-tight">{t.salutation} {t.firstName} {t.surname}</span>
                        {t.firstName2 && t.surname2 && (
                          <span className="block leading-tight text-xs opacity-75">{t.salutation2} {t.firstName2} {t.surname2}</span>
                        )}
                        {t.id === booking?.slot?.teacher?.id && (
                          <span className="block text-[10px] text-green-600 font-semibold leading-none mt-0.5">Ihr Termin</span>
                        )}
                      </button>
                    ))}
                  </div>
                  {CalendarGrid()}
                  <AbsentWarning />
                </div>

                <div className="flex justify-between mt-6 gap-3">
                  <button
                    onClick={() => { setMode('view'); setSelectedSlot(null); setCurrentWeekOffset(0) }}
                    className="py-3 px-8 rounded border border-gray-300 text-gray-600 text-xs tracking-widest uppercase font-medium hover:bg-gray-50 transition-colors cursor-pointer"
                  >
                    ZURÜCK
                  </button>
                  <button
                    onClick={handleReschedule}
                    disabled={!selectedSlot || rescheduling}
                    className="py-3 px-8 rounded bg-[#1565c0] text-white text-xs tracking-widest uppercase font-medium hover:bg-[#0d47a1] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {rescheduling ? '…' : 'TERMIN BESTÄTIGEN'}
                  </button>
                </div>
              </>
              })()
            )}
          </>
        )}
      </main>

      <footer className="px-6 py-4">
        <span className="text-sm text-gray-400" />
      </footer>
    </div>
  )
}
