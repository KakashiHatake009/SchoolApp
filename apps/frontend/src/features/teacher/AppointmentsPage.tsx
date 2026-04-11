import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { bookingService } from '@/services/bookingService'
import { teacherService } from '@/services/teacherService'
import { eventService } from '@/services/eventService'
import { useSetPageTitle } from '@/context/PageTitleContext'

export default function TeacherAppointmentsPage() {
  useSetPageTitle('Meine Termine')
  const user = useAuthStore((s) => s.user)
  const teacherId = user?.teacherId ?? ''

  const { data: teacher } = useQuery({
    queryKey: ['teacher', teacherId],
    queryFn: () => teacherService.getById(teacherId),
    enabled: !!teacherId,
  })

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ['bookings-teacher', teacherId],
    queryFn: () => bookingService.getByTeacher(teacherId),
    enabled: !!teacherId,
  })

  const { data: slots = [] } = useQuery({
    queryKey: ['slots-teacher', teacherId],
    queryFn: () => bookingService.getSlotsByTeacher(teacherId),
    enabled: !!teacherId,
  })

  const { data: event } = useQuery({
    queryKey: ['event', teacher?.eventId],
    queryFn: () => eventService.getById(teacher!.eventId),
    enabled: !!teacher,
  })

  const totalSlots = slots.length
  const bookedSlots = slots.filter((s) => s.status === 'booked').length
  const freeSlots = totalSlots - bookedSlots

  // Build enriched list: slot time + booking info
  const bookedList = bookings.map((b) => {
    const slot = slots.find((s) => s.id === b.slotId)
    return { ...b, time: slot?.time ?? '—', date: slot?.date ?? '—' }
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-800">
          Appointments for: {user?.name}
        </h1>
        {event && (
          <p className="text-sm text-gray-500 mt-1">
            {event.name} · {event.date} · {event.startTime}–{event.endTime}
          </p>
        )}
      </div>

      {/* Summary */}
      <div className="flex gap-4 text-sm text-gray-600 bg-white rounded-xl border border-gray-200 px-5 py-3">
        <span>Total appointments: <strong>{totalSlots}</strong></span>
        <span className="text-gray-300">|</span>
        <span>Booked: <strong>{bookedSlots}</strong></span>
        <span className="text-gray-300">|</span>
        <span>Free: <strong>{freeSlots}</strong></span>
      </div>

      {/* Appointments table */}
      {isLoading ? (
        <p className="text-gray-400 text-sm">Loading…</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#cfd8dc] text-gray-700">
                {['Time', 'Slts.', 'Parent', 'Child', 'Class', 'Phone', 'Email', 'No. of persons', 'Note'].map(
                  (h) => <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>,
                )}
              </tr>
            </thead>
            <tbody>
              {bookedList.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                    No appointments booked yet.
                  </td>
                </tr>
              )}
              {bookedList.map((b, i) => (
                <tr key={b.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-3 font-medium text-gray-800">{b.time}</td>
                  <td className="px-4 py-3 text-gray-600">{b.salutation}</td>
                  <td className="px-4 py-3 text-gray-800">{b.parentSurname}</td>
                  <td className="px-4 py-3 text-gray-600">{b.childName}</td>
                  <td className="px-4 py-3 text-gray-600">{b.childClass}</td>
                  <td className="px-4 py-3 text-gray-600">{b.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{b.parentEmail}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{b.numberOfPersons}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{b.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
