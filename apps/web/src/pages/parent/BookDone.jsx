import { useLocation } from 'react-router-dom';

function fmt(d) {
    if (!d) return null;
    return new Date(d).toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit',
    });
}

export default function BookDone() {
    const { state } = useLocation();
    const { booking, eventTitle } = state || {};

    return (
        <div className="parent-page">
            <div className="parent-card">
                <div className="done-icon">🎉</div>
                <div className="done-title">Booking Confirmed!</div>
                <div className="done-sub">A confirmation email is on its way to your inbox.</div>

                {booking && (
                    <div className="done-detail">
                        <p><strong>{eventTitle}</strong></p>
                        {booking.slot && (
                            <p>🕐 {fmt(booking.slot?.startTime)} – {fmt(booking.slot?.endTime)}</p>
                        )}
                        {booking.childName && <p>👦 {booking.childName}</p>}
                        <p style={{ marginTop: 8, fontSize: 12, color: '#9ca3af' }}>
                            Reference: {booking.cancelToken?.slice(0, 8).toUpperCase()}
                        </p>
                    </div>
                )}

                <div className="alert alert-info" style={{ textAlign: 'center', fontSize: 13 }}>
                    Need to cancel? Use the link in your confirmation email.
                </div>
            </div>
        </div>
    );
}
