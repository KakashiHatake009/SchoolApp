import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { schoolService } from '@/services/schoolService'
import { Button } from '@/components/ui/Button'
import { useSetPageTitle } from '@/context/PageTitleContext'

const Field = ({ placeholder, value, onChange, type = 'text', className = '' }: {
  placeholder: string; value: string; onChange: (v: string) => void; type?: string; className?: string
}) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className={`border border-[gray-300] rounded px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#1565c0] ${className}`}
  />
)

export default function EditSchoolPage() {
  const { schoolId } = useParams<{ schoolId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: school, isLoading } = useQuery({
    queryKey: ['school', schoolId],
    queryFn: () => schoolService.getById(schoolId!),
    enabled: !!schoolId,
  })

  useSetPageTitle(school?.name ?? '')

  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    name: '', website: '', email: '', phone: '',
    street: '', postcode: '', city: '',
    contactPerson: '', contactPhone: '', contactEmail: '',
    logo: '',
  })
  const [logoFileName, setLogoFileName] = useState('')

  useEffect(() => {
    if (school) {
      setForm({
        name: school.name ?? '',
        website: school.website ?? '',
        email: school.email ?? '',
        phone: school.phone ?? '',
        street: school.street ?? '',
        postcode: school.postcode ?? '',
        city: school.city ?? '',
        contactPerson: school.contactPerson ?? '',
        contactPhone: school.contactPhone ?? '',
        contactEmail: school.contactEmail ?? '',
        logo: school.logo ?? '',
      })
    }
  }, [school])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFileName(file.name)
    const reader = new FileReader()
    reader.onload = () => setForm((f) => ({ ...f, logo: reader.result as string }))
    reader.readAsDataURL(file)
  }

  const ff = (key: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [key]: v }))

  const mut = useMutation({
    mutationFn: () => schoolService.update(schoolId!, form),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['school', schoolId] })
      qc.invalidateQueries({ queryKey: ['schools'] })
      navigate(`/schools/${schoolId}`)
    },
  })

  if (isLoading) return <p className="text-gray-400 text-sm">Loading…</p>

  return (
    <div className="max-w-3xl">
      <div className="flex justify-between items-start mb-6">
        <p className="text-sm text-gray-500 max-w-lg">Update the school information below.</p>
        <div className="w-24 h-24 rounded-full border border-gray-200 bg-gray-100 flex items-center justify-center text-xs text-gray-400 overflow-hidden">
          {form.logo
            ? <img src={form.logo} alt="Logo preview" className="w-full h-full object-contain p-1" />
            : 'Logo'}
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field placeholder="School name" value={form.name} onChange={ff('name')} />
          <Field placeholder="School website" value={form.website} onChange={ff('website')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field placeholder="Email" type="email" value={form.email} onChange={ff('email')} />
          <Field placeholder="Phone" value={form.phone} onChange={ff('phone')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field placeholder="Street" value={form.street} onChange={ff('street')} />
          <Field placeholder="Postcode" value={form.postcode} onChange={ff('postcode')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field placeholder="City" value={form.city} onChange={ff('city')} />
          <div />
        </div>
        {/* Logo upload */}
        <div className="flex items-center gap-3 mt-1">
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          <Field placeholder="Change school logo" value={logoFileName} onChange={() => {}} className="flex-1 cursor-pointer" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-9 h-9 rounded-full bg-[#1565c0] text-white flex items-center justify-center hover:bg-[#3a7a9e] cursor-pointer flex-shrink-0"
          >
            <Plus size={16} />
          </button>
        </div>

        <Field placeholder="Contact person" value={form.contactPerson} onChange={ff('contactPerson')} className="w-1/2" />
        <div className="grid grid-cols-2 gap-3">
          <Field placeholder="Phone (Contact person)" value={form.contactPhone} onChange={ff('contactPhone')} />
          <Field placeholder="Email (Contact person)" type="email" value={form.contactEmail} onChange={ff('contactEmail')} />
        </div>
      </div>

      <div className="flex justify-between mt-12">
        <Button onClick={() => navigate(`/schools/${schoolId}`)} className="px-8 py-3 text-sm tracking-widest uppercase">
          BACK
        </Button>
        <Button onClick={() => mut.mutate()} loading={mut.isPending} disabled={!form.name.trim()} className="px-8 py-3 text-sm tracking-widest uppercase">
          SAVE CHANGES
        </Button>
      </div>
    </div>
  )
}
