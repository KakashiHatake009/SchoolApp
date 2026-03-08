import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi, isPlatformAdmin } from '../../api.js';
import Spinner from '../../components/Spinner.jsx';

const TYPE_LABELS = {
    SLOT_BOOKING: { label: 'Slot Booking', cls: 'badge-blue' },
    RSVP_SIGNUP:  { label: 'RSVP',         cls: 'badge-orange' },
};

function fmtDate(d) {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const EMPTY_FORM = {
    title: '', description: '', eventType: 'SLOT_BOOKING',
    startDate: '', endDate: '', location: '', maxCapacity: '', schoolId: '',
};

export default function EventsPage() {
    const navigate = useNavigate();
    const isAdmin = isPlatformAdmin();
    const [events, setEvents] = useState([]);
    const [schools, setSchools] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        load();
        if (isAdmin) adminApi.getSchools().then(setSchools).catch(() => {});
    }, []);

    async function load() {
        try {
            setEvents(await adminApi.getEvents());
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    function set(field) {
        return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
    }

    async function handleCreate(e) {
        e.preventDefault();
        setSaving(true);
        setError('');
        try {
            await adminApi.createEvent({
                ...form,
                maxCapacity: form.maxCapacity ? Number(form.maxCapacity) : undefined,
            });
            setShowForm(false);
            setForm(EMPTY_FORM);
            await load();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Events</h1>
                <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
                    {showForm ? '✕ Cancel' : '+ New Event'}
                </button>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {showForm && (
                <div className="inline-form">
                    <div className="card-title">New Event</div>
                    <form onSubmit={handleCreate}>
                        {isAdmin && (
                            <div className="form-group">
                                <label className="form-label">School *</label>
                                <select className="form-select" required value={form.schoolId} onChange={set('schoolId')}>
                                    <option value="">— Select a school —</option>
                                    {schools.filter((s) => s.isActive).map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Title *</label>
                                <input className="form-input" required value={form.title} onChange={set('title')} placeholder="Parent-Teacher Conferences" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Type *</label>
                                <select className="form-select" value={form.eventType} onChange={set('eventType')}>
                                    <option value="SLOT_BOOKING">Slot Booking</option>
                                    <option value="RSVP_SIGNUP">RSVP Signup</option>
                                </select>
                            </div>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Description</label>
                            <input className="form-input" value={form.description} onChange={set('description')} placeholder="Optional description" />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Start date & time *</label>
                                <input className="form-input" type="datetime-local" required value={form.startDate} onChange={set('startDate')} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">End date & time *</label>
                                <input className="form-input" type="datetime-local" required value={form.endDate} onChange={set('endDate')} />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">Location</label>
                                <input className="form-input" value={form.location} onChange={set('location')} placeholder="Main Hall" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Max capacity</label>
                                <input className="form-input" type="number" min="1" value={form.maxCapacity} onChange={set('maxCapacity')} placeholder="Leave blank for unlimited" />
                            </div>
                        </div>
                        <div className="form-actions">
                            <button className="btn btn-primary" type="submit" disabled={saving}>
                                {saving ? 'Creating…' : 'Create event'}
                            </button>
                            <button className="btn btn-secondary" type="button" onClick={() => setShowForm(false)}>
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="card">
                {loading ? <Spinner /> : events.length === 0 ? (
                    <div className="empty">
                        <div className="empty-icon">📅</div>
                        <p>No events yet. Create your first event above.</p>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Event</th>
                                    <th>Type</th>
                                    <th>Date</th>
                                    <th>Slots</th>
                                    <th>Bookings</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {events.map((ev) => {
                                    const t = TYPE_LABELS[ev.eventType] || { label: ev.eventType, cls: 'badge-gray' };
                                    return (
                                        <tr key={ev.id}>
                                            <td>
                                                <a className="table-link" onClick={() => navigate(`/admin/events/${ev.id}`)}>
                                                    {ev.title}
                                                </a>
                                                {ev.location && <div style={{ fontSize: 12, color: '#9ca3af' }}>📍 {ev.location}</div>}
                                            </td>
                                            <td><span className={`badge ${t.cls}`}>{t.label}</span></td>
                                            <td style={{ fontSize: 13 }}>{fmtDate(ev.startDate)}</td>
                                            <td>{ev._count?.slots ?? '—'}</td>
                                            <td>{ev._count?.bookings ?? '—'}</td>
                                            <td>
                                                <span className={`badge ${ev.isActive ? 'badge-green' : 'badge-red'}`}>
                                                    {ev.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
