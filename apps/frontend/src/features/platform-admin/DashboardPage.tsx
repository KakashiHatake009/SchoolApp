import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Plus } from 'lucide-react'
import { Pencil, Copy, Link, Trash2 } from 'lucide-react'
import { schoolService } from '@/services/schoolService'
import { eventService } from '@/services/eventService'
import { useSetPageTitle } from '@/context/PageTitleContext'
import { Badge } from '@/components/ui/Badge'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { eventService as es } from '@/services/eventService'

export default function DashboardPage() {
  useSetPageTitle('Dashboard')
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [schoolSearch, setSchoolSearch] = useState('')
  const [eventSearch, setEventSearch] = useState('')
  const [deleteEventId, setDeleteEventId] = useState<string | null>(null)
  const [linkCopiedId, setLinkCopiedId] = useState<string | null>(null)

  const { data: schools = [] } = useQuery({
    queryKey: ['schools'],
    queryFn: () => schoolService.getAll(),
  })

  const { data: events = [] } = useQuery({
    queryKey: ['events-all'],
    queryFn: () => eventService.getAll(),
  })

  const filteredSchools = schools.filter((s) =>
    s.name.toLowerCase().includes(schoolSearch.toLowerCase()),
  )

  const filteredEvents = events.filter(
    (e) =>
      e.name.toLowerCase().includes(eventSearch.toLowerCase()) ||
      schools.find((s) => s.id === e.schoolId)?.name.toLowerCase().includes(eventSearch.toLowerCase()),
  )

  const duplicateMut = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => es.duplicate(id, `${name} (Copy)`),
    onSuccess: (newEvent) => {
      qc.invalidateQueries({ queryKey: ['events-all'] })
      navigate(`/events/${newEvent.id}`)
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => es.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events-all'] }); setDeleteEventId(null) },
  })

  const copyLink = (e: { id: string; link?: string }) => {
    navigator.clipboard.writeText(e.link ?? `${window.location.origin}/book/${e.id}`)
    setLinkCopiedId(e.id)
    setTimeout(() => setLinkCopiedId(null), 2000)
  }

  const getSchoolName = (schoolId: string) =>
    schools.find((s) => s.id === schoolId)?.name ?? '—'

  return (
    <div className="space-y-10">
      {/* ── Schools section ─────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Schools</h2>
          <button
            onClick={() => navigate('/schools/create')}
            className="flex items-center gap-1 bg-[#1565c0] text-white text-sm px-3 py-1.5 rounded-full hover:bg-[#3a7a9e] transition-colors cursor-pointer font-medium"
          >
            <Plus size={14} /> add
          </button>
          <input
            value={schoolSearch}
            onChange={(e) => setSchoolSearch(e.target.value)}
            placeholder="search"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#1565c0] w-48"
          />
        </div>

        {/* School cards */}
        {filteredSchools.length === 0 ? (
          <p className="text-sm text-gray-400">No schools found.</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {filteredSchools.map((school) => (
              <div
                key={school.id}
                onClick={() => navigate(`/schools/${school.id}`)}
                className="w-44 border border-gray-200 rounded-lg overflow-hidden cursor-pointer hover:border-[#1565c0] hover:shadow-sm transition-all"
              >
                {/* Logo area */}
                <div className="h-28 bg-gray-100 flex items-center justify-center overflow-hidden">
                  {school.logo ? (
                    <img src={school.logo} alt={school.name} className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-400 text-xs">
                      No logo
                    </div>
                  )}
                </div>
                <div className="p-2 flex items-end justify-between">
                  <p className="text-xs font-medium text-gray-800 leading-tight">{school.name}</p>
                  <ArrowRight size={14} className="text-gray-500 flex-shrink-0 ml-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Upcoming events section ──────────────────────────────────────── */}
      <section>
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-2xl font-bold text-gray-800">Upcoming events</h2>
          <input
            value={eventSearch}
            onChange={(e) => setEventSearch(e.target.value)}
            placeholder="search"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#1565c0] w-48"
          />
        </div>

        <div className="border border-gray-200 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#dde8ee] text-gray-700">
                {['Schoolname ↓', 'Event ↓', 'Date ↓', 'Time', 'Booking status ↓', 'Event status ↓', 'Teachers list', 'Quickaction'].map(
                  (h) => <th key={h} className="px-4 py-3 text-left font-medium text-sm">{h}</th>,
                )}
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-gray-400">
                    No existing events.
                  </td>
                </tr>
              )}
              {filteredEvents.map((event, i) => (
                <tr
                  key={event.id}
                  className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                >
                  <td className="px-4 py-3 text-gray-700">{getSchoolName(event.schoolId)}</td>
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
                    <button
                      onClick={() => navigate(`/events/${event.id}`)}
                      className="text-[#1565c0] underline text-sm hover:text-[#3a7a9e] cursor-pointer"
                    >
                      View list
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-gray-500">
                      <button title="Edit" onClick={() => navigate(`/events/${event.id}`)} className="hover:text-[#1565c0] cursor-pointer"><Pencil size={15} /></button>
                      <button title="Duplicate" onClick={() => duplicateMut.mutate({ id: event.id, name: event.name })} className="hover:text-[#1565c0] cursor-pointer"><Copy size={15} /></button>
                      <button title="Copy link" onClick={() => copyLink(event)} className={`cursor-pointer ${linkCopiedId === event.id ? 'text-green-500' : 'hover:text-[#1565c0]'}`}><Link size={15} /></button>
                      <button title="Delete" onClick={() => setDeleteEventId(event.id)} className="hover:text-red-500 cursor-pointer"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal
        open={deleteEventId !== null}
        onClose={() => setDeleteEventId(null)}
        onConfirm={() => deleteMut.mutate(deleteEventId!)}
        title="Delete event"
        message="Are you sure you want to delete this event?"
        requireCheckbox
        loading={deleteMut.isPending}
      />
    </div>
  )
}
