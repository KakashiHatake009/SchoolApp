import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { eventService } from '@/services/eventService'
import { teacherService } from '@/services/teacherService'
import { bookingService } from '@/services/bookingService'
import { schoolService } from '@/services/schoolService'
import { Button } from '@/components/ui/Button'
import { useSetPageTitle } from '@/context/PageTitleContext'

export default function TeacherBookingsPage() {
  const { eventId, teacherId } = useParams<{ eventId: string; teacherId: string }>()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  const { data: event } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventService.getById(eventId!),
    enabled: !!eventId,
  })

  const { data: school } = useQuery({
    queryKey: ['school', event?.schoolId],
    queryFn: () => schoolService.getById(event!.schoolId),
    enabled: !!event?.schoolId,
  })

  const { data: teacher } = useQuery({
    queryKey: ['teacher', teacherId],
    queryFn: () => teacherService.getById(teacherId!),
    enabled: !!teacherId,
  })

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings-teacher', teacherId],
    queryFn: () => bookingService.getByTeacher(teacherId!),
    enabled: !!teacherId,
  })

  const { data: slots = [] } = useQuery({
    queryKey: ['slots', teacherId],
    queryFn: () => bookingService.getSlotsByTeacher(teacherId!),
    enabled: !!teacherId,
  })

  useSetPageTitle(teacher ? `${teacher.salutation} ${teacher.surname}` : '')

  const enriched = bookings
    .map((b) => ({ ...b, time: slots.find((s) => s.id === b.slotId)?.time ?? '—' }))
    .filter((b) =>
      !search ||
      b.parentSurname.toLowerCase().includes(search.toLowerCase()) ||
      (b.childName ?? '').toLowerCase().includes(search.toLowerCase()),
    )

  const schoolName = school?.name ?? '—'
  const eventName = event?.name ?? '—'
  const teacherName = teacher ? `${teacher.salutation} ${teacher.surname}` : '—'

  return (
    <div>
      <p className="font-bold text-gray-800 mb-4">
        {schoolName}: Event "{eventName}" - {teacherName}
      </p>

      <div className="flex items-center gap-3 mb-4">
        <h2 className="font-bold text-gray-800">Bookings</h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="search"
          className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#1565c0] w-48"
        />
      </div>

      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="border border-gray-200 rounded overflow-hidden mb-8">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#dde8ee] text-gray-700">
                {['Time', 'Slts.', 'Parent ↓', 'Child ↓', 'Class', 'Phone', 'Email', 'No. of persons', 'Note'].map(
                  (h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>,
                )}
              </tr>
            </thead>
            <tbody>
              {enriched.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">No bookings yet.</td></tr>
              )}
              {enriched.map((b, i) => (
                <tr key={b.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{b.time}</td>
                  <td className="px-4 py-3 text-gray-600">{b.salutation}</td>
                  <td className="px-4 py-3 text-gray-800">{b.parentSurname}</td>
                  <td className="px-4 py-3 text-gray-600">{b.childName}</td>
                  <td className="px-4 py-3 text-gray-600">{b.childClass}</td>
                  <td className="px-4 py-3 text-gray-600">{b.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{b.parentEmail}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{b.numberOfPersons}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{b.note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between">
        <Button onClick={() => navigate(`/events/${eventId}`)} className="px-8 py-3 text-xs tracking-widest uppercase">
          BACK
        </Button>
        <Button className="px-8 py-3 text-xs tracking-widest uppercase">
          DOWNLOAD BOOKINGS
        </Button>
      </div>
    </div>
  )
}
