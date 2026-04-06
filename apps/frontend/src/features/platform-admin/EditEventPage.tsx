import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { MoreVertical } from 'lucide-react'
import { eventService } from '@/services/eventService'
import { Button } from '@/components/ui/Button'
import { useSetPageTitle } from '@/context/PageTitleContext'

const SESSION_OPTS = ['5', '10', '15', '20', '30'].map((v) => ({ value: v, label: `${v} minutes` }))
const BREAK_OPTS = ['0', '5', '10', '15'].map((v) => ({ value: v, label: v === '0' ? 'No break' : `${v} minutes` }))

const Field = ({ placeholder, value, onChange, type = 'text', className = '' }: {
  placeholder: string; value: string; onChange: (v: string) => void; type?: string; className?: string
}) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`border border-[gray-300] rounded px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#1565c0] w-full ${className}`}
  />
)

const FSelect = ({ placeholder, value, onChange, options }: {
  placeholder: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="border border-[gray-300] rounded px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-[#1565c0] w-full bg-white"
  >
    <option value="">{placeholder}</option>
    {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
)

interface Timeframe { date: string; startTime: string; endTime: string }

export default function EditEventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventService.getById(eventId!),
    enabled: !!eventId,
  })

  useSetPageTitle(event?.name ?? '')

  const [form, setForm] = useState({
    name: '', description: '',
    sessionLength: '', breakLength: '',
  })

  const [timeframes, setTimeframes] = useState<Timeframe[]>([])
  const [showTfForm, setShowTfForm] = useState(false)
  const [tfForm, setTfForm] = useState<Timeframe>({ date: '', startTime: '', endTime: '' })
  const [editingTfIdx, setEditingTfIdx] = useState<number | null>(null)
  const [openMenuIdx, setOpenMenuIdx] = useState<number | null>(null)
  const [tfError, setTfError] = useState('')
  const [tfAttempted, setTfAttempted] = useState(false)

  useEffect(() => {
    if (event) {
      setForm({
        name: event.name ?? '',
        description: event.description ?? '',
        sessionLength: String(event.sessionLength ?? ''),
        breakLength: String(event.breakLength ?? ''),
      })
      // Load days from EventDay records; fall back to event.date if no days yet
      if (event.days && event.days.length > 0) {
        setTimeframes(event.days.map((d) => ({ date: d.date, startTime: d.startTime, endTime: d.endTime })))
      } else if (event.date) {
        setTimeframes([{ date: event.date, startTime: event.startTime, endTime: event.endTime }])
      }
    }
  }, [event])

  const ff = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }))

  const addOrUpdateTimeframe = () => {
    setTfAttempted(true)
    if (!tfForm.date || !tfForm.startTime || !tfForm.endTime) return
    const todayStr = new Date().toISOString().split('T')[0]
    if (tfForm.date === todayStr) {
      const [sh, sm] = tfForm.startTime.split(':').map(Number)
      const start = new Date(); start.setHours(sh, sm, 0, 0)
      if (start < new Date()) { setTfError('Start time cannot be in the past.'); return }
    }
    if (tfForm.endTime <= tfForm.startTime) { setTfError('End time must be after start time.'); return }
    setTfError('')
    if (editingTfIdx !== null) {
      setTimeframes((prev) => prev.map((tf, i) => (i === editingTfIdx ? { ...tfForm } : tf)))
      setEditingTfIdx(null)
    } else {
      setTimeframes((prev) => [...prev, { ...tfForm }])
    }
    setTfAttempted(false)
    setTfForm({ date: '', startTime: '', endTime: '' })
    setShowTfForm(false)
  }

  const editTf = (i: number) => {
    setTfForm({ ...timeframes[i] })
    setEditingTfIdx(i)
    setShowTfForm(true)
    setOpenMenuIdx(null)
  }

  const deleteTf = (i: number) => {
    setTimeframes((prev) => prev.filter((_, idx) => idx !== i))
    setOpenMenuIdx(null)
  }

  const mut = useMutation({
    mutationFn: () => eventService.update(eventId!, {
      name: form.name,
      description: form.description,
      sessionLength: Number(form.sessionLength) || 10,
      breakLength: Number(form.breakLength) || 0,
      // Sync event.date/startTime/endTime with first day
      date: timeframes[0]?.date ?? event?.date ?? '',
      startTime: timeframes[0]?.startTime ?? event?.startTime ?? '',
      endTime: timeframes[0]?.endTime ?? event?.endTime ?? '',
      days: timeframes.map((t) => ({ date: t.date, startTime: t.startTime, endTime: t.endTime })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', eventId] })
      qc.invalidateQueries({ queryKey: ['events-all'] })
      navigate(`/events/${eventId}`)
    },
  })

  if (isLoading) return <p className="text-gray-400 text-sm">Loading…</p>

  return (
    <div className="max-w-2xl">
      <div className="space-y-3">
        <Field placeholder="Event title" value={form.name} onChange={ff('name')} />
        <textarea
          placeholder="Description"
          value={form.description}
          onChange={(e) => ff('description')(e.target.value)}
          rows={4}
          className="border border-[gray-300] rounded px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#1565c0] w-full"
        />

        {/* Days */}
        <div>
          <Button
            onClick={() => { setTfForm({ date: '', startTime: '', endTime: '' }); setEditingTfIdx(null); setShowTfForm(true) }}
            className="text-xs tracking-widest uppercase px-4 py-2 mb-2"
          >
            ADD DAY
          </Button>

          {showTfForm && (() => {
            const todayStr = new Date().toISOString().split('T')[0]
            const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
            const isToday = tfForm.date === todayStr
            const minTime = isToday ? nowTime : undefined
            const openPicker = (e: React.MouseEvent<HTMLInputElement>) => (e.currentTarget as HTMLInputElement).showPicker?.()
            return (
            <div className="flex gap-2 items-center bg-gray-50 border border-gray-200 rounded p-3 mb-2">
              <input
                type="date" value={tfForm.date}
                min={todayStr}
                onChange={(e) => setTfForm((f) => ({ ...f, date: e.target.value }))}
                onClick={openPicker}
                className={`rounded px-2 py-1.5 text-sm focus:outline-none cursor-pointer border ${tfAttempted && !tfForm.date ? 'border-red-400 bg-red-50' : 'border-[gray-300] focus:border-[#1565c0]'}`}
              />
              <input
                type="time" value={tfForm.startTime}
                min={minTime}
                onChange={(e) => setTfForm((f) => ({ ...f, startTime: e.target.value }))}
                onClick={openPicker}
                className={`rounded px-2 py-1.5 text-sm focus:outline-none cursor-pointer border ${tfAttempted && !tfForm.startTime ? 'border-red-400 bg-red-50' : 'border-[gray-300] focus:border-[#1565c0]'}`}
              />
              <span className="text-gray-400">–</span>
              <input
                type="time" value={tfForm.endTime}
                min={minTime}
                onChange={(e) => setTfForm((f) => ({ ...f, endTime: e.target.value }))}
                onClick={openPicker}
                className={`rounded px-2 py-1.5 text-sm focus:outline-none cursor-pointer border ${tfAttempted && !tfForm.endTime ? 'border-red-400 bg-red-50' : 'border-[gray-300] focus:border-[#1565c0]'}`}
              />
              <Button onClick={addOrUpdateTimeframe} className="text-xs px-3 py-1.5">
                {editingTfIdx !== null ? 'Update' : 'Add'}
              </Button>
              <button
                type="button"
                onClick={() => { setShowTfForm(false); setEditingTfIdx(null) }}
                className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>
            )
          })()}
          {tfError && <p className="text-xs text-red-500 mt-1">{tfError}</p>}

          {timeframes.map((tf, i) => (
            <div key={i} className="relative flex items-center justify-between border border-[gray-300] rounded px-3 py-2 w-80 mb-1">
              <span className="text-sm text-gray-700">{tf.date} · {tf.startTime} – {tf.endTime}</span>
              <button
                type="button"
                onClick={() => setOpenMenuIdx(openMenuIdx === i ? null : i)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <MoreVertical size={16} />
              </button>
              {openMenuIdx === i && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-md z-10 min-w-[100px]">
                  <button type="button" onClick={() => editTf(i)}
                    className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">Edit</button>
                  <button type="button" onClick={() => deleteTf(i)}
                    className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50">Delete</button>
                </div>
              )}
            </div>
          ))}

          {timeframes.length === 0 && (
            <p className="text-xs text-gray-400 mt-1">No days added yet. Use "ADD DAY" to add event days.</p>
          )}
        </div>

        <div className="flex gap-3">
          <FSelect placeholder="Sessions length" value={form.sessionLength} onChange={ff('sessionLength')} options={SESSION_OPTS} />
          <FSelect placeholder="Break length" value={form.breakLength} onChange={ff('breakLength')} options={BREAK_OPTS} />
        </div>
      </div>

      <div className="flex justify-between mt-12">
        <Button onClick={() => navigate(`/events/${eventId}`)} className="px-8 py-3 text-sm tracking-widest uppercase">
          BACK
        </Button>
        <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={!form.name.trim()} className="px-8 py-3 text-sm tracking-widest uppercase">
          SAVE CHANGES
        </Button>
      </div>
    </div>
  )
}
