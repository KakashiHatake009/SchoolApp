import { Outlet } from 'react-router-dom'
import { TopNavbar } from './TopNavbar'
import { useAuthStore } from '@/store/authStore'
import { PageTitleProvider, usePageTitle } from '@/context/PageTitleContext'

function Layout() {
  const { logout } = useAuthStore()
  const title = usePageTitle()

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <TopNavbar title={title} />
      <main className="flex-1 px-8 py-8">
        <Outlet />
      </main>
      <footer className="px-8 py-4">
        <button
          onClick={logout}
          className="text-sm text-gray-400 hover:text-gray-600 cursor-pointer"
        >
          Logout
        </button>
      </footer>
    </div>
  )
}

export function AppLayout() {
  return (
    <PageTitleProvider>
      <Layout />
    </PageTitleProvider>
  )
}
