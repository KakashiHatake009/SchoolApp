import { useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, MoreVertical } from 'lucide-react'
import * as XLSX from 'xlsx'
import { eventService } from '@/services/eventService'
import { teacherService } from '@/services/teacherService'
import { schoolService } from '@/services/schoolService'
import { Button } from '@/components/ui/Button'
import { useSetPageTitle } from '@/context/PageTitleContext'

type Step = 'details' | 'review'

const SESSION_OPTS = ['5', '10', '15', '20', '30'].map((v) => ({ value: v, label: `${v} minutes` }))
const BREAK_OPTS = ['0', '5', '10', '15'].map((v) => ({ value: v, label: v === '0' ? 'No break' : `${v} minutes` }))

const FInput = ({ placeholder, value, onChange, className = '', textarea = false }: {
  placeholder: string; value: string; onChange: (v: string) => void; className?: string; textarea?: boolean
}) => {
  const cls = `border border-[gray-300] rounded px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#1565c0] w-full ${className}`
  return textarea
    ? <textarea placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} rows={4} className={cls} />
    : <input placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
}

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

interface TeacherRow {
  klasse: string
  roomNo: string
  salutation: string
  titel: string
  firstName: string
  surname: string
  email: string
  salutation2: string
  titel2: string
  firstName2: string
  surname2: string
  email2: string
}

const EMPTY_TEACHER: TeacherRow = {
  klasse: '', roomNo: '', salutation: 'Hr.', titel: '', firstName: '', surname: '', email: '',
  salutation2: '', titel2: '', firstName2: '', surname2: '', email2: '',
}

export default function CreateEventPage() {
  useSetPageTitle('Event anlegen')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const schoolId = searchParams.get('schoolId') ?? ''
  const qc = useQueryClient()

  const [step, setStep] = useState<Step>('details')
  const [form, setForm] = useState({ name: '', description: '', sessionLength: '', breakLength: '' })
  const [timeframes, setTimeframes] = useState<Timeframe[]>([])
  const [showTimeframeForm, setShowTimeframeForm] = useState(false)
  const [tfForm, setTfForm] = useState({ date: '', startTime: '', endTime: '' })
  const [editingTfIdx, setEditingTfIdx] = useState<number | null>(null)
  const [openMenuIdx, setOpenMenuIdx] = useState<number | null>(null)
  const [tfError, setTfError] = useState('')
  const [tfAttempted, setTfAttempted] = useState(false)
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [showManualInput, setShowManualInput] = useState(false)
  const [teacherRow, setTeacherRow] = useState<TeacherRow>(EMPTY_TEACHER)
  const [uploadFileName, setUploadFileName] = useState('')
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError('')
    setUploadFileName(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        // Row 0-2: instructions/group headers. Row 3: column headers. Row 4+: data
        const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 })

        const parsed: TeacherRow[] = []
        for (let i = 4; i < rows.length; i++) {
          const row = rows[i]
          if (!row || row.length === 0) continue
          // 0=Klasse,1=Raum,2=Anrede,3=Titel,4=Vorname,5=Nachname,6=E-Mail
          // 7=Anrede_2,8=Titel_2,9=Vorname_2,10=Nachname_2,11=E-Mail_2
          const s = (n: number) => String(row[n] ?? '').trim()
          const surname = s(5)
          const firstName = s(4)
          if (!surname && !firstName) continue
          parsed.push({
            klasse: s(0),
            roomNo: s(1),
            salutation: s(2) || 'Hr.',
            titel: s(3),
            firstName,
            surname,
            email: s(6),
            salutation2: s(7),
            titel2: s(8),
            firstName2: s(9),
            surname2: s(10),
            email2: s(11),
          })
        }

        if (parsed.length === 0) {
          setUploadError('No teachers found in file. Check the format.')
          return
        }
        setTeachers((prev) => {
          // Deduplicate by surname+firstName
          const existing = new Set(prev.map((t) => `${t.surname}|${t.firstName}`))
          const newOnes = parsed.filter((t) => !existing.has(`${t.surname}|${t.firstName}`))
          return [...prev, ...newOnes]
        })
      } catch {
        setUploadError('Failed to read file. Please upload a valid .xlsx file.')
      }
    }
    reader.readAsArrayBuffer(file)
    // Reset so same file can be re-uploaded
    e.target.value = ''
  }

  const { data: school } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => schoolService.getById(schoolId),
    enabled: !!schoolId,
  })

  const ff = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }))

  const addTimeframe = () => {
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
      setTimeframes((prev) => prev.map((tf, i) => i === editingTfIdx ? { ...tfForm } : tf))
      setEditingTfIdx(null)
    } else {
      setTimeframes((prev) => [...prev, { ...tfForm }])
    }
    setTfAttempted(false)
    setTfForm({ date: '', startTime: '', endTime: '' })
    setShowTimeframeForm(false)
  }

  const editTimeframe = (i: number) => {
    setTfForm({ ...timeframes[i] })
    setEditingTfIdx(i)
    setShowTimeframeForm(true)
    setOpenMenuIdx(null)
  }

  const deleteTimeframe = (i: number) => {
    setTimeframes((prev) => prev.filter((_, idx) => idx !== i))
    setOpenMenuIdx(null)
  }

  const downloadTemplate = () => {
    const data = [
      ['Bitte füllen Sie die Tabelle ab Zeile 5 aus. Zeilen 1–4 nicht verändern.'],
      ['', '', '1. Pädagog:in', '', '', '', '', '2. Pädagog:in (optional)'],
      [],
      ['Klasse', 'Raum', 'Anrede', 'Titel', 'Vorname', 'Nachname', 'Arbeits-E-Mail',
       'Anrede_2', 'Titel_2', 'Vorname_2', 'Nachname_2', 'Arbeits-E-Mail_2'],
      ['5a', '101', 'Hr.', 'Dr.', 'Max', 'Mustermann', 'max.mustermann@schule.de',
       'Fr.', '', 'Erika', 'Musterfrau', 'erika.musterfrau@schule.de'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Lehrerliste')
    XLSX.writeFile(wb, 'lehrerliste_vorlage.xlsx')
  }

  const addTeacher = () => {
    if (!teacherRow.surname) return
    setTeachers((prev) => [...prev, { ...teacherRow }])
    setTeacherRow(EMPTY_TEACHER)
  }

  const createMut = useMutation({
    mutationFn: async () => {
      const tf = timeframes[0]
      const event = await eventService.create({
        schoolId,
        name: form.name,
        description: form.description,
        type: 'slot_booking',
        date: tf?.date ?? '',
        startTime: tf?.startTime ?? '10:00',
        endTime: tf?.endTime ?? '16:00',
        sessionLength: Number(form.sessionLength) || 15,
        breakLength: Number(form.breakLength) || 0,
        status: 'draft',
        bookingActive: false,
        // Send all timeframes so backend creates EventDay records for each day
        days: timeframes.map((t) => ({ date: t.date, startTime: t.startTime, endTime: t.endTime })),
      })
      // create teachers
      await Promise.all(teachers.map((t) =>
        teacherService.create({
          schoolId,
          eventId: event.id,
          klasse: t.klasse,
          roomNo: t.roomNo,
          salutation: t.salutation as 'Hr.' | 'Fr.',
          titel: t.titel,
          firstName: t.firstName,
          surname: t.surname,
          email: t.email,
          salutation2: t.salutation2,
          titel2: t.titel2,
          firstName2: t.firstName2,
          surname2: t.surname2,
          email2: t.email2,
          bookingStatus: 'not_booked',
        }),
      ))
      return event
    },
    onSuccess: (event) => {
      qc.invalidateQueries({ queryKey: ['events-all'] })
      qc.invalidateQueries({ queryKey: ['events', schoolId] })
      navigate(`/events/${event.id}`)
    },
  })

  const schoolName = school?.name ?? 'School'

  if (step === 'review') {
    return (
      <div>
        <div className="flex justify-between items-start mb-6">
          <div>
            <p className="font-bold text-gray-800 mb-1">
              <span className="font-bold">{schoolName}:</span> Event "{form.name}"
            </p>
            {form.description && <p className="text-sm text-gray-600 mb-3 max-w-xl leading-relaxed">{form.description}</p>}
            {timeframes.length > 0 && (
              <div className="flex gap-6 text-sm text-gray-700 flex-wrap items-start">
                <div>
                  <span className="font-semibold">Days:</span>
                  <span className="inline-flex flex-col gap-0.5 ml-1">
                    {timeframes.map((tf, i) => (
                      <span key={i} className="text-gray-600">{tf.date} · {tf.startTime}–{tf.endTime}</span>
                    ))}
                  </span>
                </div>
                <p><span className="font-semibold">Sessions:</span> {form.sessionLength}min</p>
                <p><span className="font-semibold">Breaks:</span> {form.breakLength}min</p>
              </div>
            )}
          </div>
          <div className="w-24 h-24 rounded-full border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
            {school?.logo ? <img src={school.logo} alt={schoolName} className="w-full h-full object-contain p-1" /> : 'Logo'}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-3">
          <h2 className="font-bold text-gray-800">Added teachers</h2>
          <input placeholder="search" className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:border-[#1565c0] w-40" />
        </div>

        <div className="border border-gray-200 rounded overflow-x-auto mb-10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#dde8ee] text-gray-700">
                {['Class', 'Room', 'Teacher 1', 'Email', 'Teacher 2', 'Email'].map((h, i) => (
                  <th key={i} className="px-3 py-2 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teachers.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-400">No teachers added yet.</td></tr>
              )}
              {teachers.map((t, i) => {
                const t1 = [t.salutation, t.titel, t.firstName, t.surname].filter(Boolean).join(' ')
                const t2 = [t.salutation2, t.titel2, t.firstName2, t.surname2].filter(Boolean).join(' ')
                return (
                  <tr key={i} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    <td className="px-3 py-2 text-gray-700">{t.klasse || '—'}</td>
                    <td className="px-3 py-2 text-gray-700">{t.roomNo || '—'}</td>
                    <td className="px-3 py-2 text-gray-800 font-medium">{t1 || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{t.email || '—'}</td>
                    <td className="px-3 py-2 text-gray-800">{t2 || '—'}</td>
                    <td className="px-3 py-2 text-gray-500">{t.email2 || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between">
          <Button onClick={() => setStep('details')} className="px-8 py-3 text-xs tracking-widest uppercase">BACK</Button>
          <Button onClick={() => createMut.mutate()} loading={createMut.isPending} disabled={timeframes.length === 0} className="px-8 py-3 text-xs tracking-widest uppercase">
            CREATE EVENT
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-start mb-6">
        <p className="text-sm text-gray-500 max-w-lg">
          This step allows you to create a detailed representation of the school within our application.
          Please carefully enter the following information:
        </p>
        <div className="w-24 h-24 rounded-full border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
          {school?.logo ? <img src={school.logo} alt={schoolName} className="w-full h-full object-contain p-1" /> : 'Logo'}
        </div>
      </div>

      <div className="space-y-3">
        <FInput placeholder="Event title" value={form.name} onChange={ff('name')} className="w-full max-w-72" />
        <div>
          <label className="block text-sm font-medium text-gray-600 mb-1">Description</label>
          <textarea
            placeholder="Enter event description..."
            value={form.description}
            onChange={(e) => ff('description')(e.target.value)}
            rows={8}
            className="border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#1565c0] focus:ring-1 focus:ring-[#1565c0] w-full leading-relaxed resize-y"
          />
        </div>

        {/* Timeframes */}
        <Button
          onClick={() => setShowTimeframeForm(true)}
          className="text-xs tracking-widest uppercase px-4 py-2"
        >
          ADD TIMEFRAME
        </Button>

        {showTimeframeForm && (() => {
          const todayStr = new Date().toISOString().split('T')[0]
          const nowTime = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
          const isToday = tfForm.date === todayStr
          const minTime = isToday ? nowTime : undefined
          const openPicker = (e: React.MouseEvent<HTMLInputElement>) => (e.currentTarget as HTMLInputElement).showPicker?.()
          return (
            <div className="flex gap-2 items-center bg-gray-50 border border-gray-200 rounded p-3">
              <input type="date" value={tfForm.date} min={todayStr}
                onChange={(e) => setTfForm((f) => ({ ...f, date: e.target.value }))}
                onClick={openPicker}
                className={`rounded px-2 py-1.5 text-sm focus:outline-none cursor-pointer border ${tfAttempted && !tfForm.date ? 'border-red-400 bg-red-50' : 'border-[gray-300] focus:border-[#1565c0]'}`} />
              <input type="time" value={tfForm.startTime} min={minTime}
                onChange={(e) => setTfForm((f) => ({ ...f, startTime: e.target.value }))}
                onClick={openPicker}
                className={`rounded px-2 py-1.5 text-sm focus:outline-none cursor-pointer border ${tfAttempted && !tfForm.startTime ? 'border-red-400 bg-red-50' : 'border-[gray-300] focus:border-[#1565c0]'}`} />
              <span className="text-gray-400">–</span>
              <input type="time" value={tfForm.endTime} min={minTime}
                onChange={(e) => setTfForm((f) => ({ ...f, endTime: e.target.value }))}
                onClick={openPicker}
                className={`rounded px-2 py-1.5 text-sm focus:outline-none cursor-pointer border ${tfAttempted && !tfForm.endTime ? 'border-red-400 bg-red-50' : 'border-[gray-300] focus:border-[#1565c0]'}`} />
              <Button onClick={addTimeframe} className="text-xs px-3 py-1.5">{editingTfIdx !== null ? 'Update' : 'Add'}</Button>
            </div>
          )
        })()}
        {tfError && <p className="text-xs text-red-500">{tfError}</p>}

        {timeframes.map((tf, i) => (
          <div key={i} className="relative flex items-center justify-between border border-[gray-300] rounded px-3 py-2 w-full max-w-72">
            <span className="text-sm text-gray-700">{tf.date} {tf.startTime} - {tf.endTime}</span>
            <button
              type="button"
              onClick={() => setOpenMenuIdx(openMenuIdx === i ? null : i)}
              className="text-gray-400 hover:text-gray-600 cursor-pointer"
            >
              <MoreVertical size={16} />
            </button>
            {openMenuIdx === i && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded shadow-md z-10 min-w-[100px]">
                <button type="button" onClick={() => editTimeframe(i)}
                  className="block w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Edit
                </button>
                <button type="button" onClick={() => deleteTimeframe(i)}
                  className="block w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-gray-50">
                  Delete
                </button>
              </div>
            )}
          </div>
        ))}

        {/* Session / break */}
        <div className="flex gap-3">
          <FSelect placeholder="Sessions length" value={form.sessionLength} onChange={ff('sessionLength')} options={SESSION_OPTS} />
          <FSelect placeholder="Break length between each session" value={form.breakLength} onChange={ff('breakLength')} options={BREAK_OPTS} />
        </div>

        {/* Teachers upload */}
        <div className="flex items-center gap-3">
          <input
            placeholder="Upload teachers list"
            readOnly
            value={uploadFileName}
            className="border border-[gray-300] rounded px-3 py-2 text-sm text-gray-600 flex-1 cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-9 h-9 rounded-full bg-[#1565c0] text-white flex items-center justify-center hover:bg-[#3a7a9e] cursor-pointer flex-shrink-0"
          >
            <Plus size={16} />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.ods"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
        {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
        <button
          type="button"
          onClick={downloadTemplate}
          className="text-xs text-[#1565c0] underline hover:text-[#3a7a9e] cursor-pointer w-fit"
        >
          Download teachers list template (.xlsx)
        </button>

        {/* Manual input */}
        <div>
          <button
            onClick={() => setShowManualInput((v) => !v)}
            className="flex items-center gap-2 font-bold text-gray-800 cursor-pointer"
          >
            Manual input <span className="text-gray-400">▾</span>
          </button>
          {showManualInput && (
            <div className="mt-3 space-y-3">
              {/* Row 1: Klasse, Raum, 1. Pädagog:in */}
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">1. Pädagog:in</p>
              <div className="flex gap-2 flex-wrap">
                <input placeholder="Klasse" value={teacherRow.klasse} onChange={(e) => setTeacherRow((t) => ({ ...t, klasse: e.target.value }))}
                  className="border border-[gray-300] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#1565c0] w-20" />
                <input placeholder="Raum" value={teacherRow.roomNo} onChange={(e) => setTeacherRow((t) => ({ ...t, roomNo: e.target.value }))}
                  className="border border-[gray-300] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#1565c0] w-20" />
                <select value={teacherRow.salutation} onChange={(e) => setTeacherRow((t) => ({ ...t, salutation: e.target.value }))}
                  className="border border-[gray-300] rounded px-2 py-2 text-sm bg-white focus:outline-none focus:border-[#1565c0]">
                  <option value="Hr.">Hr.</option>
                  <option value="Fr.">Fr.</option>
                </select>
                <input placeholder="Titel" value={teacherRow.titel} onChange={(e) => setTeacherRow((t) => ({ ...t, titel: e.target.value }))}
                  className="border border-[gray-300] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#1565c0] w-20" />
                <input placeholder="Vorname" value={teacherRow.firstName} onChange={(e) => setTeacherRow((t) => ({ ...t, firstName: e.target.value }))}
                  className="border border-[gray-300] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#1565c0] flex-1" />
                <input placeholder="Nachname" value={teacherRow.surname} onChange={(e) => setTeacherRow((t) => ({ ...t, surname: e.target.value }))}
                  className="border border-[gray-300] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#1565c0] flex-1" />
                <input placeholder="Arbeits-E-Mail" value={teacherRow.email} onChange={(e) => setTeacherRow((t) => ({ ...t, email: e.target.value }))}
                  className="border border-[gray-300] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#1565c0] flex-1" />
              </div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">2. Pädagog:in </p>
              <div className="flex gap-2 flex-wrap">
                <select value={teacherRow.salutation2} onChange={(e) => setTeacherRow((t) => ({ ...t, salutation2: e.target.value }))}
                  className="border border-[gray-300] rounded px-2 py-2 text-sm bg-white focus:outline-none focus:border-[#1565c0]">
                  <option value="">—</option>
                  <option value="Hr.">Hr.</option>
                  <option value="Fr.">Fr.</option>
                </select>
                <input placeholder="Titel" value={teacherRow.titel2} onChange={(e) => setTeacherRow((t) => ({ ...t, titel2: e.target.value }))}
                  className="border border-[gray-300] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#1565c0] w-20" />
                <input placeholder="Vorname" value={teacherRow.firstName2} onChange={(e) => setTeacherRow((t) => ({ ...t, firstName2: e.target.value }))}
                  className="border border-[gray-300] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#1565c0] flex-1" />
                <input placeholder="Nachname" value={teacherRow.surname2} onChange={(e) => setTeacherRow((t) => ({ ...t, surname2: e.target.value }))}
                  className="border border-[gray-300] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#1565c0] flex-1" />
                <input placeholder="Arbeits-E-Mail" value={teacherRow.email2} onChange={(e) => setTeacherRow((t) => ({ ...t, email2: e.target.value }))}
                  className="border border-[gray-300] rounded px-2 py-2 text-sm focus:outline-none focus:border-[#1565c0] flex-1" />
                <Button onClick={addTeacher} className="text-xs px-3 py-1.5">Add</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {form.name.trim() && timeframes.length === 0 && (
        <p className="text-xs text-amber-600 mt-4">Please add at least one day (timeframe) before proceeding.</p>
      )}
      <div className="flex justify-between mt-4">
        <Button onClick={() => navigate(schoolId ? `/schools/${schoolId}` : '/dashboard')} className="px-8 py-3 text-xs tracking-widest uppercase">
          BACK
        </Button>
        <Button onClick={() => setStep('review')} disabled={!form.name.trim() || timeframes.length === 0} className="px-8 py-3 text-xs tracking-widest uppercase">
          NEXT
        </Button>
      </div>
    </div>
  )
}
