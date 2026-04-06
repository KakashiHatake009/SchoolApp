import { NavLink } from 'react-router-dom'
import { clsx } from 'clsx'
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  School,
  LogOut,
  BookOpen,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}

const schoolAdminNav: NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/admin/events', label: 'Events', icon: <CalendarDays size={18} /> },
  { to: '/admin/teachers', label: 'Teachers', icon: <Users size={18} /> },
]

const teacherNav: NavItem[] = [
  { to: '/teacher/appointments', label: 'Appointments', icon: <BookOpen size={18} /> },
]

const platformAdminNav: NavItem[] = [
  { to: '/platform/schools', label: 'Schools', icon: <School size={18} /> },
  { to: '/platform/events', label: 'All Events', icon: <CalendarDays size={18} /> },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()

  const navItems =
    user?.role === 'school_admin'
      ? schoolAdminNav
      : user?.role === 'teacher'
      ? teacherNav
      : platformAdminNav

  return (
    <aside className="flex flex-col w-56 min-h-screen bg-white border-r border-gray-200 py-6">
      {/* Logo */}
      <div className="px-5 mb-8">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-[#1565c0] flex items-center justify-center">
            <CalendarDays size={16} className="text-white" />
          </div>
          <span className="font-semibold text-gray-800 text-sm leading-tight">
            School<br />Booking
          </span>
        </div>
      </div>

      {/* School name badge */}
      {user?.role === 'school_admin' && (
        <div className="px-5 mb-4">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">School</p>
          <p className="text-sm font-medium text-gray-700 truncate">{user.name}</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
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

      {/* User + logout */}
      <div className="px-5 pt-4 border-t border-gray-100">
        <p className="text-xs text-gray-500 truncate mb-1">{user?.email}</p>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-red-500 transition-colors mt-1 cursor-pointer"
        >
          <LogOut size={15} />
          Logout
        </button>
      </div>
    </aside>
  )
}
