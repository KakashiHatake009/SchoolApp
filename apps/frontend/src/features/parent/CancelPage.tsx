import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

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

const publicFetch = async <T,>(path: string, options?: RequestInit): Promise<T> => {
  const res = await fetch(`/api${path}`, {
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
  const slotsByDateAndTime: Record<string, Record<string, AppointmentSlot>> = {}
  for (const s of teacherSlots) {
    if (!slotsByDateAndTime[s.date]) slotsByDateAndTime[s.date] = {}
    slotsByDateAndTime[s.date][s.time] = s
  }
  const allTimes = [...new Set(teacherSlots.map((s) => s.time))].sort()
  const cols = Math.max(weekDates.length, 1)

  const getMonthLabel = () => {
    if (!weekDates[0]) return ''
    return new Date(weekDates[0]).toLocaleString('de-DE', { month: 'long', year: 'numeric' })
  }

  const CalendarGrid = () => (
    <>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setCurrentWeekOffset((w) => Math.max(0, w - 1))} className="text-gray-500 hover:text-gray-800 cursor-pointer text-xl px-2">‹</button>
        <span className="text-sm text-gray-700 font-medium">{getMonthLabel()}</span>
        <button onClick={() => setCurrentWeekOffset((w) => w + 1)} className="text-gray-500 hover:text-gray-800 cursor-pointer text-xl px-2">›</button>
      </div>

      <div className="grid border border-b-0 border-gray-200 rounded-t overflow-hidden bg-[#dde8ee]"
        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
        {weekDates.map((date) => {
          const d = new Date(date)
          const di = d.getDay() === 0 ? 6 : d.getDay() - 1
          return (
            <div key={date} className="text-center py-2 text-xs font-medium text-gray-700 border-r border-gray-200 last:border-r-0">
              <div>{DAY_SHORT[di]}</div>
              <div>{d.getDate()}</div>
            </div>
          )
        })}
      </div>

      <div className="border border-gray-200 rounded-b overflow-y-auto max-h-72">
        {allTimes.map((time) => (
          <div key={time} className="grid border-b border-gray-100 last:border-b-0"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
            {weekDates.map((date) => {
              const slot = slotsByDateAndTime[date]?.[time]
              if (!slot) return <div key={date} className="border-r border-gray-100 last:border-r-0 p-1" />
              const isSelected = selectedSlot?.id === slot.id
              const isCurrentBooking = slot.id === booking?.slot?.id
              const isBooked = slot.status === 'booked' && !isCurrentBooking
              const isDisabled = slot.status === 'disabled'
              const isUnavailable = isBooked || isDisabled || isCurrentBooking
              const activeTeacher = teachers.find((t) => t.id === activeTeacherId)
              const hasT2 = !!(activeTeacher?.firstName2 && activeTeacher?.surname2)
              const dotColor = (v: boolean | null | undefined) =>
                v === true ? 'bg-green-400' : v === false ? 'bg-red-400' : 'bg-gray-300'
              const dotTitle = (tag: string, name: string, v: boolean | null | undefined) =>
                `${tag} – ${name}: ${v === true ? 'anwesend' : v === false ? 'abwesend' : 'nicht geantwortet'}`
              return (
                <div key={slot.id} className="border-r border-gray-100 last:border-r-0 p-1 flex flex-col items-center justify-center gap-0.5">
                  <button
                    disabled={isUnavailable}
                    onClick={() => !isUnavailable && setSelectedSlot(isSelected ? null : slot)}
                    title={isCurrentBooking ? 'Ihr aktueller Termin' : isBooked ? 'Bereits gebucht' : isDisabled ? 'Nicht verfügbar' : 'Termin wählen'}
                    className={`text-xs rounded px-2 py-0.5 font-medium transition-colors whitespace-nowrap ${
                      isSelected
                        ? 'bg-[#2d6a9f] text-white cursor-pointer'
                        : isCurrentBooking
                        ? 'bg-green-500 text-white cursor-not-allowed'
                        : isBooked
                        ? 'bg-[#f5a623] text-white cursor-not-allowed'
                        : isDisabled
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-[#90caf9] text-[#0d47a1] hover:bg-[#64b5f6] cursor-pointer'
                    }`}
                  >
                    {time}
                  </button>
                  {isCurrentBooking && (
                    <span className="text-[10px] text-green-600 font-semibold leading-none">Ihr Termin</span>
                  )}
                  {hasT2 && !isUnavailable && (
                    <div className="flex gap-0.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor(slot.teacher1Present)}`}
                        title={dotTitle('T1', `${activeTeacher?.salutation} ${activeTeacher?.firstName} ${activeTeacher?.surname}`, slot.teacher1Present)} />
                      <span className={`w-1.5 h-1.5 rounded-full ${dotColor(slot.teacher2Present)}`}
                        title={dotTitle('T2', `${activeTeacher?.salutation2} ${activeTeacher?.firstName2} ${activeTeacher?.surname2}`, slot.teacher2Present)} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
        {allTimes.length === 0 && (
          <div className="py-6 text-center text-sm text-gray-400">Keine freien Termine verfügbar.</div>
        )}
      </div>

      {(() => {
        const activeTeacher = teachers.find((t) => t.id === activeTeacherId)
        const hasT2 = !!(activeTeacher?.firstName2 && activeTeacher?.surname2)
        return (
          <div className="mt-2 text-xs space-y-2">
            <div className="flex flex-wrap gap-4 justify-center">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-green-500 inline-block" />Ihr Termin</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#90caf9] inline-block" />verfügbar</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#f5a623] inline-block" />gebucht</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-300 inline-block" />blockiert</span>
            </div>
            {hasT2 && activeTeacher && (
              <div className="border-t border-gray-100 pt-2 space-y-1">
                {([
                  { tag: 'T1', name: `${activeTeacher.salutation} ${activeTeacher.firstName} ${activeTeacher.surname}` },
                  { tag: 'T2', name: `${activeTeacher.salutation2} ${activeTeacher.firstName2} ${activeTeacher.surname2}` },
                ] as const).map(({ tag, name }) => (
                  <div key={tag} className="flex flex-wrap items-center gap-x-3 gap-y-1 justify-center">
                    <span className="text-gray-500 font-medium">{tag} – {name}:</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />anwesend</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" />abwesend</span>
                    <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" />nicht geantwortet</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })()}
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
                    className="py-3 px-10 rounded border border-[#2d6a9f] text-[#2d6a9f] text-xs tracking-widest uppercase font-medium hover:bg-[#dde8ee] transition-colors cursor-pointer"
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
              <>
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
                                ? 'bg-[#dde8ee] text-[#2d6a9f] font-semibold'
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
                            ? 'border-[#2d6a9f] bg-[#dde8ee] text-[#2d6a9f] font-semibold'
                            : 'border-gray-300 text-gray-600 hover:border-[#2d6a9f]'
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
                    className="py-3 px-8 rounded bg-[#2d6a9f] text-white text-xs tracking-widest uppercase font-medium hover:bg-[#245a8a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {rescheduling ? '…' : 'TERMIN BESTÄTIGEN'}
                  </button>
                </div>
              </>
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
