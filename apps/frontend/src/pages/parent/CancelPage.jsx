import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { publicApi } from '../../api.js';
import Spinner from '../../components/Spinner.jsx';

function fmt(d) {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function CancelPage() {
    const { cancelToken } = useParams();

    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const [cancelled, setCancelled] = useState(false);
    const [error, setError] = useState('');
    const [confirm, setConfirm] = useState(false);

    useEffect(() => {
        publicApi.getBooking(cancelToken)
            .then((b) => {
                setBooking(b);
                if (b.status === 'CANCELLED') setCancelled(true);
            })
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, [cancelToken]);

    async function handleCancel() {
        setCancelling(true);
        setError('');
        try {
            await publicApi.cancelBooking(cancelToken);
            setCancelled(true);
        } catch (err) {
            setError(err.message);
        } finally {
            setCancelling(false);
        }
    }

    if (loading) return (
        <div className="parent-page"><div className="parent-card"><Spinner /></div></div>
    );

    if (error && !booking) return (
        <div className="parent-page">
            <div className="parent-card">
                <div className="done-icon">❌</div>
                <div className="done-title">Booking Not Found</div>
                <p className="done-sub">{error}</p>
            </div>
        </div>
    );

    if (cancelled) return (
        <div className="parent-page">
            <div className="parent-card">
                <div className="done-icon">✅</div>
                <div className="done-title">Booking Cancelled</div>
                <p className="done-sub">Your booking has been cancelled. A confirmation email has been sent.</p>
            </div>
        </div>
    );

    return (
        <div className="parent-page">
            <div className="parent-card">
                <div className="done-icon">📋</div>
                <div className="done-title">Your Booking</div>

                {booking && (
                    <div className="done-detail">
                        <p><strong>{booking.event?.title}</strong></p>
                        {booking.slot && <p>🕐 {fmt(booking.slot.startTime)} – {fmt(booking.slot.endTime)}</p>}
                        {booking.childName && <p>👦 {booking.childName}</p>}
                        <p>📧 {booking.parentEmail}</p>
                        <p style={{ marginTop: 8 }}>
                            Status: <span className={`badge ${booking.status === 'CONFIRMED' ? 'badge-green' : 'badge-gray'}`}>
                                {booking.status}
                            </span>
                        </p>
                    </div>
                )}

                {error && <div className="alert alert-error">{error}</div>}

                {!confirm ? (
                    <button className="btn btn-danger" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setConfirm(true)}>
                        Cancel this booking
                    </button>
                ) : (
                    <div>
                        <div className="alert alert-error">Are you sure you want to cancel?</div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirm(false)}>
                                Keep it
                            </button>
                            <button className="btn btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={handleCancel} disabled={cancelling}>
                                {cancelling ? 'Cancelling…' : 'Yes, cancel'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
