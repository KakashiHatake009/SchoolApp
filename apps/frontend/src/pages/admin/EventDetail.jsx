import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api.js';
import Spinner from '../../components/Spinner.jsx';

function fmt(d) {
    return new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

const SLOT_EMPTY = { startTime: '', endTime: '', teacherId: '', maxBookings: 1 };

export default function EventDetail() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [event, setEvent] = useState(null);
    const [slots, setSlots] = useState([]);
    const [bookings, setBookings] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState('slots');
    const [slotForm, setSlotForm] = useState(SLOT_EMPTY);
    const [addingSlot, setAddingSlot] = useState(false);
    const [showSlotForm, setShowSlotForm] = useState(false);
    const [qrUrl, setQrUrl] = useState(null);
    const [qrLoading, setQrLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        Promise.all([
            adminApi.getEvent(id),
            adminApi.getTeachers(),
        ]).then(([ev, ts]) => {
            setEvent(ev);
            setSlots(ev.slots || []);
            setTeachers(ts);
        }).catch((e) => setError(e.message))
          .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        if (tab === 'bookings' && bookings.length === 0) {
            adminApi.getBookings(id).then(setBookings).catch((e) => setError(e.message));
        }
        if (tab === 'qr' && !qrUrl) loadQr();
    }, [tab]);

    async function loadQr() {
        setQrLoading(true);
        try {
            const blob = await adminApi.getQrBlob(id);
            setQrUrl(URL.createObjectURL(blob));
        } catch (e) {
            setError(e.message);
        } finally {
            setQrLoading(false);
        }
    }

    function setSlot(field) {
        return (e) => setSlotForm((f) => ({ ...f, [field]: e.target.value }));
    }

    async function handleAddSlot(e) {
        e.preventDefault();
        setAddingSlot(true);
        setError('');
        try {
            const payload = [{
                startTime: slotForm.startTime,
                endTime: slotForm.endTime,
                maxBookings: Number(slotForm.maxBookings),
                ...(slotForm.teacherId && { teacherId: slotForm.teacherId }),
            }];
            const updated = await adminApi.createSlots(id, payload);
            setSlots(updated);
            setSlotForm(SLOT_EMPTY);
            setShowSlotForm(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setAddingSlot(false);
        }
    }

    async function handleDeleteSlot(slotId) {
        if (!window.confirm('Delete this slot?')) return;
        try {
            await adminApi.deleteSlot(slotId);
            setSlots((s) => s.filter((x) => x.id !== slotId));
        } catch (err) {
            setError(err.message);
        }
    }

    async function handleDeactivate() {
        if (!window.confirm('Deactivate this event?')) return;
        try {
            await adminApi.deleteEvent(id);
            navigate('/admin/events');
        } catch (err) {
            setError(err.message);
        }
    }

    if (loading) return <Spinner />;
    if (!event) return <div className="alert alert-error">{error || 'Event not found'}</div>;

    return (
        <>
            <a className="back-link" onClick={() => navigate('/admin/events')}>← Back to Events</a>

            <div className="event-detail-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <h2>{event.title}</h2>
                        <div className="meta">
                            📅 {fmt(event.startDate)} – {fmt(event.endDate)}
                            {event.location && <> &bull; 📍 {event.location}</>}
                        </div>
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={handleDeactivate}>
                        Deactivate
                    </button>
                </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            <div className="tabs">
                {['slots', 'bookings', 'qr'].map((t) => (
                    <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                        {t === 'slots' ? `📋 Slots (${slots.length})` : t === 'bookings' ? `📖 Bookings` : '🔳 QR Code'}
                    </button>
                ))}
            </div>

            {/* ── Slots tab ─────────────────────────────────────────────── */}
            {tab === 'slots' && (
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <div className="card-title" style={{ margin: 0 }}>Time Slots</div>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowSlotForm((v) => !v)}>
                            {showSlotForm ? '✕ Cancel' : '+ Add Slot'}
                        </button>
                    </div>

                    {showSlotForm && (
                        <div className="inline-form" style={{ marginBottom: 16 }}>
                            <form onSubmit={handleAddSlot}>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Start time *</label>
                                        <input className="form-input" type="datetime-local" required value={slotForm.startTime} onChange={setSlot('startTime')} />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">End time *</label>
                                        <input className="form-input" type="datetime-local" required value={slotForm.endTime} onChange={setSlot('endTime')} />
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label className="form-label">Teacher</label>
                                        <select className="form-select" value={slotForm.teacherId} onChange={setSlot('teacherId')}>
                                            <option value="">— No teacher —</option>
                                            {teachers.map((t) => (
                                                <option key={t.id} value={t.id}>{t.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Max bookings</label>
                                        <input className="form-input" type="number" min="1" value={slotForm.maxBookings} onChange={setSlot('maxBookings')} />
                                    </div>
                                </div>
                                <div className="form-actions">
                                    <button className="btn btn-primary btn-sm" type="submit" disabled={addingSlot}>
                                        {addingSlot ? 'Adding…' : 'Add slot'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {slots.length === 0 ? (
                        <div className="empty">
                            <div className="empty-icon">🕐</div>
                            <p>No slots yet. Add your first time slot.</p>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr><th>Start</th><th>End</th><th>Teacher</th><th>Bookings</th><th></th></tr>
                                </thead>
                                <tbody>
                                    {slots.map((s) => (
                                        <tr key={s.id}>
                                            <td>{fmt(s.startTime)}</td>
                                            <td>{fmt(s.endTime)}</td>
                                            <td>{s.teacher?.name || <span style={{ color: '#9ca3af' }}>—</span>}</td>
                                            <td>{s.currentBookings} / {s.maxBookings}</td>
                                            <td>
                                                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteSlot(s.id)}>
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ── Bookings tab ──────────────────────────────────────────── */}
            {tab === 'bookings' && (
                <div className="card">
                    <div className="card-title">Bookings ({bookings.length})</div>
                    {bookings.length === 0 ? (
                        <div className="empty">
                            <div className="empty-icon">📭</div>
                            <p>No bookings yet.</p>
                        </div>
                    ) : (
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr><th>Parent Email</th><th>Child</th><th>Slot</th><th>Status</th><th>Booked at</th></tr>
                                </thead>
                                <tbody>
                                    {bookings.map((b) => (
                                        <tr key={b.id}>
                                            <td>{b.parentEmail}</td>
                                            <td>{b.childName || '—'}</td>
                                            <td style={{ fontSize: 13 }}>
                                                {b.slot ? `${fmt(b.slot.startTime)} – ${fmt(b.slot.endTime)}` : '—'}
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
            )}

            {/* ── QR tab ───────────────────────────────────────────────── */}
            {tab === 'qr' && (
                <div className="card">
                    <div className="card-title">QR Code</div>
                    <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
                        Print this QR code and send it home with students. Parents scan it to book a slot — no app needed.
                    </p>
                    {qrLoading ? <Spinner /> : qrUrl ? (
                        <div className="qr-wrap">
                            <img src={qrUrl} alt="Event QR Code" />
                            <div style={{ marginTop: 16 }}>
                                <a
                                    className="btn btn-secondary"
                                    href={qrUrl}
                                    download={`event-${id}-qr.png`}
                                >
                                    ⬇ Download PNG
                                </a>
                            </div>
                        </div>
                    ) : (
                        <div className="alert alert-error">{error || 'Failed to load QR code'}</div>
                    )}
                </div>
            )}
        </>
    );
}
