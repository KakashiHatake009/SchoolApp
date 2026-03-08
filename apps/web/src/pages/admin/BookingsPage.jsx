import { useState, useEffect } from 'react';
import { adminApi } from '../../api.js';
import Spinner from '../../components/Spinner.jsx';

function fmt(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-GB', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
}

export default function BookingsPage() {
    const [bookings, setBookings] = useState([]);
    const [events, setEvents] = useState([]);
    const [selectedEvent, setSelectedEvent] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        adminApi.getEvents()
            .then(setEvents)
            .catch((e) => setError(e.message));
        loadBookings('');
    }, []);

    async function loadBookings(eventId) {
        setLoading(true);
        setError('');
        try {
            setBookings(await adminApi.getBookings(eventId));
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    function handleFilter(e) {
        const val = e.target.value;
        setSelectedEvent(val);
        loadBookings(val);
    }

    return (
        <>
            <div className="page-header">
                <h1 className="page-title">Bookings</h1>
                <select className="form-select" style={{ width: 260 }} value={selectedEvent} onChange={handleFilter}>
                    <option value="">All events</option>
                    {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>{ev.title}</option>
                    ))}
                </select>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="card">
                {loading ? <Spinner /> : bookings.length === 0 ? (
                    <div className="empty">
                        <div className="empty-icon">📭</div>
                        <p>No bookings found.</p>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Event</th>
                                    <th>Parent Email</th>
                                    <th>Child</th>
                                    <th>Slot</th>
                                    <th>Status</th>
                                    <th>Booked at</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bookings.map((b) => (
                                    <tr key={b.id}>
                                        <td style={{ fontWeight: 500, fontSize: 13 }}>{b.event?.title || '—'}</td>
                                        <td>{b.parentEmail}</td>
                                        <td>{b.childName || '—'}</td>
                                        <td style={{ fontSize: 13 }}>
                                            {b.slot
                                                ? `${fmt(b.slot.startTime)} – ${fmt(b.slot.endTime)}`
                                                : <span style={{ color: '#9ca3af' }}>RSVP</span>}
                                        </td>
                                        <td>
                                            <span className={`badge ${b.status === 'CONFIRMED' ? 'badge-green' : 'badge-red'}`}>
                                                {b.status}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: 13 }}>{fmt(b.bookedAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
}
