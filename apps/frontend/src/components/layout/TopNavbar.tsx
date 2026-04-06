import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface TopNavbarProps {
  title: string
  showLanguage?: boolean
}

export function TopNavbar({ title, showLanguage = false }: TopNavbarProps) {
  const user = useAuthStore((s) => s.user)
  const navigate = useNavigate()

  return (
    <header className="flex items-center justify-between px-8 py-4 border-b border-gray-200 bg-white">
      {/* Logo */}
      <img src="/logo.png" alt="WahlWeise" className="h-10 w-auto object-contain cursor-pointer" onClick={() => navigate('/dashboard')} />

      {/* Page title */}
      <h1 className="text-base font-normal text-gray-700">{title}</h1>

      {/* Right: avatar or language */}
      <div className="w-32 flex justify-end">
        {showLanguage ? (
          <span className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">Language</span>
        ) : user?.avatar ? (
          <img src={user.avatar} alt={user.name} className="w-9 h-9 rounded-full object-cover" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-600">
            {user?.name?.charAt(0) ?? 'A'}
          </div>
        )}
      </div>
    </header>
  )
}
