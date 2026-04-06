import { useState, useRef } from 'react'
import { useNavigate, NavLink } from 'react-router-dom'
import { Menu, X, CalendarDays, LayoutDashboard, Users, School, BookOpen, LogOut } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuthStore } from '@/store/authStore'

interface TopNavbarProps {
  title: string
  showLanguage?: boolean
}

const navByRole: Record<string, { to: string; label: string; icon: React.ReactNode }[]> = {
  platform_admin: [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  ],
  school_admin: [
    { to: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { to: '/events', label: 'Events', icon: <CalendarDays size={18} /> },
    { to: '/teachers', label: 'Teachers', icon: <Users size={18} /> },
  ],
  teacher: [
    { to: '/teacher/appointments', label: 'Appointments', icon: <BookOpen size={18} /> },
  ],
}

export function TopNavbar({ title, showLanguage = false }: TopNavbarProps) {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarUrl, setAvatarUrl] = useState<string>(() => localStorage.getItem('user-avatar') ?? '')

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = reader.result as string
      setAvatarUrl(url)
      localStorage.setItem('user-avatar', url)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const navItems = navByRole[user?.role ?? ''] ?? []
  const displayAvatar = user?.avatar || avatarUrl

  return (
    <>
      <header className="flex items-center justify-between px-4 sm:px-8 py-3 sm:py-4 border-b border-gray-200 bg-white">
        {/* Left: hamburger (mobile) + logo */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="sm:hidden text-gray-600 hover:text-gray-900 cursor-pointer"
          >
            <Menu size={22} />
          </button>
          <img src="/logo.png" alt="WahlWeise" className="h-8 sm:h-10 w-auto object-contain cursor-pointer" onClick={() => navigate('/dashboard')} />
        </div>

        {/* Page title — hidden on mobile */}
        <h1 className="hidden sm:block text-base font-normal text-gray-700">{title}</h1>

        {/* Right: avatar or language */}
        <div className="flex items-center gap-3">
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          {showLanguage ? (
            <span className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">Language</span>
          ) : (
            <button onClick={() => avatarInputRef.current?.click()} className="cursor-pointer rounded-full hover:ring-2 hover:ring-[#1565c0]/30 transition-all" title="Change profile photo">
              {displayAvatar ? (
                <img src={displayAvatar} alt={user?.name ?? ''} className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-600">
                  {user?.name?.charAt(0) ?? 'A'}
                </div>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Mobile slide-out menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} />

          {/* Drawer */}
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded bg-[#1565c0] flex items-center justify-center">
                  <CalendarDays size={16} className="text-white" />
                </div>
                <span className="font-semibold text-gray-800 text-sm">School Booking</span>
              </div>
              <button onClick={() => setMenuOpen(false)} className="text-gray-400 hover:text-gray-700 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {user && (
              <div className="px-5 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-700 truncate">{user.name}</p>
                <p className="text-xs text-gray-400 truncate">{user.email}</p>
              </div>
            )}

            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    clsx(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                      isActive
                        ? 'bg-[#e3f2fd] text-[#1565c0] font-medium'
                        : 'text-gray-600 hover:bg-gray-100',
                    )
                  }
                >
                  {item.icon}
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => { logout(); setMenuOpen(false) }}
                className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors cursor-pointer"
              >
                <LogOut size={15} />
                Logout
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  )
}
