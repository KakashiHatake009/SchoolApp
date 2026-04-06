import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'

// Dev hint: seeded credentials
const HINTS = [
  { role: 'Platform Admin', email: 'admin@schoolbook.de', password: 'admin123' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { user, token } = await authService.login(email, password)
      setAuth(user, token)
      if (user.role === 'platform_admin') navigate('/dashboard')
      else if (user.role === 'school_admin') navigate('/dashboard')
      else if (user.role === 'teacher') navigate('/teacher/appointments')
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-[#1565c0] flex items-center justify-center mb-3">
            <CalendarDays size={24} className="text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-800">School Booking</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to your account</p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-[#1565c0]/20 shadow-sm p-6 space-y-4"
        >
          <Input
            label="Email"
            type="email"
            placeholder="you@school.de"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <Button type="submit" className="w-full" loading={loading}>
            Sign In
          </Button>
        </form>

        {/* Dev hints */}
        <div className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-100">
          <p className="text-xs font-medium text-blue-700 mb-2">Dev credentials:</p>
          {HINTS.map((h) => (
            <button
              key={h.email}
              type="button"
              onClick={() => { setEmail(h.email); setPassword(h.password) }}
              className="block text-xs text-blue-600 hover:underline cursor-pointer"
            >
              {h.role}: {h.email} / {h.password}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
