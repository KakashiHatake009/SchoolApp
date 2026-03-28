import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { getUser, clearToken, isPlatformAdmin } from '../auth.js';

export default function AdminLayout() {
    const navigate = useNavigate();
    const user = getUser();
    const name = user?.name || user?.email || 'Admin';
    const isAdmin = isPlatformAdmin();

    function handleSignOut() {
        clearToken();
        navigate('/login', { replace: true });
    }

    return (
        <div className="admin-shell">
            <aside className="sidebar">
                <div className="sidebar-brand">
                    <span>🏫</span> SchoolBook
                </div>
                <ul className="sidebar-nav">
                    {isAdmin && (
                        <li>
                            <NavLink to="/admin/schools">🏫 Schools</NavLink>
                        </li>
                    )}
                    <li>
                        <NavLink to="/admin/events">📅 Events</NavLink>
                    </li>
                    <li>
                        <NavLink to="/admin/teachers">👩‍🏫 Teachers</NavLink>
                    </li>
                    <li>
                        <NavLink to="/admin/bookings">📋 Bookings</NavLink>
                    </li>
                </ul>
                <div className="sidebar-footer">
                    <div className="user-name">{name}</div>
                    <button
                        className="btn btn-secondary btn-sm"
                        style={{ width: '100%', justifyContent: 'center' }}
                        onClick={handleSignOut}
                    >
                        Sign out
                    </button>
                </div>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}
