import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from '@/router/ProtectedRoute'

// Pages — Auth
import LoginPage from '@/features/auth/LoginPage'
import ForgotPasswordPage from '@/features/auth/ForgotPasswordPage'
import ResetPasswordPage from '@/features/auth/ResetPasswordPage'

// Pages — Parent (public)
import BookingPage from '@/features/parent/BookingPage'
import CancelPage from '@/features/parent/CancelPage'
import TeacherManagePage from '@/features/teacher/TeacherManagePage'

// Pages — Platform Admin
import DashboardPage from '@/features/platform-admin/DashboardPage'
import CreateSchoolPage from '@/features/platform-admin/CreateSchoolPage'
import SchoolDetailPage from '@/features/platform-admin/SchoolDetailPage'
import CreateEventPage from '@/features/platform-admin/CreateEventPage'
import EventDetailPage from '@/features/platform-admin/EventDetailPage'
import TeacherBookingsPage from '@/features/platform-admin/TeacherBookingsPage'
import EditSchoolPage from '@/features/platform-admin/EditSchoolPage'
import EditEventPage from '@/features/platform-admin/EditEventPage'

// Pages — Teacher
import TeacherAppointmentsPage from '@/features/teacher/AppointmentsPage'
import SlotManagementPage from '@/features/teacher/SlotManagementPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 30 } },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/book/:eventId" element={<BookingPage />} />
          <Route path="/cancel/:cancelToken" element={<CancelPage />} />
          <Route path="/manage/:eventId" element={<TeacherManagePage />} />

          {/* Platform Admin */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['platform_admin']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/schools/create" element={<CreateSchoolPage />} />
            <Route path="/schools/:schoolId" element={<SchoolDetailPage />} />
            <Route path="/events/create" element={<CreateEventPage />} />
            <Route path="/events/:eventId" element={<EventDetailPage />} />
            <Route path="/events/:eventId/edit" element={<EditEventPage />} />
            <Route path="/events/:eventId/bookings/:teacherId" element={<TeacherBookingsPage />} />
            <Route path="/schools/:schoolId/edit" element={<EditSchoolPage />} />
          </Route>

          {/* Teacher */}
          <Route
            element={
              <ProtectedRoute allowedRoles={['teacher']}>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/teacher/appointments" element={<TeacherAppointmentsPage />} />
            <Route path="/teacher/slots" element={<SlotManagementPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
