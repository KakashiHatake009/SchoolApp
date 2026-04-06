import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Copy, Link, Trash2 } from 'lucide-react'
import { schoolService } from '@/services/schoolService'
import { eventService } from '@/services/eventService'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useSetPageTitle } from '@/context/PageTitleContext'

export default function SchoolDetailPage() {
  const { schoolId } = useParams<{ schoolId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [deleteSchool, setDeleteSchool] = useState(false)
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null)

  const { data: school, isLoading } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => schoolService.getById(schoolId!),
    enabled: !!schoolId,
  })

  const { data: events = [] } = useQuery({
    queryKey: ['events', schoolId],
    queryFn: () => eventService.getBySchool(schoolId!),
    enabled: !!schoolId,
  })

  const deleteSchoolMut = useMutation({
    mutationFn: () => schoolService.delete(schoolId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['schools'] }); navigate('/dashboard') },
  })

  const deleteEventMut = useMutation({
    mutationFn: (id: string) => eventService.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events', schoolId] }); setDeleteEventId(null) },
  })

  useSetPageTitle(school?.name ?? '')

  if (isLoading || !school) return <p className="text-gray-400 text-sm">Loading…</p>

  return (
    <div>
      {/* Header with school info + logo */}
      <div className="flex justify-between items-start mb-6">
        <div className="max-w-2xl">
          {school.description && (
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">{school.description}</p>
          )}
          <div className="grid grid-cols-2 gap-x-12 gap-y-1 text-sm mb-3">
            <p><span className="font-semibold">Website:</span> {school.website}</p>
            <p><span className="font-semibold">Phone:</span> {school.phone}</p>
            <p className="flex gap-1">
              <span className="font-semibold">Adress:</span>
              <span>{school.street},<br />{school.postcode} {school.city}</span>
            </p>
            <p><span className="font-semibold">Email:</span> {school.email}</p>
          </div>
          <p className="text-sm mb-1"><span className="font-semibold">Contact person:</span> {school.contactPerson}</p>
          <div className="grid grid-cols-2 gap-x-12 text-sm">
            <p><span className="font-semibold">Email:</span> {school.contactEmail}</p>
            <p><span className="font-semibold">Phone:</span> {school.contactPhone}</p>
          </div>
        </div>
        {/* Logo */}
        <div className="w-28 h-28 rounded-full border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0 overflow-hidden">
          {school.logo ? <img src={school.logo} alt={school.name} className="w-full h-full object-contain p-1" /> : 'No logo'}
        </div>
      </div>

      {/* EDIT / DELETE */}
      <div className="flex gap-3 mb-10">
        <Button onClick={() => navigate(`/schools/${schoolId}/edit`)} className="px-6 py-2 text-xs tracking-widest uppercase">
          EDIT
        </Button>
        <Button onClick={() => setDeleteSchool(true)} className="px-6 py-2 text-xs tracking-widest uppercase">
          DELETE
        </Button>
      </div>

      {/* Event overview */}
      <h2 className="text-lg font-bold text-gray-800 mb-3">Event overview</h2>

      {events.length === 0 ? (
        <div className="border border-gray-200 rounded overflow-hidden mb-4">
          <div className="bg-[#dde8ee] px-4 py-2 text-sm text-gray-700 font-medium">Event</div>
          <p className="px-4 py-4 text-sm text-gray-400">No existing events.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded overflow-hidden mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#dde8ee] text-gray-700">
                {['Schoolname ↓', 'Event ↓', 'Date ↓', 'Time', 'Booking status ↓', 'Event status ↓', 'Teachers list', 'Quickaction'].map(
                  (h) => <th key={h} className="px-4 py-2 text-left font-medium text-sm">{h}</th>,
                )}
              </tr>
            </thead>
            <tbody>
              {events.map((event, i) => (
                <tr key={event.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-4 py-3 text-gray-700">{school.name}</td>
                  <td className="px-4 py-3 text-gray-700">{event.name}</td>
                  <td className="px-4 py-3 text-gray-600">{event.date}</td>
                  <td className="px-4 py-3 text-gray-600">{event.startTime} - {event.endTime}</td>
                  <td className="px-4 py-3">
                    <Badge variant={event.status === 'published' ? 'published' : 'draft'}>
                      {event.status === 'published' ? 'Published' : 'Not yet started'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">—</td>
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/events/${event.id}`)} className="text-[#4a90b8] underline text-sm cursor-pointer">
                      View list
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-500">
                      <button onClick={() => navigate(`/events/${event.id}`)} className="hover:text-[#4a90b8] cursor-pointer"><Pencil size={15} /></button>
                      <button className="hover:text-[#4a90b8] cursor-pointer"><Copy size={15} /></button>
                      <button className="hover:text-[#4a90b8] cursor-pointer"><Link size={15} /></button>
                      <button onClick={() => setDeleteEventId(event.id)} className="hover:text-red-500 cursor-pointer"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Button onClick={() => navigate(`/events/create?schoolId=${schoolId}`)} className="px-6 py-2 text-xs tracking-widest uppercase mb-10">
        NEW EVENT
      </Button>

      <div className="flex justify-center">
        <Button onClick={() => navigate('/dashboard')} className="px-8 py-3 text-xs tracking-widest uppercase">
          BACK TO DASHBOARD
        </Button>
      </div>

      <ConfirmModal
        open={deleteSchool}
        onClose={() => setDeleteSchool(false)}
        onConfirm={() => deleteSchoolMut.mutate()}
        title="Delete school"
        message="Are you sure you want to delete this school and all of the existing events?"
        requireCheckbox
        loading={deleteSchoolMut.isPending}
      />
      <ConfirmModal
        open={deleteEventId !== null}
        onClose={() => setDeleteEventId(null)}
        onConfirm={() => deleteEventMut.mutate(deleteEventId!)}
        title="Delete event"
        message="Are you sure you want to delete this event?"
        requireCheckbox
        loading={deleteEventMut.isPending}
      />
    </div>
  )
}
