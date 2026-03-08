import { Outlet, NavLink } from 'react-router-dom';
import keycloak from '../keycloak.js';
import { isPlatformAdmin } from '../api.js';

export default function AdminLayout() {
    const name = keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username || 'Admin';
    const isAdmin = isPlatformAdmin();

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
                        onClick={() => keycloak.logout()}
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
