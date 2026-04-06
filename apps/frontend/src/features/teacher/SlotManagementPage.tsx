import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { bookingService } from '@/services/bookingService'
import { teacherService } from '@/services/teacherService'
import { eventService } from '@/services/eventService'
import { Button } from '@/components/ui/Button'

export default function SlotManagementPage() {
  const user = useAuthStore((s) => s.user)
  const teacherId = user?.teacherId ?? ''
  const qc = useQueryClient()
  const [saved, setSaved] = useState(false)

  const { data: teacher } = useQuery({
    queryKey: ['teacher', teacherId],
    queryFn: () => teacherService.getById(teacherId),
    enabled: !!teacherId,
  })

  const { data: event } = useQuery({
    queryKey: ['event', teacher?.eventId],
    queryFn: () => eventService.getById(teacher!.eventId),
    enabled: !!teacher,
  })

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['slots-teacher', teacherId],
    queryFn: () => bookingService.getSlotsByTeacher(teacherId),
    enabled: !!teacherId,
  })

  const toggleMut = useMutation({
    mutationFn: (slotId: string) => bookingService.toggleSlot(slotId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['slots-teacher', teacherId] })
      setSaved(false)
    },
  })

  // Group slots by date, then sort by time within each date
  const grouped = slots.reduce<Record<string, typeof slots>>((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = []
    acc[slot.date].push(slot)
    return acc
  }, {})

  const dates = Object.keys(grouped).sort()

  // Build time rows: all unique times across all dates
  const allTimes = [...new Set(slots.map((s) => s.time))].sort()

  const teacherName = teacher ? `${teacher.salutation} ${teacher.surname}` : '—'
  const eventInfo = event ? `${event.name} · ${event.date} · ${event.startTime}–${event.endTime}` : ''

  return (
    <div>
      <div className="mb-4">
        <p className="font-bold text-gray-800">
          Anpassung der Zeitfenster — {teacherName}
        </p>
        {eventInfo && <p className="text-sm text-gray-500 mt-0.5">{eventInfo}</p>}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-6 mb-4 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[#1565c0]" />
          <span>Verfügbar</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-gray-200" />
          <span>Deaktiviert</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded bg-[#e07b2e]" />
          <span>Gebucht</span>
        </div>
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Lädt…</p>
      ) : slots.length === 0 ? (
        <p className="text-gray-400 text-sm">Keine Zeitfenster gefunden.</p>
      ) : (
        <div className="border border-gray-200 rounded overflow-hidden mb-6">
          <table className="text-sm">
            <thead>
              <tr className="bg-[#dde8ee] text-gray-700">
                <th className="px-4 py-3 text-left font-medium w-20">Zeit</th>
                {dates.map((date) => (
                  <th key={date} className="px-4 py-3 text-left font-medium">
                    {new Date(date).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allTimes.map((time, ri) => (
                <tr key={time} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-2 text-gray-600 font-medium">{time}</td>
                  {dates.map((date) => {
                    const slot = grouped[date]?.find((s) => s.time === time)
                    if (!slot) {
                      return <td key={date} className="px-4 py-2" />
                    }
                    const isBooked = slot.status === 'booked'
                    const isDisabled = slot.status === 'disabled'
                    return (
                      <td key={date} className="px-4 py-2">
                        <button
                          disabled={isBooked || toggleMut.isPending}
                          onClick={() => toggleMut.mutate(slot.id)}
                          className={`w-8 h-8 rounded text-xs font-medium transition-colors
                            ${isBooked
                              ? 'bg-[#e07b2e] text-white cursor-not-allowed'
                              : isDisabled
                              ? 'bg-gray-200 text-gray-400 hover:bg-gray-300 cursor-pointer'
                              : 'bg-[#1565c0] text-white hover:bg-[#3a7a9e] cursor-pointer'
                            }`}
                          title={isBooked ? 'Gebucht – kann nicht geändert werden' : isDisabled ? 'Klicken zum Aktivieren' : 'Klicken zum Deaktivieren'}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end gap-3">
        {saved && (
          <span className="text-sm text-green-600 self-center">Gespeichert ✓</span>
        )}
        <Button
          onClick={() => setSaved(true)}
          className="px-8 py-3 text-xs tracking-widest uppercase"
        >
          SPEICHERN
        </Button>
      </div>
    </div>
  )
}
