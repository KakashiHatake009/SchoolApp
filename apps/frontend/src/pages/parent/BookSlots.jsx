import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { publicApi } from '../../api.js';
import Spinner from '../../components/Spinner.jsx';

function fmt(d) {
    return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function BookSlots() {
    const { qrToken } = useParams();
    const navigate = useNavigate();
    const { state } = useLocation();

    const [slots, setSlots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [childName, setChildName] = useState('');
    const [booking, setBooking] = useState(false);
    const [error, setError] = useState('');
    const [isRsvp, setIsRsvp] = useState(false);

    const parentToken = sessionStorage.getItem('parentToken');

    useEffect(() => {
        if (!state?.eventId || !parentToken) {
            navigate(`/book/${qrToken}`, { replace: true });
            return;
        }
        // Fetch public event info to know the type
        publicApi.getEventByQr(qrToken)
            .then((ev) => {
                setIsRsvp(ev.eventType === 'RSVP_SIGNUP');
            })
            .catch(() => {});

        publicApi.getSlotsByQr(qrToken)
            .then(setSlots)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    async function handleBook() {
        setError('');
        setBooking(true);
        try {
            const body = {
                ...(selectedSlot && { slotId: selectedSlot }),
                ...(childName && { childName }),
            };
            const result = await publicApi.createBooking(body, parentToken);
            sessionStorage.removeItem('parentToken');
            navigate(`/book/${qrToken}/done`, { state: { booking: result, eventTitle: state.eventTitle } });
        } catch (err) {
            setError(err.message);
        } finally {
            setBooking(false);
        }
    }

    if (loading) return (
        <div className="parent-page"><div className="parent-card"><Spinner /></div></div>
    );

    return (
        <div className="parent-page">
            <div className="parent-card">
                <div className="parent-logo">📅</div>
                <h1>{isRsvp ? 'Confirm RSVP' : 'Choose a Time Slot'}</h1>
                <p className="subtitle">{state?.eventTitle}</p>

                {error && <div className="alert alert-error">{error}</div>}

                {!isRsvp && (
                    <>
                        {slots.length === 0 ? (
                            <div className="alert alert-info">No available slots at this time.</div>
                        ) : (
                            <div className="slots-list">
                                {slots.map((s) => (
                                    <div
                                        key={s.id}
                                        className={`slot-card ${!s.available ? 'slot-full' : ''} ${selectedSlot === s.id ? 'slot-selected' : ''}`}
                                        onClick={() => s.available && setSelectedSlot(s.id)}
                                    >
                                        <div>
                                            <div className="slot-time">{fmt(s.startTime)} – {fmt(s.endTime)}</div>
                                            {s.teacher && <div className="slot-teacher">with {s.teacher.name}</div>}
                                        </div>
                                        <div className={`slot-avail ${s.available ? 'badge-green' : 'badge-red'}`} style={{ padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>
                                            {s.available ? 'Available' : 'Full'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                <div className="form-group">
                    <label className="form-label">Child's name <span style={{ color: '#9ca3af' }}>(optional)</span></label>
                    <input
                        className="form-input"
                        type="text"
                        placeholder="e.g. Jamie Smith"
                        value={childName}
                        onChange={(e) => setChildName(e.target.value)}
                    />
                </div>

                <button
                    className="btn btn-primary"
                    onClick={handleBook}
                    disabled={booking || (!isRsvp && !selectedSlot)}
                >
                    {booking ? 'Booking…' : isRsvp ? 'Confirm RSVP →' : 'Book this slot →'}
                </button>
            </div>
        </div>
    );
}
