import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AppointmentSlot } from '@/types'

type Step = 'code' | 'slots' | 'confirmed'

type TeacherSession = {
  id: string
  salutation: string
  titel?: string | null
  firstName: string
  surname: string
  salutation2?: string | null
  firstName2?: string | null
  surname2?: string | null
  klasse?: string | null
  roomNo?: string | null
}

// ── Public API helpers (no auth store token) ───────────────────────────────
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

// ── Page shell ─────────────────────────────────────────────────────────────────
function PageShell({
  schoolName,
  eventName,
  schoolLogo,
  children,
}: {
  schoolName?: string
  eventName?: string
  schoolLogo?: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
        <img src="/logo.png" alt="WahlWeise" className="h-8 w-auto object-contain shrink-0" />
        <span className="text-base text-gray-500">Anpassung der Zeitfenster</span>
        <span className="text-sm text-gray-400 cursor-pointer hover:text-gray-600">Language</span>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-4 sm:py-6 w-full max-w-5xl mx-auto">
        {schoolName && (
          <div className="flex justify-between items-start mb-6">
            <p className="font-bold text-gray-800">
              <span>{schoolName}:</span>{' '}
              <span className="font-normal">{eventName}</span>
            </p>
            {schoolLogo ? (
              <img src={schoolLogo} alt={schoolName} className="w-16 h-16 rounded-full object-contain p-1 border border-gray-200 flex-shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-full border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
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

// ── Main component ─────────────────────────────────────────────────────────────
export default function TeacherManagePage() {
  const { eventId } = useParams<{ eventId: string }>()
  const [step, setStep] = useState<Step>('code')
  const [code, setCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [currentWeekOffset, setCurrentWeekOffset] = useState(0)
  const [teacherSession, setTeacherSession] = useState<{ teacher: TeacherSession; token: string; teacherIndex: 1 | 2 } | null>(null)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishError, setPublishError] = useState('')
  const qc = useQueryClient()

  // Load event + school via public endpoint (no auth needed)
  const { data: eventData } = useQuery({
    queryKey: ['public-event', eventId],
    queryFn: () => publicFetch<{ name: string; school: { name: string; logo?: string } }>(`/public/events/${eventId}`),
    enabled: !!eventId,
  })

  // Load slots for this teacher via public endpoint (requires teacher session JWT).
  const { data: slots = [] } = useQuery({
    queryKey: ['public-slots', eventId, teacherSession?.teacher.id],
    queryFn: () => publicFetch<AppointmentSlot[]>(`/public/events/${eventId}/slots`, {
      headers: { Authorization: `Bearer ${teacherSession!.token}` },
    }),
    enabled: !!eventId && !!teacherSession,
  })

  // SSE: subscribe to real-time slot updates so both teachers see each other's changes instantly
  useEffect(() => {
    if (!eventId || !teacherSession) return
    const es = new EventSource(`${API_BASE}/api/public/events/${eventId}/slot-updates`)
    es.onmessage = (e) => {
      const updatedSlot: AppointmentSlot = JSON.parse(e.data)
      qc.setQueryData(
        ['public-slots', eventId, teacherSession.teacher.id] as const,
        (old: AppointmentSlot[] | undefined) =>
          old?.map((s) => (s.id === updatedSlot.id ? updatedSlot : s)) ?? [],
      )
    }
    return () => es.close()
  }, [eventId, teacherSession?.token, qc])

  // Derived at component level so optimistic update can use them
  const myIndex = teacherSession?.teacherIndex ?? 1
  const myField = (myIndex === 1 ? 'teacher1Present' : 'teacher2Present') as 'teacher1Present' | 'teacher2Present'
  const slotsQueryKey = ['public-slots', eventId, teacherSession?.teacher.id] as const

  const toggleMut = useMutation({
    mutationFn: async (slotId: string) => {
      if (!teacherSession) throw new Error('No session')
      return publicFetch<AppointmentSlot>(`/public/slots/${slotId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${teacherSession.token}` },
      })
    },
    onMutate: async (slotId) => {
      // Cancel any in-flight refetches so they don't overwrite the optimistic update
      await qc.cancelQueries({ queryKey: slotsQueryKey })
      const previous = qc.getQueryData<AppointmentSlot[]>(slotsQueryKey)
      // Immediately update the clicked slot in cache
      qc.setQueryData(slotsQueryKey, (old: AppointmentSlot[] | undefined) =>
        old?.map((s) => {
          if (s.id !== slotId) return s
          const newVal = s[myField] === false ? null : false
          return { ...s, [myField]: newVal }
        }) ?? [],
      )
      return { previous }
    },
    onError: (_err, _slotId, context) => {
      // Roll back if the server rejected the change
      if (context?.previous) qc.setQueryData(slotsQueryKey, context.previous)
    },
    onSuccess: (updatedSlot) => {
      // Correct with the real server value (handles auto-block logic etc.)
      qc.setQueryData(slotsQueryKey, (old: AppointmentSlot[] | undefined) =>
        old?.map((s) => (s.id === updatedSlot.id ? updatedSlot : s)) ?? [],
      )
    },
  })

  const labelColor = (v: boolean | null | undefined) =>
    v === true ? 'text-green-600' : v === false ? 'text-red-500' : 'text-gray-400'

  const labelTitle = (tag: string, name: string, v: boolean | null | undefined) => {
    const state = v === true ? 'anwesend' : v === false ? 'abwesend' : 'nicht geantwortet'
    return `${tag} – ${name}: ${state}`
  }

  const schoolName = eventData?.school?.name ?? ''
  const eventName = eventData?.name ?? ''
  const schoolLogo = eventData?.school?.logo ?? ''

  // Promote null → true for own presence field in cache (mirrors what the backend does on save/publish)
  const promoteOwnSlotsInCache = () => {
    qc.setQueryData(slotsQueryKey, (old: AppointmentSlot[] | undefined) =>
      old?.map((s) => (s[myField] === null ? { ...s, [myField]: true } : s)) ?? [],
    )
  }

  const handleSave = async () => {
    if (!teacherSession) return
    setSaving(true)
    try {
      await publicFetch('/public/teachers/save', {
        method: 'POST',
        headers: { Authorization: `Bearer ${teacherSession.token}` },
      })
      promoteOwnSlotsInCache()
    } catch {
      // non-critical — proceed to confirmed regardless
    } finally {
      setSaving(false)
    }
    setStep('confirmed')
  }

  const handlePublish = async () => {
    if (!teacherSession) return
    setPublishing(true)
    setPublishError('')
    try {
      await publicFetch('/public/teachers/publish', {
        method: 'POST',
        headers: { Authorization: `Bearer ${teacherSession.token}` },
      })
      promoteOwnSlotsInCache()
      setStep('confirmed')
    } catch (err: unknown) {
      setPublishError(err instanceof Error ? err.message : 'Fehler beim Bestätigen.')
    } finally {
      setPublishing(false)
    }
  }

  // ── Step 1: Access code ────────────────────────────────────────────────────
  if (step === 'code') {
    const handleEnter = async () => {
      if (!code.trim()) {
        setCodeError('Bitte geben Sie Ihren Zugangscode ein.')
        return
      }
      setCodeLoading(true)
      setCodeError('')
      try {
        const result = await publicFetch<{ teacher: TeacherSession; token: string; teacherIndex: 1 | 2 }>(
          '/public/teachers/access',
          { method: 'POST', body: JSON.stringify({ code: code.trim(), eventId }) },
        )
        setTeacherSession(result)
        setStep('slots')
      } catch (err: unknown) {
        setCodeError(err instanceof Error ? err.message : 'Ungültiger Zugangscode.')
      } finally {
        setCodeLoading(false)
      }
    }

    return (
      <PageShell schoolName={schoolName} eventName={eventName} schoolLogo={schoolLogo}>
        <p className="text-sm text-gray-400 mb-8">
          Sie haben eine E-Mail mit Ihrem persönlichen Zugangscode erhalten. Bitte geben Sie ihn unten ein.
        </p>

        <div className="flex flex-col items-center justify-center mt-8">
          <p className="font-bold text-gray-800 text-center mb-5">
            Bitte geben Sie hier Ihren Zugangscode ein.
          </p>
          <input
            type="text"
            placeholder="Zugangscode"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleEnter() }}
            className="border border-gray-300 rounded px-4 py-2 text-sm w-full max-w-72 focus:outline-none focus:border-[#1565c0] mb-4 bg-white"
          />
          {codeError && <p className="text-xs text-red-500 mb-3">{codeError}</p>}
          <button
            onClick={handleEnter}
            disabled={codeLoading}
            className="bg-[#1565c0] text-white text-xs tracking-widest uppercase font-medium px-10 py-3 rounded hover:bg-[#0d47a1] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {codeLoading ? '…' : 'ENTER'}
          </button>
        </div>
      </PageShell>
    )
  }

  // ── Step 2: Slot management calendar ────────────────────────────────────────
  if (step === 'slots') {
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

    const hasSecondTeacher = !!(teacherSession?.teacher.firstName2 && teacherSession?.teacher.surname2)

    const t = teacherSession?.teacher
    const t1Name = [t?.salutation, t?.firstName, t?.surname].filter(Boolean).join(' ')
    const t2Name = [t?.salutation2, t?.firstName2, t?.surname2].filter(Boolean).join(' ')
    const myName = myIndex === 1 ? t1Name : t2Name
    const myTag = `T${myIndex}` as const

    const otherTag = myIndex === 1 ? 'T2' : 'T1'
    const otherName = myIndex === 1 ? t2Name : t1Name

    const slotBtn = (slot: AppointmentSlot) => {
      const isBooked = slot.status === 'booked'
      const myPresence = myIndex === 1 ? slot.teacher1Present : slot.teacher2Present
      const otherPresence = myIndex === 1 ? slot.teacher2Present : slot.teacher1Present

      // Time button colour: false = dark gray (blocked), anything else = light blue (available)
      const btnClass = isBooked
        ? 'bg-[#f5a623] text-white cursor-not-allowed'
        : hasSecondTeacher
        ? myPresence === false
          ? 'bg-gray-700 text-white hover:bg-gray-600 cursor-pointer'
          : 'bg-[#90caf9] text-[#0d47a1] hover:bg-[#64b5f6] cursor-pointer'
        : slot.status === 'disabled'
        ? 'bg-gray-700 text-white hover:bg-gray-600 cursor-pointer'
        : 'bg-[#90caf9] text-[#0d47a1] hover:bg-[#64b5f6] cursor-pointer'

      const btnTitle = isBooked
        ? 'Gebucht'
        : hasSecondTeacher
        ? myPresence === false
          ? 'Klicken zum Freigeben'
          : 'Klicken zum Blockieren'
        : slot.status === 'disabled'
        ? 'Klicken zum Aktivieren'
        : 'Klicken zum Blockieren'

      return (
        <div className="flex flex-col items-center gap-0.5">
          <button
            key={slot.id}
            disabled={isBooked || toggleMut.isPending}
            onClick={() => !isBooked && toggleMut.mutate(slot.id)}
            title={btnTitle}
            className={`text-xs rounded px-2 py-0.5 font-medium transition-colors whitespace-nowrap ${btnClass}`}
          >
            {slot.time}
          </button>
          {hasSecondTeacher && (
            <div className="flex gap-1">
              <span
                className={`text-[8px] font-semibold leading-none ${labelColor(slot.teacher1Present)}`}
                title={labelTitle('T1', t1Name, slot.teacher1Present)}
              >T1</span>
              <span
                className={`text-[8px] font-semibold leading-none ${labelColor(slot.teacher2Present)}`}
                title={labelTitle('T2', t2Name, slot.teacher2Present)}
              >T2</span>
            </div>
          )}
        </div>
      )
    }

    const teacher = teacherSession?.teacher
    const teacherName = teacher
      ? [teacher.salutation, teacher.titel, teacher.firstName, teacher.surname].filter(Boolean).join(' ')
      : ''

    return (
      <PageShell schoolName={schoolName} eventName={eventName} schoolLogo={schoolLogo}>
        {myName && (
          <p className="text-sm text-gray-500 mb-4">
            Eingeloggt als: <span className="font-semibold text-gray-700">{myName}</span>
            {hasSecondTeacher && <span className="ml-2 text-gray-400">({myTag} von 2 Lehrkräften)</span>}
            {teacher?.klasse && <span className="ml-2 text-gray-400">Klasse {teacher.klasse}</span>}
            {teacher?.roomNo && <span className="ml-2 text-gray-400">Raum {teacher.roomNo}</span>}
          </p>
        )}

        <h2 className="font-bold text-gray-800 mb-1">Zeitfenster bearbeiten</h2>
        <p className="text-sm text-gray-500 mb-5">
          Wählen Sie die Zeitfenster aus, die Sie blocken wollen.
        </p>

        {/* Week navigation */}
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

        {/* Calendar + Legend side by side */}
        <div className="flex flex-col sm:flex-row gap-4 items-start mb-8">

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
                  {(slotsByDate[date] ?? []).map((slot) => (
                    <div key={slot.id} className="py-1.5 px-1">
                      {slotBtn(slot)}
                    </div>
                  ))}
                </div>
              ))}
              {weekDates.every((date) => !(slotsByDate[date]?.length)) && (
                <div className="col-span-full py-6 text-center text-sm text-gray-400">Keine Zeitfenster vorhanden.</div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="hidden sm:block w-48 shrink-0 text-xs border border-gray-200 rounded-lg p-3 space-y-3">
            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Legende</p>

            {hasSecondTeacher ? (
              <>
                <div>
                  <p className="font-medium text-gray-500 mb-1">Lehrkräfte</p>
                  <div className="space-y-1 text-gray-700">
                    <div className="leading-snug">
                      <span className="font-medium">T1</span>
                      {myIndex === 1 && <span className="text-[#1565c0] ml-1">(Sie)</span>}
                      <br /><span className="text-gray-500">{t1Name}</span>
                    </div>
                    <div className="leading-snug">
                      <span className="font-medium">T2</span>
                      {myIndex === 2 && <span className="text-[#1565c0] ml-1">(Sie)</span>}
                      <br /><span className="text-gray-500">{t2Name}</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-2">
                  <p className="font-medium text-gray-500 mb-1">Ihre Verfügbarkeit</p>
                  <div className="space-y-1 text-gray-700">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#90caf9] shrink-0" />verfügbar</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-700 shrink-0" />blockiert</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#f5a623] shrink-0" />gebucht</span>
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-2">
                  <p className="font-medium text-gray-500 mb-1">Status der Lehrkräfte</p>
                  <div className="space-y-1 text-gray-700">
                   <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#16A34A] shrink-0" />anwesend</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#EF4444] shrink-0" />abwesend</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#9CA3AF] shrink-0" />nicht geantwortet</span>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <p className="font-medium text-gray-500 mb-1">Verfügbarkeit</p>
                <div className="space-y-1 text-gray-700">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#90caf9] shrink-0" />verfügbar</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-gray-700 shrink-0" />blockiert</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#f5a623] shrink-0" />gebucht</span>
                </div>
              </div>
            )}
          </div>

        </div>

        {publishError && (
          <p className="text-xs text-red-500 text-center mb-3">{publishError}</p>
        )}

        <div className="hidden sm:flex justify-end gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="border border-[#1565c0] text-[#1565c0] text-xs tracking-widest uppercase font-medium px-10 py-3 rounded hover:bg-[#dde8ee] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? '…' : 'SPEICHERN'}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="bg-[#1565c0] text-white text-xs tracking-widest uppercase font-medium px-10 py-3 rounded hover:bg-[#0d47a1] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {publishing ? '…' : 'VERÖFFENTLICHEN'}
          </button>
        </div>
        <div className="sm:hidden flex justify-between gap-4">
          <button
            onClick={() => setStep('confirmed')}
            className="flex-1 py-3 rounded border border-[#1565c0] text-[#1565c0] text-xs tracking-widest uppercase font-medium hover:bg-[#dde8ee] transition-colors"
          >
            SPEICHERN
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing}
            className="flex-1 py-3 rounded bg-[#1565c0] text-white text-xs tracking-widest uppercase font-medium hover:bg-[#0d47a1] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {publishing ? '…' : 'VERÖFFENTLICHEN'}
          </button>
        </div>
      </PageShell>
    )
  }

  // ── Step 3: Confirmation ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-100">
        <img src="/logo.png" alt="WahlWeise" className="h-8 w-auto object-contain shrink-0" />
        <span className="text-base text-gray-500">Anpassung der Zeitfenster</span>
        <span className="text-sm text-gray-400 cursor-pointer hover:text-gray-600">Language</span>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 py-10 w-full max-w-5xl mx-auto">
        <div className="bg-[#dde8ee] rounded-lg px-6 py-5 mb-8 max-w-2xl text-center">
          <p className="font-bold text-gray-800 text-base leading-relaxed">
            Ihre Zeiteinstellungen wurden aktualisiert. Sie können die Seite jetzt verlassen.
          </p>
        </div>

        <div className="flex-1" />

        <div className="flex justify-center gap-4">
          <button
            onClick={() => setStep('slots')}
            className="border border-[#1565c0] text-[#1565c0] text-xs tracking-widest uppercase font-medium px-10 py-3 rounded hover:bg-[#dde8ee] transition-colors"
          >
            VERFÜGBARKEIT ANPASSEN
          </button>
          <button
            onClick={() => window.close()}
            className="bg-[#1565c0] text-white text-xs tracking-widest uppercase font-medium px-10 py-3 rounded hover:bg-[#0d47a1] transition-colors"
          >
            FENSTER SCHLIESSEN
          </button>
        </div>
      </main>

      <footer className="px-6 py-4" />
    </div>
  )
}
