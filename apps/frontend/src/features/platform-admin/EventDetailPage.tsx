import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Download, Mail, CheckCheck, Copy, Check, AlertCircle } from 'lucide-react'
import { eventService } from '@/services/eventService'
import { teacherService } from '@/services/teacherService'
import { schoolService } from '@/services/schoolService'
import { Button } from '@/components/ui/Button'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useSetPageTitle } from '@/context/PageTitleContext'
import { useAuthStore } from '@/store/authStore'

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [deleteEvent, setDeleteEvent] = useState(false)
  const [deleteTeacherId, setDeleteTeacherId] = useState<string | null>(null)
  const [addTeacherOpen, setAddTeacherOpen] = useState(false)
  const [editTeacherId, setEditTeacherId] = useState<string | null>(null)
  const [sentIds, setSentIds] = useState<Set<string>>(new Set())
  const [errorIds, setErrorIds] = useState<Map<string, string>>(new Map())
  const [sendingAll, setSendingAll] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false)
  const [addUploadFileName, setAddUploadFileName] = useState('')
  const [addUploadError, setAddUploadError] = useState('')
  const [addUploadInfo, setAddUploadInfo] = useState('')
  const [addUploading, setAddUploading] = useState(false)
  const addUploadRef = useRef<HTMLInputElement>(null)

  type ParsedTeacher = { klasse: string; roomNo: string; salutation: string; titel: string; firstName: string; surname: string; email: string; salutation2: string; titel2: string; firstName2: string; surname2: string; email2: string }
  type UploadPreview = {
    toCreate: ParsedTeacher[]
    toUpdate: Array<{ id: string; incoming: ParsedTeacher; changes: Record<string, { from: string; to: string }> }>
  }
  const [uploadPreview, setUploadPreview] = useState<UploadPreview | null>(null)

  const FIELD_LABELS: Record<string, string> = {
    klasse: 'Class', roomNo: 'Room', salutation: 'Salutation', titel: 'Title',
    firstName: 'First name', surname: 'Last name',
    salutation2: 'Salutation 2', titel2: 'Title 2',
    firstName2: 'First name 2', surname2: 'Last name 2', email2: 'Email 2',
  }

  const teacherPayload = (t: ParsedTeacher) => ({
    salutation: t.salutation as 'Hr.' | 'Fr.', titel: t.titel,
    firstName: t.firstName, surname: t.surname, email: t.email,
    roomNo: t.roomNo, klasse: t.klasse,
    salutation2: t.salutation2, titel2: t.titel2,
    firstName2: t.firstName2, surname2: t.surname2, email2: t.email2,
  })

  const clearUpload = () => {
    setAddUploadFileName('')
    setAddUploadError('')
    setAddUploadInfo('')
    if (addUploadRef.current) addUploadRef.current.value = ''
  }
  const [submitted, setSubmitted] = useState(false)

  const handleAddFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAddUploadError('')
    setAddUploadInfo('')
    setAddUploadFileName(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })

        const parsed: ParsedTeacher[] = []
        for (let i = 4; i < rows.length; i++) {
          const row = rows[i]
          if (!row || row.length === 0) continue
          const s = (n: number) => String(row[n] ?? '').trim()
          const surname = s(5); const firstName = s(4)
          if (!surname && !firstName) continue
          parsed.push({ klasse: s(0), roomNo: s(1), salutation: s(2) || 'Hr.', titel: s(3), firstName, surname, email: s(6), salutation2: s(7), titel2: s(8), firstName2: s(9), surname2: s(10), email2: s(11) })
        }

        if (parsed.length === 0) { setAddUploadError('No teachers found. Check the format.'); return }

        const existingByEmail = new Map(
          teachers.filter((t) => t.email?.trim()).map((t) => [t.email!.toLowerCase(), t])
        )

        const toCreate = parsed.filter((t) => !t.email || !existingByEmail.has(t.email.toLowerCase()))
        const toUpdate = parsed
          .filter((t) => t.email && existingByEmail.has(t.email.toLowerCase()))
          .map((t) => {
            const existing = existingByEmail.get(t.email.toLowerCase())!
            const changes: Record<string, { from: string; to: string }> = {}
            for (const key of Object.keys(FIELD_LABELS)) {
              const from = String((existing as unknown as Record<string, unknown>)[key] ?? '').trim()
              const to = String((t as Record<string, unknown>)[key] ?? '').trim()
              if (from !== to) changes[key] = { from, to }
            }
            return { id: existing.id, incoming: t, changes }
          })
          .filter(({ changes }) => Object.keys(changes).length > 0)

        setUploadPreview({ toCreate, toUpdate })
        if (addUploadRef.current) addUploadRef.current.value = ''
      } catch {
        setAddUploadError('Failed to parse file.')
        if (addUploadRef.current) addUploadRef.current.value = ''
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const confirmUpload = async () => {
    if (!uploadPreview) return
    setAddUploading(true)
    try {
      await Promise.all([
        ...uploadPreview.toCreate.map((t) => teacherService.create({ schoolId: event!.schoolId, eventId: eventId!, ...teacherPayload(t), bookingStatus: 'not_booked' })),
        ...uploadPreview.toUpdate.map(({ id, incoming }) => teacherService.update(id, teacherPayload(incoming))),
      ])
      invalidateTeachers()
      const parts = []
      if (uploadPreview.toCreate.length) parts.push(`${uploadPreview.toCreate.length} added`)
      if (uploadPreview.toUpdate.length) parts.push(`${uploadPreview.toUpdate.length} updated`)
      setAddUploadInfo(parts.join(', '))
      setAddUploadFileName('')
      setAddTeacherOpen(false)
    } catch {
      setAddUploadError('Failed to save changes.')
    } finally {
      setAddUploading(false)
      setUploadPreview(null)
    }
  }

  const sendCode = async (teacherId: string) => {
    try {
      await teacherService.notify(teacherId)
      setSentIds((prev) => new Set([...prev, teacherId]))
      setErrorIds((prev) => { const m = new Map(prev); m.delete(teacherId); return m })
      setTimeout(() => setSentIds((prev) => { const n = new Set(prev); n.delete(teacherId); return n }), 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send'
      setErrorIds((prev) => new Map([...prev, [teacherId, msg]]))
      setTimeout(() => setErrorIds((prev) => { const m = new Map(prev); m.delete(teacherId); return m }), 4000)
    }
  }

  const sendAllCodes = async () => {
    setSendingAll(true)
    await Promise.allSettled(teachers.map((t) => sendCode(t.id)))
    setSendingAll(false)
  }
  const EMPTY_FORM = {
    klasse: '', roomNo: '', salutation: '', titel: '', firstName: '', surname: '', email: '',
    salutation2: '', titel2: '', firstName2: '', surname2: '', email2: '',
  }
  const [teacherForm, setTeacherForm] = useState(EMPTY_FORM)
  const tf = (key: keyof typeof EMPTY_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setTeacherForm((f) => ({ ...f, [key]: e.target.value }))

  const { data: event, isLoading } = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => eventService.getById(eventId!),
    enabled: !!eventId,
  })

  const { data: school } = useQuery({
    queryKey: ['school', event?.schoolId],
    queryFn: () => schoolService.getById(event!.schoolId),
    enabled: !!event?.schoolId,
  })

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers', eventId],
    queryFn: () => teacherService.getByEvent(eventId!),
    enabled: !!eventId,
  })

  const { data: qrDataUrl } = useQuery({
    queryKey: ['qr', eventId],
    queryFn: async () => {
      const token = useAuthStore.getState().token
      const origin = encodeURIComponent(window.location.origin)
      const apiBase = import.meta.env.VITE_API_URL || ''
      const res = await fetch(`${apiBase}/api/events/${eventId}/qr?origin=${origin}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('QR fetch failed')
      const blob = await res.blob()
      return new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    },
    enabled: !!eventId,
  })

  const bookingLink = `${window.location.origin}/book/${eventId}`

  const copyLink = () => {
    navigator.clipboard.writeText(bookingLink)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const downloadPDF = () => {
    const win = window.open('', '_blank')
    if (!win || !event) return
    win.document.write(`<!DOCTYPE html><html><head>
      <title>${event.name} – Booking QR</title>
      <style>
        body{font-family:Arial,sans-serif;padding:48px;max-width:560px;margin:0 auto;color:#1a1a1a}
        h1{font-size:20px;margin-bottom:4px}
        .sub{font-size:13px;color:#555;margin-bottom:24px}
        .row{font-size:13px;margin-bottom:6px}
        .label{font-weight:600}
        .qr{margin:24px 0;text-align:center}
        .qr img{width:200px;height:200px}
        .link{font-size:12px;word-break:break-all;color:#1565c0;margin-top:10px;text-align:center}
        @media print{body{padding:24px}}
      </style>
    </head><body>
      <h1>${event.name}</h1>
      <div class="sub">${schoolName}</div>
      ${event.days && event.days.length > 0
        ? event.days.map((d) => `<div class="row"><span class="label">Date:</span> ${d.date} &nbsp; ${d.startTime} – ${d.endTime}</div>`).join('')
        : `<div class="row"><span class="label">Date:</span> ${event.date} &nbsp; ${event.startTime} – ${event.endTime}</div>`
      }
      <div class="row"><span class="label">Session:</span> ${event.sessionLength} min &nbsp;|&nbsp; <span class="label">Break:</span> ${event.breakLength} min</div>
      ${event.description ? `<div class="row"><span class="label">Info:</span> ${event.description}</div>` : ''}
      <div class="qr">
        ${qrDataUrl ? `<img src="${qrDataUrl}" />` : '<p>QR code not available</p>'}
        <div class="link">${bookingLink}</div>
      </div>
      <script>window.onload=()=>{window.print();}</script>
    </body></html>`)
    win.document.close()
  }

  const invalidateTeachers = () => qc.invalidateQueries({ queryKey: ['teachers', eventId] })

  const toggleBookingMut = useMutation({
    mutationFn: () => event?.bookingActive
      ? eventService.unpublish(eventId!)
      : eventService.publish(eventId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', eventId] })
      qc.invalidateQueries({ queryKey: ['events-all'] })
      if (event?.schoolId) qc.invalidateQueries({ queryKey: ['events', event.schoolId] })
    },
  })

  const deleteEventMut = useMutation({
    mutationFn: () => eventService.delete(eventId!),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events-all'] }); navigate('/dashboard') },
  })

  const deleteTeacherMut = useMutation({
    mutationFn: (id: string) => teacherService.delete(id),
    onSuccess: () => { invalidateTeachers(); setDeleteTeacherId(null) },
  })

  const bulkDeleteMut = useMutation({
    mutationFn: () => Promise.allSettled([...selectedIds].map((id) => teacherService.delete(id))),
    onSuccess: () => { invalidateTeachers(); setSelectedIds(new Set()) },
  })

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleSelectAll = () =>
    setSelectedIds(selectedIds.size === teachers.length ? new Set() : new Set(teachers.map((t) => t.id)))

  const editTeacherMut = useMutation({
    mutationFn: () => teacherService.update(editTeacherId!, {
      salutation: teacherForm.salutation as 'Hr.' | 'Fr.',
      titel: teacherForm.titel,
      firstName: teacherForm.firstName,
      surname: teacherForm.surname,
      email: teacherForm.email,
      roomNo: teacherForm.roomNo,
      klasse: teacherForm.klasse,
      salutation2: teacherForm.salutation2,
      titel2: teacherForm.titel2,
      firstName2: teacherForm.firstName2,
      surname2: teacherForm.surname2,
      email2: teacherForm.email2,
    }),
    onSuccess: () => { invalidateTeachers(); setEditTeacherId(null); setTeacherForm(EMPTY_FORM) },
  })

  const openEditTeacher = (t: (typeof teachers)[0]) => {
    setSubmitted(false)
    setTeacherForm({
      klasse: t.klasse ?? '',
      roomNo: t.roomNo ?? '',
      salutation: t.salutation ?? 'Hr.',
      titel: t.titel ?? '',
      firstName: t.firstName ?? '',
      surname: t.surname ?? '',
      email: t.email ?? '',
      salutation2: t.salutation2 ?? '',
      titel2: t.titel2 ?? '',
      firstName2: t.firstName2 ?? '',
      surname2: t.surname2 ?? '',
      email2: t.email2 ?? '',
    })
    setEditTeacherId(t.id)
  }

  const addTeacherMut = useMutation({
    mutationFn: () => teacherService.create({
      schoolId: event!.schoolId,
      eventId: eventId!,
      salutation: teacherForm.salutation as 'Hr.' | 'Fr.',
      titel: teacherForm.titel,
      firstName: teacherForm.firstName,
      surname: teacherForm.surname,
      email: teacherForm.email,
      roomNo: teacherForm.roomNo,
      klasse: teacherForm.klasse,
      salutation2: teacherForm.salutation2,
      titel2: teacherForm.titel2,
      firstName2: teacherForm.firstName2,
      surname2: teacherForm.surname2,
      email2: teacherForm.email2,
      bookingStatus: 'not_booked',
    }),
    onSuccess: () => { invalidateTeachers(); setAddTeacherOpen(false); setTeacherForm(EMPTY_FORM) },
  })

  useSetPageTitle(event?.name ?? '')

  if (isLoading || !event) return <p className="text-gray-400 text-sm">Loading…</p>

  const schoolName = school?.name ?? '—'

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="max-w-2xl">
          <p className="font-bold text-gray-800 mb-2">
            {schoolName}: Event "{event.name}"
          </p>
          {event.description && (
            <p className="text-sm text-gray-600 mb-3 leading-relaxed">{event.description}</p>
          )}
          <div className="flex gap-6 text-sm text-gray-700 mb-4 flex-wrap items-start">
            <div>
              <span className="font-semibold">Days:</span>{' '}
              {event.days && event.days.length > 0
                ? (
                  <span className="inline-flex flex-col gap-0.5 ml-1">
                    {event.days.map((d) => (
                      <span key={d.id} className="text-gray-600">{d.date} · {d.startTime}–{d.endTime}</span>
                    ))}
                  </span>
                )
                : <span className="text-gray-600">{event.date} · {event.startTime}–{event.endTime}</span>
              }
            </div>
            <p><span className="font-semibold">Sessions:</span> {event.sessionLength}min</p>
            <p><span className="font-semibold">Breaks:</span> {event.breakLength}min</p>
          </div>
        </div>

        {/* Right: booking toggle + link + QR + PDF */}
        <div className="flex flex-col items-end gap-3 flex-shrink-0">
          {/* Toggle */}
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${event.bookingActive ? 'text-[#1565c0]' : 'text-gray-400'}`}>
              {event.bookingActive ? 'Published' : 'Not yet started'}
            </span>
            <button
              onClick={() => {
                if (event.bookingActive) {
                  toggleBookingMut.mutate()
                } else {
                  const unconfirmed = teachers.filter((t: { bookingStatus: string }) => t.bookingStatus !== 'slots_confirmed' && t.bookingStatus !== 'booked')
                  if (unconfirmed.length > 0) {
                    setPublishConfirmOpen(true)
                  } else {
                    toggleBookingMut.mutate()
                  }
                }
              }}
              className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 cursor-pointer focus:outline-none ${event.bookingActive ? 'bg-[#1565c0]' : 'bg-gray-300'}`}
            >
              <span className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform duration-200 mt-0.5 ml-0.5 ${event.bookingActive ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {/* Booking link */}
          <div className="flex items-center gap-1.5 max-w-xs">
            <span className="text-xs text-gray-500 truncate">{bookingLink}</span>
            <button
              onClick={copyLink}
              title="Copy link"
              className={`flex-shrink-0 cursor-pointer transition-colors ${linkCopied ? 'text-green-500' : 'text-gray-400 hover:text-[#1565c0]'}`}
            >
              {linkCopied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>

          {/* Real QR code */}
          <div className="w-28 h-28 bg-gray-100 border border-gray-200 rounded flex items-center justify-center overflow-hidden">
            {qrDataUrl
              ? <img src={qrDataUrl} alt="Booking QR code" className="w-full h-full object-contain" />
              : <span className="text-xs text-gray-400">Loading…</span>}
          </div>

          <Button onClick={downloadPDF} className="text-xs px-4 py-1.5 tracking-widest uppercase">
            Download PDF
          </Button>
        </div>
      </div>

      {/* EDIT / DELETE */}
      <div className="flex gap-3 mb-6">
        <Button onClick={() => navigate(`/events/${eventId}/edit`)} className="px-6 py-2 text-xs tracking-widest uppercase">EDIT</Button>
        <Button onClick={() => setDeleteEvent(true)} className="px-6 py-2 text-xs tracking-widest uppercase">DELETE</Button>
      </div>

      {/* Bookings / Teachers table */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h2 className="font-bold text-gray-800">Bookings</h2>
          <input placeholder="search" className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#1565c0] w-40" />
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={sendAllCodes}
            loading={sendingAll}
            className="text-xs tracking-widest uppercase px-4 py-2"
          >
            SEND CODES
          </Button>
          <Button onClick={() => { setAddTeacherOpen(true); setSubmitted(false) }} className="text-xs tracking-widest uppercase px-4 py-2">
            ADD TEACHER
          </Button>
          {selectedIds.size > 0 && (
            <Button
              onClick={() => bulkDeleteMut.mutate()}
              loading={bulkDeleteMut.isPending}
              className="text-xs tracking-widest uppercase px-4 py-2 bg-red-500 hover:bg-red-600"
            >
              DELETE {selectedIds.size} SELECTED
            </Button>
          )}
        </div>
      </div>

      <div className="border border-gray-200 rounded overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#dde8ee] text-gray-700">
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={teachers.length > 0 && selectedIds.size === teachers.length}
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                />
              </th>
              {['Class', 'Room', 'Teacher 1', 'Email', 'Teacher 2', 'Email 2', 'Status', ''].map((h, i) => (
                <th key={i} className="px-3 py-3 text-left font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {teachers.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">No teachers added yet.</td></tr>
            )}
            {teachers.map((t, i) => {
              const t1 = [t.salutation, t.titel, t.firstName, t.surname].filter(Boolean).join(' ')
              const t2 = [t.salutation2, t.titel2, t.firstName2, t.surname2].filter(Boolean).join(' ')
              return (
                <tr key={t.id} className={`border-b border-gray-100 ${selectedIds.has(t.id) ? 'bg-blue-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                  <td className="px-3 py-3 w-8">
                    <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} className="cursor-pointer" />
                  </td>
                  <td className="px-3 py-3 text-gray-600">{t.klasse || '—'}</td>
                  <td className="px-3 py-3 text-gray-600">{t.roomNo || '—'}</td>
                  <td className="px-3 py-3 text-gray-800 font-medium">{t1 || '—'}</td>
                  <td className="px-3 py-3 text-gray-500">{t.email || '—'}</td>
                  <td className="px-3 py-3 text-gray-800">{t2 || '—'}</td>
                  <td className="px-3 py-3 text-gray-500">{t.email2 || '—'}</td>
                  <td className="px-3 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      t.bookingStatus === 'booked'
                        ? 'bg-green-100 text-green-700'
                        : t.bookingStatus === 'slots_confirmed'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {t.bookingStatus === 'booked'
                        ? 'Booked'
                        : t.bookingStatus === 'slots_confirmed'
                        ? 'Slots confirmed'
                        : 'Not confirmed'}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2 text-gray-400">
                      <button onClick={() => openEditTeacher(t)} className="hover:text-[#1565c0] cursor-pointer"><Pencil size={14} /></button>
                      <button onClick={() => setDeleteTeacherId(t.id)} className="hover:text-red-500 cursor-pointer"><Trash2 size={14} /></button>
                      <button onClick={() => navigate(`/events/${eventId}/bookings/${t.id}`)} className="hover:text-[#1565c0] cursor-pointer"><Download size={14} /></button>
                      <button
                        onClick={() => sendCode(t.id)}
                        title={
                          sentIds.has(t.id)
                            ? 'Code sent!'
                            : errorIds.has(t.id)
                            ? errorIds.get(t.id)
                            : t.email
                            ? 'Send access code'
                            : 'No email address — add one first'
                        }
                        className={`cursor-pointer transition-colors ${
                          sentIds.has(t.id)
                            ? 'text-green-500'
                            : errorIds.has(t.id)
                            ? 'text-red-500'
                            : !t.email
                            ? 'text-gray-300 cursor-not-allowed'
                            : 'hover:text-[#1565c0]'
                        }`}
                      >
                        {sentIds.has(t.id)
                          ? <CheckCheck size={14} />
                          : errorIds.has(t.id)
                          ? <AlertCircle size={14} />
                          : <Mail size={14} />}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <Button className="text-xs tracking-widest uppercase px-4 py-2">DOWNLOAD BOOKINGS</Button>
      </div>

      {/* Add Teacher Modal */}
      <Modal open={addTeacherOpen} onClose={() => { setAddTeacherOpen(false); clearUpload(); setSubmitted(false) }} title="Add teacher details" className="max-w-3xl">
        <div className="space-y-4">
          {/* File upload */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Upload spreadsheet</p>
            <div className="flex items-center gap-2">
              <input
                ref={addUploadRef}
                type="file"
                accept=".xlsx,.xls,.ods"
                className="hidden"
                onChange={handleAddFileUpload}
              />
              <button
                type="button"
                onClick={() => addUploadRef.current?.click()}
                disabled={addUploading}
                className="flex-1 border border-dashed border-[gray-300] rounded px-3 py-2 text-sm text-gray-500 hover:border-[#1565c0] hover:text-[#1565c0] text-left cursor-pointer transition-colors disabled:opacity-50"
              >
                {addUploading ? 'Uploading…' : addUploadFileName || 'Click to upload .xlsx / .xls / .ods'}
              </button>
              {addUploadFileName && !addUploading && (
                <button type="button" onClick={clearUpload} className="text-gray-400 hover:text-red-500 cursor-pointer transition-colors flex-shrink-0" title="Remove file">
                  ✕
                </button>
              )}
            </div>
            {addUploadError && <p className="text-xs text-red-500 mt-1">{addUploadError}</p>}
            {addUploadInfo && <p className="text-xs text-green-600 mt-1">{addUploadInfo}</p>}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">or add manually</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* Class & Room */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Class & Room</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Class (e.g. 5a)" value={teacherForm.klasse} onChange={(e) => setTeacherForm((f) => ({ ...f, klasse: e.target.value }))} error={submitted && !teacherForm.klasse.trim() ? ' ' : undefined} />
            <Input placeholder="Room (e.g. 101)" value={teacherForm.roomNo} onChange={(e) => setTeacherForm((f) => ({ ...f, roomNo: e.target.value }))} error={submitted && !teacherForm.roomNo.trim() ? ' ' : undefined} />
          </div>

          {/* Teacher 1 */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Teacher 1</p>
          <div className="grid grid-cols-4 gap-2">
            <Select options={[{ value: '', label: 'Salutation' }, { value: 'Hr.', label: 'Hr.' }, { value: 'Fr.', label: 'Fr.' }]} value={teacherForm.salutation} onChange={(e) => setTeacherForm((f) => ({ ...f, salutation: e.target.value }))} />
            <Input placeholder="Title (e.g. Dr.)" value={teacherForm.titel} onChange={(e) => setTeacherForm((f) => ({ ...f, titel: e.target.value }))} />
            <Input placeholder="First name" value={teacherForm.firstName} onChange={(e) => setTeacherForm((f) => ({ ...f, firstName: e.target.value }))} error={submitted && !teacherForm.firstName.trim() ? ' ' : undefined} />
            <Input placeholder="Last name" value={teacherForm.surname} onChange={(e) => setTeacherForm((f) => ({ ...f, surname: e.target.value }))} error={submitted && !teacherForm.surname.trim() ? ' ' : undefined} />
          </div>
          <Input placeholder="Work email" value={teacherForm.email} onChange={(e) => setTeacherForm((f) => ({ ...f, email: e.target.value }))} error={submitted && !teacherForm.email.trim() ? ' ' : undefined} />

          {/* Teacher 2 */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Teacher 2 <span className="normal-case font-normal text-gray-400">(optional)</span></p>
          <div className="grid grid-cols-4 gap-2">
            <Select options={[{ value: '', label: 'Salutation' }, { value: 'Hr.', label: 'Hr.' }, { value: 'Fr.', label: 'Fr.' }]} value={teacherForm.salutation2} onChange={(e) => setTeacherForm((f) => ({ ...f, salutation2: e.target.value }))} />
            <Input placeholder="Title (e.g. Dr.)" value={teacherForm.titel2} onChange={(e) => setTeacherForm((f) => ({ ...f, titel2: e.target.value }))} />
            <Input placeholder="First name" value={teacherForm.firstName2} onChange={(e) => setTeacherForm((f) => ({ ...f, firstName2: e.target.value }))} />
            <Input placeholder="Last name" value={teacherForm.surname2} onChange={(e) => setTeacherForm((f) => ({ ...f, surname2: e.target.value }))} />
          </div>
          <Input placeholder="Work email" value={teacherForm.email2} onChange={(e) => setTeacherForm((f) => ({ ...f, email2: e.target.value }))} />

          <div className="flex justify-center gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setAddTeacherOpen(false); clearUpload(); setSubmitted(false) }}>Cancel</Button>
            <Button loading={addTeacherMut.isPending} onClick={() => {
              setSubmitted(true)
              if (!teacherForm.klasse.trim() || !teacherForm.roomNo.trim() || !teacherForm.firstName.trim() || !teacherForm.surname.trim() || !teacherForm.email.trim()) return
              setSubmitted(false)
              addTeacherMut.mutate()
            }}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Teacher Modal */}
      <Modal open={editTeacherId !== null} onClose={() => { setEditTeacherId(null); setTeacherForm(EMPTY_FORM); setSubmitted(false) }} title="Edit teacher details" className="max-w-3xl">
        <div className="space-y-4">
          {/* Class & Room */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Class & Room</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Class (e.g. 5a)" value={teacherForm.klasse} onChange={(e) => setTeacherForm((f) => ({ ...f, klasse: e.target.value }))} error={submitted && !teacherForm.klasse.trim() ? ' ' : undefined} />
            <Input placeholder="Room (e.g. 101)" value={teacherForm.roomNo} onChange={(e) => setTeacherForm((f) => ({ ...f, roomNo: e.target.value }))} error={submitted && !teacherForm.roomNo.trim() ? ' ' : undefined} />
          </div>

          {/* Teacher 1 */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Teacher 1</p>
          <div className="grid grid-cols-4 gap-2">
            <Select options={[{ value: '', label: 'Salutation' }, { value: 'Hr.', label: 'Hr.' }, { value: 'Fr.', label: 'Fr.' }]} value={teacherForm.salutation} onChange={(e) => setTeacherForm((f) => ({ ...f, salutation: e.target.value }))} />
            <Input placeholder="Title (e.g. Dr.)" value={teacherForm.titel} onChange={(e) => setTeacherForm((f) => ({ ...f, titel: e.target.value }))} />
            <Input placeholder="First name" value={teacherForm.firstName} onChange={(e) => setTeacherForm((f) => ({ ...f, firstName: e.target.value }))} error={submitted && !teacherForm.firstName.trim() ? ' ' : undefined} />
            <Input placeholder="Last name" value={teacherForm.surname} onChange={(e) => setTeacherForm((f) => ({ ...f, surname: e.target.value }))} error={submitted && !teacherForm.surname.trim() ? ' ' : undefined} />
          </div>
          <Input placeholder="Work email" value={teacherForm.email} onChange={(e) => setTeacherForm((f) => ({ ...f, email: e.target.value }))} error={submitted && !teacherForm.email.trim() ? ' ' : undefined} />

          {/* Teacher 2 */}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Teacher 2 <span className="normal-case font-normal text-gray-400">(optional)</span></p>
          <div className="grid grid-cols-4 gap-2">
            <Select options={[{ value: '', label: 'Salutation' }, { value: 'Hr.', label: 'Hr.' }, { value: 'Fr.', label: 'Fr.' }]} value={teacherForm.salutation2} onChange={(e) => setTeacherForm((f) => ({ ...f, salutation2: e.target.value }))} />
            <Input placeholder="Title (e.g. Dr.)" value={teacherForm.titel2} onChange={(e) => setTeacherForm((f) => ({ ...f, titel2: e.target.value }))} />
            <Input placeholder="First name" value={teacherForm.firstName2} onChange={(e) => setTeacherForm((f) => ({ ...f, firstName2: e.target.value }))} />
            <Input placeholder="Last name" value={teacherForm.surname2} onChange={(e) => setTeacherForm((f) => ({ ...f, surname2: e.target.value }))} />
          </div>
          <Input placeholder="Work email" value={teacherForm.email2} onChange={(e) => setTeacherForm((f) => ({ ...f, email2: e.target.value }))} />

          <div className="flex justify-center gap-3 pt-2">
            <Button variant="secondary" onClick={() => { setEditTeacherId(null); setTeacherForm(EMPTY_FORM); setSubmitted(false) }}>Cancel</Button>
            <Button loading={editTeacherMut.isPending} onClick={() => {
              setSubmitted(true)
              if (!teacherForm.klasse.trim() || !teacherForm.roomNo.trim() || !teacherForm.firstName.trim() || !teacherForm.surname.trim() || !teacherForm.email.trim()) return
              setSubmitted(false)
              editTeacherMut.mutate()
            }}>Save</Button>
          </div>
        </div>
      </Modal>

      {/* Upload Preview Modal */}
      <Modal open={uploadPreview !== null} onClose={() => setUploadPreview(null)} title="Review changes" className="max-w-3xl">
        {uploadPreview && (
          <div className="space-y-5">
            <div className="max-h-[55vh] overflow-y-auto space-y-5 pr-1">
              {/* New teachers */}
              {uploadPreview.toCreate.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                    {uploadPreview.toCreate.length} new teacher{uploadPreview.toCreate.length > 1 ? 's' : ''} will be added
                  </p>
                  <div className="border border-gray-200 rounded overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-gray-50 text-gray-500 text-left">
                          <th className="px-3 py-2 font-medium">Name</th>
                          <th className="px-3 py-2 font-medium">Class</th>
                          <th className="px-3 py-2 font-medium">Room</th>
                          <th className="px-3 py-2 font-medium">Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadPreview.toCreate.map((t, i) => (
                          <tr key={i} className="border-t border-gray-100">
                            <td className="px-3 py-2 text-gray-800">{[t.salutation, t.titel, t.firstName, t.surname].filter(Boolean).join(' ')}</td>
                            <td className="px-3 py-2 text-gray-500">{t.klasse || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{t.roomNo || '—'}</td>
                            <td className="px-3 py-2 text-gray-500">{t.email || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Updated teachers */}
              {uploadPreview.toUpdate.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#1565c0] uppercase tracking-wide mb-2">
                    {uploadPreview.toUpdate.length} teacher{uploadPreview.toUpdate.length > 1 ? 's' : ''} will be updated
                  </p>
                  <div className="space-y-2">
                    {uploadPreview.toUpdate.map(({ incoming, changes }, i) => (
                      <div key={i} className="border border-gray-200 rounded px-3 py-2.5">
                        <p className="text-xs font-semibold text-gray-800 mb-1.5">
                          {[incoming.salutation, incoming.titel, incoming.firstName, incoming.surname].filter(Boolean).join(' ')}
                          <span className="ml-2 text-gray-400 font-normal">{incoming.email}</span>
                        </p>
                        <div className="space-y-1">
                          {Object.entries(changes).map(([key, { from, to }]) => (
                            <div key={key} className="flex items-center gap-2 text-xs">
                              <span className="text-gray-500 w-24 flex-shrink-0">{FIELD_LABELS[key]}</span>
                              <span className="text-red-400 line-through">{from || '—'}</span>
                              <span className="text-gray-400">→</span>
                              <span className="text-green-600 font-medium">{to || '—'}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploadPreview.toCreate.length === 0 && uploadPreview.toUpdate.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-6">No changes to apply — all entries are already up to date.</p>
              )}
            </div>

            <div className="flex justify-center gap-3 pt-2 border-t border-gray-100">
              <Button variant="secondary" onClick={() => setUploadPreview(null)}>Back</Button>
              {(uploadPreview.toCreate.length > 0 || uploadPreview.toUpdate.length > 0) && (
                <Button loading={addUploading} onClick={confirmUpload}>Confirm & Save</Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Publish confirmation when teachers are unconfirmed */}
      <Modal open={publishConfirmOpen} onClose={() => setPublishConfirmOpen(false)} title="Publish event?">
        <div className="text-sm text-gray-600 mb-4">
          <p className="mb-3">The following teachers have <strong>not confirmed</strong> their time slots. Their slots will be fully available for booking.</p>
          <ul className="space-y-1 mb-3">
            {teachers
              .filter((t: { bookingStatus: string }) => t.bookingStatus !== 'slots_confirmed' && t.bookingStatus !== 'booked')
              .map((t: { id: string; salutation: string; firstName: string; surname: string; salutation2?: string; firstName2?: string; surname2?: string }) => (
                <li key={t.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span>{t.salutation} {t.firstName} {t.surname}</span>
                  {t.firstName2 && t.surname2 && (
                    <span className="text-gray-400">+ {t.salutation2} {t.firstName2} {t.surname2}</span>
                  )}
                </li>
              ))}
          </ul>
          <p className="text-amber-600 font-medium">Do you still want to publish?</p>
        </div>
        <div className="flex justify-center gap-3">
          <Button variant="secondary" onClick={() => setPublishConfirmOpen(false)}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => { setPublishConfirmOpen(false); toggleBookingMut.mutate() }}
            loading={toggleBookingMut.isPending}
          >
            PUBLISH ANYWAY
          </Button>
        </div>
      </Modal>

      <ConfirmModal
        open={deleteEvent}
        onClose={() => setDeleteEvent(false)}
        onConfirm={() => deleteEventMut.mutate()}
        title="Delete event"
        message="Are you sure you want to delete this event?"
        requireCheckbox
        loading={deleteEventMut.isPending}
      />
      <ConfirmModal
        open={deleteTeacherId !== null}
        onClose={() => setDeleteTeacherId(null)}
        onConfirm={() => deleteTeacherMut.mutate(deleteTeacherId!)}
        title="Delete teacher"
        message="Are you sure you want to delete this teacher?"
        requireCheckbox
        loading={deleteTeacherMut.isPending}
      />
    </div>
  )
}
