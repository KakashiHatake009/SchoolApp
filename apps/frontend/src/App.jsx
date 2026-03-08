import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import keycloak from './keycloak.js';
import Spinner from './components/Spinner.jsx';
import AdminLayout from './components/AdminLayout.jsx';

import BookEmail from './pages/parent/BookEmail.jsx';
import BookVerify from './pages/parent/BookVerify.jsx';
import BookSlots from './pages/parent/BookSlots.jsx';
import BookDone from './pages/parent/BookDone.jsx';
import CancelPage from './pages/parent/CancelPage.jsx';

import EventsPage from './pages/admin/EventsPage.jsx';
import EventDetail from './pages/admin/EventDetail.jsx';
import TeachersPage from './pages/admin/TeachersPage.jsx';
import BookingsPage from './pages/admin/BookingsPage.jsx';
import SchoolsPage from './pages/admin/SchoolsPage.jsx';

// Wraps admin routes — triggers Keycloak login if not authenticated
function ProtectedRoute() {
    if (!keycloak.authenticated) {
        keycloak.login();
        return <Spinner />;
    }
    return <Outlet />;
}

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Root → admin */}
                <Route path="/" element={<Navigate to="/admin/events" replace />} />

                {/* Parent booking flow — public, no auth */}
                <Route path="/book/:qrToken" element={<BookEmail />} />
                <Route path="/book/:qrToken/verify" element={<BookVerify />} />
                <Route path="/book/:qrToken/slots" element={<BookSlots />} />
                <Route path="/book/:qrToken/done" element={<BookDone />} />

                {/* Cancel — public */}
                <Route path="/cancel/:cancelToken" element={<CancelPage />} />

                {/* Admin portal — requires Keycloak */}
                <Route element={<ProtectedRoute />}>
                    <Route element={<AdminLayout />}>
                        <Route path="/admin/schools" element={<SchoolsPage />} />
                        <Route path="/admin/events" element={<EventsPage />} />
                        <Route path="/admin/events/:id" element={<EventDetail />} />
                        <Route path="/admin/teachers" element={<TeachersPage />} />
                        <Route path="/admin/bookings" element={<BookingsPage />} />
                    </Route>
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
